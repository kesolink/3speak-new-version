import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import express from 'express'
import cors from 'cors'
import { Client, PrivateKey } from '@hiveio/dhive'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: join(__dirname, '.env') })

const app = express()
const PORT = process.env.SERVER_PORT || 4020

const POSTING_WIF = process.env.THREESPEAK_POSTING_WIF
const HIVE_ACCOUNT = process.env.THREESPEAK_HIVE_ACCOUNT || 'badadib'
const MANTEAUTH_JWT_SECRET = process.env.MANTEAUTH_JWT_SECRET

// Hive client
const client = new Client(['https://api.hive.blog', 'https://api.deathwing.me'], {
  timeout: 4000,
  failoverThreshold: 3
})

app.use(cors())
app.use(express.json())

// Verify ManteAuth access token
async function verifyManteAuthToken(token) {
  // Verify by calling ManteAuth's API — no shared secret needed
  try {
    const res = await fetch('https://auth.okinoko.io/api/auth/verify', {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

// Allowed posting operations
const ALLOWED_OPS = ['vote', 'comment', 'delete_comment', 'comment_options', 'custom_json', 'claim_reward_balance']

const OP_USER_FIELD = {
  vote: 'voter',
  comment: 'author',
  delete_comment: 'author',
  comment_options: 'author',
  claim_reward_balance: 'account',
}

// POST /api/broadcast — broadcast ops on behalf of ManteAuth user
app.post('/api/broadcast', async (req, res) => {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' })
    }

    const tokenData = await verifyManteAuthToken(authHeader.slice(7))
    if (!tokenData?.hiveUsername) {
      return res.status(401).json({ error: 'Invalid or expired ManteAuth token' })
    }

    const hiveUsername = tokenData.hiveUsername
    const { operations } = req.body

    if (!operations?.length) {
      return res.status(400).json({ error: 'No operations provided' })
    }

    if (!POSTING_WIF) {
      return res.status(500).json({ error: 'Server posting key not configured' })
    }

    // Verify user granted posting authority to our account
    const [account] = await client.database.getAccounts([hiveUsername])
    if (!account) {
      return res.status(404).json({ error: 'Hive account not found' })
    }
    const hasAuth = account.posting.account_auths.some(([acc]) => acc === HIVE_ACCOUNT)
    if (!hasAuth) {
      return res.status(403).json({ error: `@${hiveUsername} has not granted posting authority to @${HIVE_ACCOUNT}` })
    }

    // Validate operations
    for (const [opType, opData] of operations) {
      if (!ALLOWED_OPS.includes(opType)) {
        return res.status(400).json({ error: `Operation "${opType}" not allowed` })
      }
      if (opType === 'custom_json') {
        const auths = opData.required_posting_auths || []
        if (!auths.includes(hiveUsername)) {
          return res.status(403).json({ error: 'custom_json must include your username in required_posting_auths' })
        }
      } else {
        const field = OP_USER_FIELD[opType]
        if (field && opData[field] !== hiveUsername) {
          return res.status(403).json({ error: `${opType}.${field} must be "${hiveUsername}"` })
        }
      }
    }

    // Broadcast
    const key = PrivateKey.fromString(POSTING_WIF)
    const result = await client.broadcast.sendOperations(operations, key)
    res.json({ success: true, result })
  } catch (err) {
    console.error('Broadcast error:', err)
    res.status(500).json({ error: 'Broadcast failed', message: err.message })
  }
})

app.get('/api/health', (req, res) => res.json({ ok: true }))

app.listen(PORT, () => {
  console.log(`3Speak backend service running on :${PORT}`)
})
