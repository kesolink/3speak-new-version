import { useState, useRef, useEffect } from 'react'
import { ArrowLeft, Send, MessageCirclePlus, Loader2 } from 'lucide-react'
import {
  useConversations,
  useChatMessages,
  useTyping,
} from '@snapie/chat-client/react'
import { toast } from 'sonner'
import { useChat } from '../../context/ChatContext'
import { useAppStore } from '../../lib/store'
import './chat.scss'

const avatar = (name) => `https://images.hive.blog/u/${name}/avatar/small`

function convTitle(conv) {
  if (!conv) return ''
  if (conv.type === 'dm') return conv.peer || conv.name
  return conv.name
}

/** Shown when the client isn't authenticated to the Snapie chat backend yet. */
function ConnectGate() {
  const { connect, connecting, error, canConnect } = useChat()
  return (
    <div className="chat-gate">
      <div className="chat-gate-icon">
        <MessageCirclePlus size={44} />
      </div>
      <h3>Connect to 3Speak Chat</h3>
      <p>
        Chat is powered by Snapie. Connecting signs a one-time login challenge
        with your Hive posting key — no transaction, no cost.
      </p>
      {error && <p className="chat-gate-error">{error}</p>}
      <button
        type="button"
        className="chat-btn-primary"
        onClick={connect}
        disabled={connecting || !canConnect}
      >
        {connecting ? (
          <>
            <Loader2 size={16} className="chat-spin" /> Connecting…
          </>
        ) : (
          'Connect chat'
        )}
      </button>
      {!canConnect && (
        <p className="chat-gate-hint">
          Your current login can’t sign the chat challenge. Use Keychain,
          HiveAuth, PeakVault or Ledger.
        </p>
      )}
    </div>
  )
}

function NewDmForm() {
  const { openDmWith } = useChat()
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    const handle = value.trim().replace(/^@/, '')
    if (!handle || busy) return
    setBusy(true)
    try {
      await openDmWith(handle)
      setValue('')
    } catch (err) {
      toast.error(err?.message || 'Could not open that conversation.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="chat-newdm" onSubmit={submit}>
      <span className="chat-newdm-at">@</span>
      <input
        type="text"
        placeholder="Message a Hive user…"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        spellCheck={false}
        autoCapitalize="none"
      />
      <button type="submit" disabled={!value.trim() || busy} aria-label="Start chat">
        {busy ? <Loader2 size={16} className="chat-spin" /> : <Send size={16} />}
      </button>
    </form>
  )
}

function ConversationList() {
  const { conversations, loading } = useConversations()
  const { openConversation, activeConversation } = useChat()

  return (
    <div className="chat-list">
      <NewDmForm />
      {loading && conversations.length === 0 && (
        <div className="chat-empty">Loading conversations…</div>
      )}
      {!loading && conversations.length === 0 && (
        <div className="chat-empty">
          No conversations yet. Start one above by entering a Hive username.
        </div>
      )}
      <ul className="chat-conv-ul">
        {conversations.map((conv) => {
          const title = convTitle(conv)
          const isDm = conv.type === 'dm'
          const active = activeConversation?._id === conv._id
          return (
            <li
              key={conv._id}
              className={`chat-conv-row${conv.unread ? ' unread' : ''}${active ? ' active' : ''}`}
              onClick={() => openConversation(conv)}
            >
              <img
                className="chat-conv-avatar"
                src={isDm ? avatar(title) : avatar(conv.owner || 'spknetwork')}
                alt=""
                onError={(e) => {
                  e.currentTarget.style.visibility = 'hidden'
                }}
              />
              <div className="chat-conv-meta">
                <div className="chat-conv-name">
                  {isDm ? `@${title}` : `# ${title}`}
                </div>
                {conv.lastMessage && (
                  <div className="chat-conv-last">
                    {conv.lastMessage.sender
                      ? `${conv.lastMessage.sender}: `
                      : ''}
                    {conv.lastMessage.content}
                  </div>
                )}
              </div>
              {conv.unread && <span className="chat-conv-dot" />}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function Thread({ conv }) {
  const me = useAppStore((s) => s.user)
  const { backToList } = useChat()
  const { messages, loading, error, sendMessage } = useChatMessages(
    conv._id,
    conv.type
  )
  const { typingUsers, setTyping } = useTyping(conv._id)
  const [draft, setDraft] = useState('')
  const scrollRef = useRef(null)

  // Auto-scroll to the newest message.
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages.length, typingUsers.length])

  const submit = async (e) => {
    e.preventDefault()
    const content = draft.trim()
    if (!content) return
    setDraft('')
    setTyping(false)
    await sendMessage(content)
  }

  const others = typingUsers.filter((u) => u !== me)
  const isDm = conv.type === 'dm'
  const title = convTitle(conv)

  return (
    <div className="chat-thread">
      <header className="chat-thread-header">
        <button
          type="button"
          className="chat-icon-btn chat-thread-back"
          onClick={backToList}
          aria-label="Back to conversations"
        >
          <ArrowLeft size={20} />
        </button>
        <img className="chat-thread-avatar" src={avatar(isDm ? title : conv.owner || 'spknetwork')} alt="" />
        <span className="chat-thread-title">{isDm ? `@${title}` : `# ${title}`}</span>
      </header>

      <div className="chat-messages" ref={scrollRef}>
        {loading && <div className="chat-empty">Loading messages…</div>}
        {error && <div className="chat-gate-error">{error}</div>}
        {!loading && messages.length === 0 && (
          <div className="chat-empty">No messages yet — say hi 👋</div>
        )}
        {messages.map((m) => {
          const mine = m.sender === me
          return (
            <div key={m._id} className={`chat-msg${mine ? ' mine' : ''}`}>
              {!mine && conv.type !== 'dm' && (
                <span className="chat-msg-sender">@{m.sender}</span>
              )}
              <div className="chat-msg-bubble">{m.content}</div>
            </div>
          )
        })}
        {others.length > 0 && (
          <div className="chat-typing">
            {others.join(', ')} {others.length === 1 ? 'is' : 'are'} typing…
          </div>
        )}
      </div>

      <form className="chat-composer" onSubmit={submit}>
        <input
          type="text"
          placeholder="Type a message…"
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value)
            setTyping(e.target.value.length > 0)
          }}
        />
        <button type="submit" disabled={!draft.trim()} aria-label="Send">
          <Send size={18} />
        </button>
      </form>
    </div>
  )
}

export default function ChatPage() {
  const { ready, connecting, activeConversation } = useChat()
  const authenticated = useAppStore((s) => s.authenticated)

  if (!authenticated) {
    return (
      <div className="chat-page">
        <div className="chat-gate">
          <div className="chat-gate-icon">
            <MessageCirclePlus size={44} />
          </div>
          <h3>Log in to use chat</h3>
          <p>Sign in with your Hive account to send and receive messages.</p>
        </div>
      </div>
    )
  }

  if (!ready) {
    // While the silent background connect runs, show a spinner rather than the
    // gate — the gate only appears if auto-connect couldn't establish a session.
    return (
      <div className="chat-page">
        {connecting ? (
          <div className="chat-gate">
            <Loader2 size={40} className="chat-spin" />
            <p>Connecting to chat…</p>
          </div>
        ) : (
          <ConnectGate />
        )}
      </div>
    )
  }

  // `has-active` drives the mobile single-pane swap (list vs thread).
  return (
    <div className={`chat-page two-pane${activeConversation ? ' has-active' : ''}`}>
      <div className="chat-page-sidebar">
        <ConversationList />
      </div>
      <div className="chat-page-main">
        {activeConversation ? (
          <Thread conv={activeConversation} />
        ) : (
          <div className="chat-empty chat-page-placeholder">
            Select a conversation, or start a new one.
          </div>
        )}
      </div>
    </div>
  )
}
