import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react'
import { ChatProvider as SdkChatProvider } from '@snapie/chat-client/react'
import { useAppStore } from '../lib/store'
import {
  getChatClient,
  authenticateChat,
  canSignChatChallenge,
} from '../lib/snapieChat'

const ChatUIContext = createContext(null)

export function useChat() {
  const ctx = useContext(ChatUIContext)
  if (!ctx) throw new Error('useChat must be used inside <ChatProvider>')
  return ctx
}

export function ChatProvider({ children }) {
  const client = useMemo(() => getChatClient(), [])
  const user = useAppStore((s) => s.user)
  const authenticated = useAppStore((s) => s.authenticated)

  // `ready` = the SDK client holds a valid token for the current Hive user.
  const [ready, setReady] = useState(
    () => client.isAuthenticated() && client.getUsername() === user
  )
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState(null)

  // The conversation currently open in the thread view (null = list view).
  const [activeConversation, setActiveConversation] = useState(null)

  // Username we've already auto-attempted, so the silent background connect
  // fires once per login (not on every render).
  const autoTriedRef = useRef(null)

  // Core auth runner. `allowClientFallback` decides whether a failed background
  // (@threespeak) sign may fall back to a wallet signature (which can pop a
  // dialog) — true for the manual "Connect" button, false for auto-connect.
  const runAuthenticate = useCallback(async (uname, { allowClientFallback }) => {
    setConnecting(true)
    if (allowClientFallback) setError(null)
    try {
      await authenticateChat(uname, { allowClientFallback })
      setReady(true)
      return true
    } catch (e) {
      // Silent auto attempts don't surface an error (expected when the user
      // hasn't granted @threespeak and can't sign client-side).
      if (allowClientFallback) setError(e?.message || 'Could not connect to chat.')
      setReady(false)
      return false
    } finally {
      setConnecting(false)
    }
  }, [])

  // Keep chat auth in sync with login state, and auto-connect silently (no
  // wallet popup) the first time we see a logged-in user without a token.
  useEffect(() => {
    const loggedInAs = authenticated ? user : null
    if (!loggedInAs) {
      if (client.isAuthenticated()) client.logout()
      setReady(false)
      setError(null)
      setActiveConversation(null)
      autoTriedRef.current = null
      return
    }
    if (client.isAuthenticated() && client.getUsername() === loggedInAs) {
      setReady(true)
      return
    }
    // No token for this user (or a stale one) — drop it and try a silent
    // background @threespeak connect once.
    if (client.isAuthenticated()) client.logout()
    setReady(false)
    setActiveConversation(null)
    if (autoTriedRef.current !== loggedInAs) {
      autoTriedRef.current = loggedInAs
      runAuthenticate(loggedInAs, { allowClientFallback: false })
    }
  }, [client, user, authenticated, runAuthenticate])

  // Manual connect (from the fallback gate): may use a wallet signature.
  const connect = useCallback(async () => {
    if (!authenticated || !user) {
      setError('Log in first to use chat.')
      return false
    }
    return runAuthenticate(user, { allowClientFallback: true })
  }, [authenticated, user, runAuthenticate])

  const openConversation = useCallback((conv) => {
    setActiveConversation(conv)
  }, [])
  const backToList = useCallback(() => setActiveConversation(null), [])

  // Open (or resume) a DM with a Hive user and switch to its thread.
  const openDmWith = useCallback(
    async (targetUser) => {
      const handle = String(targetUser || '').trim().replace(/^@/, '').toLowerCase()
      if (!handle) return
      const conv = await client.openDm(handle)
      setActiveConversation(conv)
      return conv
    },
    [client]
  )

  const value = useMemo(
    () => ({
      client,
      ready,
      connecting,
      error,
      canConnect: canSignChatChallenge(),
      connect,
      activeConversation,
      openConversation,
      backToList,
      openDmWith,
    }),
    [
      client,
      ready,
      connecting,
      error,
      connect,
      activeConversation,
      openConversation,
      backToList,
      openDmWith,
    ]
  )

  return (
    <ChatUIContext.Provider value={value}>
      <SdkChatProvider client={client}>{children}</SdkChatProvider>
    </ChatUIContext.Provider>
  )
}
