import { ChatClient } from '@snapie/chat-client'
import aioha, {
  signMessageWithAioha,
  getCurrentProvider,
  isManteAuthLogin,
  KeyTypes,
  Providers,
} from '../hive-api/aioha'
import { EMBED_API_KEY } from '../utils/config'

// preview-3speak's own backend (broadcast/manteauth/sign). Same base aioha uses.
const THREESPEAK_API = import.meta.env.VITE_THREESPEAK_API || '/api'

// The SDK talks to `{baseUrl}/api/chat/*`. The Snapie chat API does not send
// CORS headers, so we can't hit https://snapie.io directly from the browser —
// instead we go same-origin through a dev-server/nginx proxy. `/snapie-chat` is
// rewritten to https://snapie.io (see vite.config.js `server.proxy`). Override
// with VITE_SNAPIE_CHAT_BASE_URL if a different Snapie instance is wanted.
export const SNAPIE_CHAT_BASE_URL =
  import.meta.env.VITE_SNAPIE_CHAT_BASE_URL || '/snapie-chat'

let client = null

/** Lazily create the one shared ChatClient. */
export function getChatClient() {
  if (!client) {
    client = new ChatClient({ baseUrl: SNAPIE_CHAT_BASE_URL })
  }
  return client
}

// Chat auth is a Hive posting-key *signMessage* challenge. Only providers that
// can sign an arbitrary buffer client-side qualify. HiveSigner can't sign
// buffers, and Butter Auth / ManteAuth sessions hold no client-side key (they
// broadcast posting ops through @threespeak) — neither can satisfy the
// challenge, so we surface a clear reason instead of a cryptic signing error.
const SIGN_CAPABLE_PROVIDERS = new Set([
  Providers.Keychain,
  Providers.HiveAuth,
  Providers.PeakVault,
  Providers.Ledger,
])

export function canSignChatChallenge() {
  if (isManteAuthLogin()) return false
  return SIGN_CAPABLE_PROVIDERS.has(getCurrentProvider())
}

export function chatAuthUnavailableReason() {
  if (isManteAuthLogin()) {
    return 'Chat needs a wallet that can sign a login challenge. Butter Auth sessions can’t — log in with Keychain, HiveAuth, PeakVault or Ledger to use chat.'
  }
  if (getCurrentProvider() === Providers.HiveSigner) {
    return 'HiveSigner can’t sign the chat login challenge. Log in with Keychain, HiveAuth, PeakVault or Ledger to use chat.'
  }
  return 'Chat requires a wallet that can sign a login challenge (Keychain, HiveAuth, PeakVault or Ledger).'
}

// Sign a chat challenge (a UUID) via @threespeak through the preview backend, so
// the background service signs for ALL logins — no wallet popup. Backend auth:
// HiveSigner → Bearer token; ManteAuth → httpOnly cookie; wallet → public app
// key + claimed username (same trust as /api/broadcast). Throws on failure so
// the caller may fall back to a client-side signature.
async function signChatChallengeViaThreespeak(challenge, username) {
  const provider = getCurrentProvider()
  const headers = { 'Content-Type': 'application/json' }
  const body = { challenge }
  if (provider === Providers.HiveSigner) {
    const token = localStorage.getItem('hivesignerToken')
    if (!token) throw new Error('HiveSigner session expired — reconnect and try again')
    headers.Authorization = `Bearer ${token}`
  } else if (!isManteAuthLogin()) {
    headers['X-API-Key'] = EMBED_API_KEY
    body.username = username
  }
  const res = await fetch(`${THREESPEAK_API}/snapie-chat/sign-challenge`, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.signature) {
    throw new Error(data.error || 'Could not sign the chat challenge')
  }
  return data.signature
}

async function signChatChallengeClientSide(challenge) {
  const res = await signMessageWithAioha(challenge, KeyTypes.Posting, 'Sign in to 3Speak Chat')
  if (!res?.success || !res.result) {
    throw new Error('Chat login signature was rejected.')
  }
  return res.result
}

/**
 * Authenticate the shared client for `username` against the Snapie chat API.
 * Reuses an existing valid token when one is already stored for this user.
 *
 * Tries the background @threespeak signer first (no wallet popup, works for
 * every login type). If that fails — e.g. the user never granted @threespeak
 * posting authority — and `allowClientFallback` is set and the provider can sign
 * client-side, it falls back to a wallet signature. Returns the ChatClient;
 * throws with a human-readable message on failure.
 */
export async function authenticateChat(username, { allowClientFallback = true } = {}) {
  const c = getChatClient()
  if (c.isAuthenticated() && c.getUsername() === username) return c

  try {
    await c.authenticate(username, (challenge) =>
      signChatChallengeViaThreespeak(challenge, username)
    )
    return c
  } catch (bgErr) {
    if (allowClientFallback && canSignChatChallenge()) {
      await c.authenticate(username, signChatChallengeClientSide)
      return c
    }
    throw bgErr
  }
}

export { aioha }
