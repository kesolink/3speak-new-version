const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '.env') })
const express = require('express')
const cors = require('cors')
const cookieParser = require('cookie-parser')
const rateLimit = require('express-rate-limit')
const helmet = require('helmet')
const crypto = require('crypto')
const { Client, PrivateKey, cryptoUtils } = require('@hiveio/dhive')

// ButrAuth SDK is ESM-only — load via dynamic import at startup.
let butr = null
async function initButrAuth() {
  const { ButrAuthClient } = await import('@mantequilla-soft/butrauth-client')
  butr = new ButrAuthClient({
    baseUrl: MANTEAUTH_URL,
    clientId: MANTEAUTH_CLIENT_ID,
    clientSecret: MANTEAUTH_CLIENT_SECRET
  })
  console.log('[INFO] ButrAuth SDK initialised')
}

const app = express()
const PORT = process.env.SERVER_PORT || 4020

const POSTING_WIF = process.env.THREESPEAK_POSTING_WIF
const HIVE_ACCOUNT = process.env.THREESPEAK_HIVE_ACCOUNT || 'badadib'
// Shared app key (same one the embed TUS upload uses) — authenticates wallet
// logins (Keychain/HiveAuth/PeakVault/Ledger) on the post-creation path, which
// can't present a token/cookie. Same trust level the upload pipeline already
// relies on; the path is narrowed to post ops only (see /api/broadcast).
const EMBED_API_KEY = process.env.EMBED_API_KEY || ''
const MANTEAUTH_CLIENT_ID = process.env.MANTEAUTH_CLIENT_ID || 'threespeak'
const MANTEAUTH_CLIENT_SECRET = process.env.MANTEAUTH_CLIENT_SECRET
const MANTEAUTH_URL = process.env.MANTEAUTH_URL || 'https://auth.okinoko.io'

// Allowed origins for CORS — only the trusted 3speak frontends
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'https://3speak.tv,https://3speak.okinoko.io,http://localhost:5173')
  .split(',').map(s => s.trim()).filter(Boolean)

// Hive client
const client = new Client(['https://api.hive.blog', 'https://api.deathwing.me'], {
  timeout: 4000,
  failoverThreshold: 3
})

app.disable('x-powered-by')
app.set('trust proxy', 1)

app.use(helmet({
  contentSecurityPolicy: false, // Set on the frontend, not the API
}))

app.use(cors({
  origin: (origin, cb) => {
    // Allow no-origin (server-to-server, curl) AND whitelisted origins
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true)
    cb(new Error('CORS: origin not allowed'))
  },
  credentials: true
}))

app.use(express.json({ limit: '100kb' }))
app.use(cookieParser())

// === Rate limits ===
const baseLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests' }
})
const exchangeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests' }
})
const broadcastLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests' }
})

// Verify a ButrAuth access token locally via the SDK. Returns claims on
// success or null on any failure (bad signature, expired, wrong client, etc).
async function verifyManteAuthToken(token) {
  if (!butr) return null
  try {
    return await butr.verifyAccessToken(token)
  } catch {
    return null
  }
}

// === Session cookies (3speak's own session, not ManteAuth's) ===
const SESSION_COOKIE_NAME = 'threespeak_session'
const PKCE_COOKIE_NAME = 'manteauth_pkce'
const SESSION_TTL_MS = 60 * 60 * 1000 // 1 hour, matches access token

function setSessionCookie(res, accessToken, username) {
  res.cookie(SESSION_COOKIE_NAME, accessToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: SESSION_TTL_MS,
    path: '/'
  })
  // Non-httpOnly username cookie so the frontend can read who is logged in (no token leak)
  res.cookie('threespeak_user', username, {
    httpOnly: false,
    secure: true,
    sameSite: 'lax',
    maxAge: SESSION_TTL_MS,
    path: '/'
  })
}

function clearSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE_NAME, { path: '/' })
  res.clearCookie('threespeak_user', { path: '/' })
  // Also clear any stale PKCE cookie so a fresh /start is required
  res.clearCookie(PKCE_COOKIE_NAME, { path: '/' })
}

function setPkceCookie(res, verifier) {
  // httpOnly cookie carrying the PKCE verifier across the auth redirect.
  // 30 min — long enough for email magic-link flows where the user may switch tabs.
  res.cookie(PKCE_COOKIE_NAME, verifier, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 30 * 60 * 1000,
    path: '/'
  })
}

function clearPkceCookie(res) {
  res.clearCookie(PKCE_COOKIE_NAME, { path: '/' })
}

// === Custom_json operation whitelist ===
const ALLOWED_OPS = ['vote', 'comment', 'delete_comment', 'comment_options', 'custom_json', 'claim_reward_balance']

const ALLOWED_CUSTOM_JSON_IDS = new Set([
  // Hive standard
  'follow',
  'notify',
  // 3Speak playlist operations
  '3speak_playlist_create',
  '3speak_playlist_add',
  '3speak_playlist_remove',
  '3speak_playlist_reorder',
  '3speak_playlist_update',
  '3speak_playlist_delete',
])

const OP_USER_FIELD = {
  vote: 'voter',
  comment: 'author',
  delete_comment: 'author',
  comment_options: 'author',
  claim_reward_balance: 'account',
}

// =====================================================================
// POST /api/manteauth/start — generate PKCE verifier server-side, set
// httpOnly cookie, return the auth URL with the matching code_challenge
// =====================================================================
app.post('/api/manteauth/start', baseLimiter, (req, res) => {
  try {
    const { redirect_uri, state } = req.body
    if (!redirect_uri || typeof redirect_uri !== 'string') {
      return res.status(400).json({ error: 'Invalid request' })
    }
    if (!butr) return res.status(503).json({ error: 'ButrAuth not ready' })

    res.set('Cache-Control', 'no-store')

    const { url, codeVerifier } = butr.createAuthRequest({
      redirectUri: redirect_uri,
      scope: 'posting',
      state: state || ''
    })
    setPkceCookie(res, codeVerifier)

    res.json({ url })
  } catch (err) {
    console.error('Start error:', err.message)
    res.status(500).json({ error: 'Internal error' })
  }
})

// =====================================================================
// POST /api/manteauth/exchange — exchange auth code for an access token,
// set it as an httpOnly cookie, never expose it to the frontend.
// =====================================================================
app.post('/api/manteauth/exchange', exchangeLimiter, async (req, res) => {
  try {
    const { code, redirect_uri } = req.body
    const code_verifier = req.cookies?.[PKCE_COOKIE_NAME]
    const existingSession = req.cookies?.[SESSION_COOKIE_NAME]

    // Idempotency: if this request arrives without a PKCE verifier but the user
    // already has a valid session cookie, assume it's a double-invoke (e.g. React
    // StrictMode) and return the current session instead of erroring.
    if (!code_verifier && existingSession) {
      const decoded = await verifyManteAuthToken(existingSession)
      if (decoded?.hiveUsername) {
        return res.json({ username: decoded.hiveUsername })
      }
    }

    if (!code || !redirect_uri || !code_verifier) {
      return res.status(400).json({ error: 'Invalid request' })
    }
    if (!butr) return res.status(503).json({ error: 'ButrAuth not ready' })

    let tokens
    try {
      tokens = await butr.exchangeCode({
        code,
        redirectUri: redirect_uri,
        codeVerifier: code_verifier
      })
    } catch (err) {
      clearPkceCookie(res)
      return res.status(401).json({ error: err.message || 'Token exchange failed' })
    }
    clearPkceCookie(res)

    setSessionCookie(res, tokens.accessToken, tokens.username)
    res.json({ username: tokens.username })
  } catch (err) {
    console.error('Exchange error:', err.message)
    clearPkceCookie(res)
    res.status(500).json({ error: 'Exchange failed' })
  }
})

// GET /api/manteauth/me — return the current ManteAuth session info (username only)
app.get('/api/manteauth/me', baseLimiter, async (req, res) => {
  const token = req.cookies?.[SESSION_COOKIE_NAME]
  if (!token) return res.status(401).json({ error: 'Unauthorized' })
  const decoded = await verifyManteAuthToken(token)
  if (!decoded?.hiveUsername) {
    clearSessionCookie(res)
    return res.status(401).json({ error: 'Unauthorized' })
  }
  res.json({ username: decoded.hiveUsername })
})

// POST /api/manteauth/logout — clear the session cookie
app.post('/api/manteauth/logout', baseLimiter, (req, res) => {
  console.log('[logout] clearing cookies for:', Object.keys(req.cookies || {}))
  clearSessionCookie(res)
  res.json({ success: true })
})

// =====================================================================
// POST /api/broadcast — broadcast posting-level operations
// Auth via the httpOnly session cookie (no Bearer token, no localStorage)
// =====================================================================
// Verify a HiveSigner access token by asking hivesigner.com who it belongs to.
// Returns the Hive username on success, or null on any failure/expiry.
async function verifyHiveSignerToken(token) {
  if (!token) return null
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 4000)
  try {
    const resp = await fetch('https://hivesigner.com/api/me', {
      method: 'POST',
      headers: { Authorization: token, 'Content-Type': 'application/json' },
      signal: ctrl.signal,
    })
    if (!resp.ok) return null
    const data = await resp.json()
    return data && data.name ? data.name : null
  } catch {
    return null
  } finally {
    clearTimeout(t)
  }
}

// Shared broadcast flow — given a username resolved from EITHER the ButrAuth
// session cookie OR a verified HiveSigner token, validate the ops and broadcast
// them signed with @threespeak's posting key (accepted because the user granted
// @threespeak posting authority). Sends the HTTP response.
async function broadcastAsThreespeak(hiveUsername, operations, res) {
  if (!operations || !operations.length) {
    return res.status(400).json({ error: 'No operations provided' })
  }
  if (operations.length > 20) {
    return res.status(400).json({ error: 'Too many operations' })
  }
  if (!POSTING_WIF) {
    return res.status(500).json({ error: 'Server is not configured' })
  }

  // Verify user granted posting authority to our service account
  const [account] = await client.database.getAccounts([hiveUsername])
  if (!account) return res.status(403).json({ error: 'Authorization required' })
  const grant = account.posting.account_auths.find(([acc]) => acc === HIVE_ACCOUNT)
  if (!grant || grant[1] < account.posting.weight_threshold) {
    return res.status(403).json({ error: 'Authorization required' })
  }

  // Validate every operation
  for (const [opType, opData] of operations) {
    if (!ALLOWED_OPS.includes(opType)) {
      return res.status(400).json({ error: 'Operation not allowed' })
    }
    if (opType === 'custom_json') {
      const auths = opData.required_posting_auths || []
      if (!auths.includes(hiveUsername)) {
        return res.status(403).json({ error: 'Operation not allowed' })
      }
      if (!ALLOWED_CUSTOM_JSON_IDS.has(opData.id)) {
        return res.status(403).json({ error: 'custom_json id not allowed for this app' })
      }
    } else {
      const field = OP_USER_FIELD[opType]
      if (field && opData[field] !== hiveUsername) {
        return res.status(403).json({ error: 'Operation not allowed' })
      }
    }
  }

  const key = PrivateKey.fromString(POSTING_WIF)
  const result = await client.broadcast.sendOperations(operations, key)
  return res.json({ success: true, result })
}

app.post('/api/broadcast', broadcastLimiter, async (req, res) => {
  try {
    let hiveUsername = null

    // 1) ButrAuth httpOnly session cookie
    const cookieToken = req.cookies?.[SESSION_COOKIE_NAME]
    if (cookieToken) {
      const tokenData = await verifyManteAuthToken(cookieToken)
      if (tokenData?.hiveUsername) hiveUsername = tokenData.hiveUsername
      else clearSessionCookie(res)
    }

    // 2) HiveSigner access token via Authorization: Bearer (HiveSigner users
    //    can't sign client-side; verify the token and post on their behalf).
    if (!hiveUsername) {
      const authHeader = req.headers.authorization || ''
      const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''
      if (bearer) hiveUsername = await verifyHiveSignerToken(bearer)
    }

    // 3) App-key path (wallet logins: Keychain/HiveAuth/PeakVault/Ledger). They
    //    can't present a token/cookie, so — per policy that @threespeak (not the
    //    user) broadcasts embed posts — we trust the frontend app key (the same
    //    one the embed TUS upload uses) and take the claimed username from the
    //    body. This path is narrowed to posting-level ops only (comment /
    //    comment_options / custom_json / vote); broadcastAsThreespeak still
    //    enforces the @threespeak posting-auth grant + author/voter/
    //    required_posting_auths match, so the worst case is "act as a user who
    //    opted into @threespeak" (and only posting-level, never active-key).
    if (!hiveUsername) {
      const apiKey = req.headers['x-api-key'] || ''
      if (EMBED_API_KEY && apiKey === EMBED_API_KEY) {
        const claimed = typeof req.body?.username === 'string' ? req.body.username.trim().toLowerCase() : ''
        const ops = Array.isArray(req.body?.operations) ? req.body.operations : []
        const postingOpsOnly = ops.length > 0 && ops.every(
          ([t]) => t === 'comment' || t === 'comment_options' || t === 'custom_json' || t === 'vote'
        )
        if (claimed && !postingOpsOnly) {
          return res.status(403).json({ error: 'Operation not allowed for app-key auth' })
        }
        if (claimed) hiveUsername = claimed
      }
    }

    if (!hiveUsername) return res.status(401).json({ error: 'Unauthorized' })

    return await broadcastAsThreespeak(hiveUsername, req.body.operations, res)
  } catch (err) {
    console.error('Broadcast error:', err.message)
    res.status(500).json({ error: 'Broadcast failed' })
  }
})

// Image upload — sign the standard images.hive.blog "ImageSigningChallenge" with
// @threespeak's posting key and upload on the user's behalf. Lets every login
// (incl. HiveSigner, which can't sign client-side) attach covers/thumbnails with
// no wallet signature. Gated by the shared app key (same trust as the embed
// upload); the image is hosted under @threespeak and needs no user authority.
const imageUploadLimiter = rateLimit({ windowMs: 60 * 1000, max: 40, standardHeaders: true, legacyHeaders: false })
app.post('/api/upload-image', imageUploadLimiter, express.raw({ type: () => true, limit: '15mb' }), async (req, res) => {
  try {
    const apiKey = req.headers['x-api-key'] || ''
    if (!EMBED_API_KEY || apiKey !== EMBED_API_KEY) return res.status(401).json({ error: 'Unauthorized' })
    if (!POSTING_WIF) return res.status(500).json({ error: 'Server is not configured' })
    const img = req.body
    if (!Buffer.isBuffer(img) || img.length === 0) return res.status(400).json({ error: 'No image data' })

    // Standard hive.blog image auth: sign sha256("ImageSigningChallenge" + bytes).
    const hash = cryptoUtils.sha256(Buffer.concat([Buffer.from('ImageSigningChallenge'), img]))
    const signature = PrivateKey.fromString(POSTING_WIF).sign(hash).toString()

    const contentType = req.headers['content-type'] || 'image/png'
    const form = new FormData()
    form.append('file', new Blob([img], { type: contentType }), 'image')

    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 20000)
    let hostResp
    try {
      hostResp = await fetch(`https://images.hive.blog/${HIVE_ACCOUNT}/${signature}`, {
        method: 'POST', body: form, signal: ctrl.signal,
      })
    } finally { clearTimeout(t) }

    const data = await hostResp.json().catch(() => ({}))
    if (!hostResp.ok || !data.url) {
      console.error('Image host rejected:', hostResp.status, JSON.stringify(data).slice(0, 200))
      return res.status(502).json({ error: 'Image host rejected the upload' })
    }
    return res.json({ success: true, url: data.url })
  } catch (e) {
    console.error('Image upload error:', e.message)
    return res.status(500).json({ error: 'Image upload failed' })
  }
})

app.get('/api/health', (req, res) => res.json({ ok: true }))

// Generic error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message)
  res.status(500).json({ error: 'Internal error' })
})

// Block startup until the SDK is initialised (also primes the public-key cache)
;(async () => {
  try {
    await initButrAuth()
    await butr.getPublicKey()
  } catch (err) {
    console.error('[FATAL]', err.message)
    process.exit(1)
  }

  app.listen(PORT, () => {
    console.log(`3Speak backend service running on :${PORT}`)
  })
})()
