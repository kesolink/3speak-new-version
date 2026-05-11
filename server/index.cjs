const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '.env') })
const express = require('express')
const cors = require('cors')
const cookieParser = require('cookie-parser')
const rateLimit = require('express-rate-limit')
const helmet = require('helmet')
const crypto = require('crypto')
const { Client, PrivateKey } = require('@hiveio/dhive')

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
app.post('/api/broadcast', broadcastLimiter, async (req, res) => {
  try {
    const token = req.cookies?.[SESSION_COOKIE_NAME]
    if (!token) return res.status(401).json({ error: 'Unauthorized' })

    const tokenData = await verifyManteAuthToken(token)
    if (!tokenData?.hiveUsername) {
      clearSessionCookie(res)
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const hiveUsername = tokenData.hiveUsername
    const { operations } = req.body

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
    res.json({ success: true, result })
  } catch (err) {
    console.error('Broadcast error:', err.message)
    res.status(500).json({ error: 'Broadcast failed' })
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
