import { useState, useRef, useEffect } from 'react'
import { ArrowLeft, Send, MessageCirclePlus, Loader2, MoreHorizontal, X } from 'lucide-react'
import {
  useConversations,
  useChatMessages,
  useTyping,
} from '@snapie/chat-client/react'
import { extractImageUrls } from '@snapie/chat-client'
import { toast } from 'sonner'
import { useSearchParams } from 'react-router-dom'
import ChatComposerTools from './ChatComposerTools'
import EmojiTextInput from './EmojiTextInput'
import ChatLinkCard from './ChatLinkCard'
import ChatImageLightbox from './ChatImageLightbox'
import { parseChatLink, timeAgo } from './chatLinks'
import { useChat } from '../../context/ChatContext'
import { useAppStore } from '../../lib/store'
import { EMBED_API_KEY } from '../../utils/config'
import './chat.scss'

const avatar = (name) => `https://images.hive.blog/u/${name}/avatar/small`

function convTitle(conv) {
  if (!conv) return ''
  if (conv.type === 'dm') return conv.peer || conv.name
  return conv.name
}

// Unsent draft text per conversation (so switching chats keeps each draft).
const draftStore = new Map()

// preview-3speak backend base (same as aioha.js uses).
const THREESPEAK_API = import.meta.env.VITE_THREESPEAK_API || '/api'

// Upload an image via the background @threespeak service; returns its URL.
async function uploadChatImage(file) {
  const res = await fetch(`${THREESPEAK_API}/upload-image`, {
    method: 'POST',
    headers: { 'Content-Type': file.type || 'image/png', 'X-API-Key': EMBED_API_KEY },
    body: file,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.url) throw new Error(data?.error || 'Upload failed')
  return data.url
}

// Image URLs in a message: SDK detection (by extension) PLUS known image hosts
// — the upload service returns images.hive.blog URLs without a file extension.
const IMG_HOST_RE = /https?:\/\/(?:images\.hive\.blog|files\.peakd\.com|[a-z0-9.-]+\.b-cdn\.net)\/[^\s)]+/gi
function findImageUrls(text) {
  const out = new Set(extractImageUrls(text))
  for (const m of String(text || '').match(IMG_HOST_RE) || []) out.add(m.replace(/[.,]+$/, ''))
  return [...out]
}

// Short preview of a quoted message for the composer banner.
function quoteSnippet(text) {
  const t = String(text || '').replace(/\s+/g, ' ').trim()
  return t.length > 140 ? t.slice(0, 140) + '…' : t
}

// Turn bare URLs in a text run into clickable links (open in a new tab). Image
// and recognized post links are already stripped/rendered before this runs, so
// what remains here are "other" links.
function linkify(str) {
  const parts = str.split(/(https?:\/\/[^\s]+)/g)
  return parts.map((part, i) => {
    if (/^https?:\/\//i.test(part)) {
      const href = part.replace(/[.,;:!?)]+$/, '')
      return (
        <a key={i} className="chat-msg-link" href={href} target="_blank" rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}>
          {part}
        </a>
      )
    }
    return part
  })
}

// Strip leading ">" markers from a line, returning its quote depth + remainder.
function lineDepth(line) {
  let depth = 0
  let rest = line
  while (/^>\s?/.test(rest)) { rest = rest.replace(/^>\s?/, ''); depth++ }
  return { depth, text: rest }
}

// Build nested quote blocks from depth-annotated lines (recurses one level per
// ">" so "> > x" renders as two stacked bars).
function buildNodes(lines, keyBase = 'n') {
  const nodes = []
  let i = 0
  while (i < lines.length) {
    if (lines[i].depth === 0) {
      const buf = []
      while (i < lines.length && lines[i].depth === 0) { buf.push(lines[i].text); i++ }
      const joined = buf.join('\n')
      if (joined.trim().length) nodes.push(<span className="chat-msg-text" key={`${keyBase}${nodes.length}`}>{linkify(joined)}</span>)
    } else {
      const group = []
      while (i < lines.length && lines[i].depth >= 1) { group.push({ depth: lines[i].depth - 1, text: lines[i].text }); i++ }
      const k = `${keyBase}${nodes.length}`
      nodes.push(<blockquote className="chat-quote" key={k}>{buildNodes(group, `${k}-`)}</blockquote>)
    }
  }
  return nodes
}

// Render message text, turning lines that start with ">" into (nested) quotes.
function renderMessageText(text) {
  return buildNodes(text.split('\n').map(lineDepth))
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
  const { openConversation, activeConversation, shareDraft } = useChat()

  return (
    <div className="chat-list">
      {shareDraft && (
        <div className="chat-share-banner">Choose a chat to send to</div>
      )}
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
  const { backToList, shareDraft, setShareDraft } = useChat()
  const { messages, loading, error, sendMessage } = useChatMessages(
    conv._id,
    conv.type
  )
  const { typingUsers, setTyping } = useTyping(conv._id)
  // Draft is seeded from (and saved to) a per-conversation store, so switching
  // chats shows that chat's own unsent text and restores it on return.
  const [draft, setDraft] = useState(() => draftStore.get(conv._id) || '')
  const [menuFor, setMenuFor] = useState(null)
  const [quoteTarget, setQuoteTarget] = useState(null)
  const [lightboxUrl, setLightboxUrl] = useState(null)
  const [attachments, setAttachments] = useState([]) // {id, status, url, previewUrl}

  // Pasted images → upload via the background service; show as removable thumbs.
  const handlePasteFiles = (files) => {
    files.forEach((file) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
      const previewUrl = URL.createObjectURL(file)
      setAttachments((a) => [...a, { id, status: 'uploading', previewUrl }])
      uploadChatImage(file)
        .then((url) => setAttachments((a) => a.map((x) => (x.id === id ? { ...x, status: 'done', url } : x))))
        .catch(() => setAttachments((a) => a.map((x) => (x.id === id ? { ...x, status: 'error' } : x))))
    })
  }
  const removeAttachment = (id) => setAttachments((a) => {
    const x = a.find((i) => i.id === id)
    if (x?.previewUrl) URL.revokeObjectURL(x.previewUrl)
    return a.filter((i) => i.id !== id)
  })
  const scrollRef = useRef(null)
  const inputRef = useRef(null)

  // setDraft + persist (accepts a value or an updater fn).
  const updateDraft = (arg) => {
    setDraft((prev) => {
      const next = typeof arg === 'function' ? arg(prev) : arg
      if (next) draftStore.set(conv._id, next)
      else draftStore.delete(conv._id)
      return next
    })
  }

  // When this conversation opens with queued text (Share link / Forward),
  // prefill the composer with it once, then clear the queued draft.
  useEffect(() => {
    if (shareDraft) {
      updateDraft((cur) => (cur ? `${shareDraft}\n${cur}` : shareDraft))
      setShareDraft(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conv._id])

  // Auto-scroll to the newest message.
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages.length, typingUsers.length])

  const send = async () => {
    const parts = []
    if (quoteTarget) {
      parts.push(String(quoteTarget.content || '').split('\n').map((l) => '> ' + l).join('\n'))
    }
    const body = draft.trim()
    if (body) parts.push(body)
    const imageUrls = attachments.filter((a) => a.status === 'done').map((a) => a.url)
    parts.push(...imageUrls)
    const content = parts.join('\n')
    if (!content) return
    updateDraft('')
    setQuoteTarget(null)
    attachments.forEach((a) => a.previewUrl && URL.revokeObjectURL(a.previewUrl))
    setAttachments([])
    setTyping(false)
    await sendMessage(content)
  }
  const submit = (e) => { e.preventDefault(); send() }

  // Quote a message — shown as a preview above the composer; prepended on send.
  const startQuote = (m) => {
    setQuoteTarget(m)
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  // Forward a message: queue it (quoted, with original sender + time) and go to
  // the chat list to pick a target — the composer there gets prefilled.
  const forwardMessage = (m) => {
    const ago = m.createdAt ? ` · ${timeAgo(m.createdAt)}` : ''
    const header = `> Forwarded from @${m.sender}${ago}`
    const body = String(m.content || '').split('\n').map((l) => '> ' + l).join('\n')
    setShareDraft(`${header}\n${body}`)
    backToList()
  }

  // Close the per-message action menu on any outside click.
  useEffect(() => {
    if (!menuFor) return
    const close = () => setMenuFor(null)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [menuFor])

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
          // Snapie embeds images as plain-text URLs in the content — pull them
          // out to render inline, and drop them from the displayed text.
          const images = findImageUrls(m.content)
          let text = m.content || ''
          for (const url of images) text = text.split(url).join('')
          // A 3Speak/Hive link (post/comment/profile/community) → rich card;
          // drop its URL from the text.
          const postLink = parseChatLink(text)
          if (postLink) text = text.split(postLink.url).join('')
          text = text.trim()
          const hasBubble = !!text || images.length > 0
          const imageOnly = !text && images.length > 0
          return (
            <div key={m._id} className={`chat-msg${mine ? ' mine' : ''}`}>
              {!mine && conv.type !== 'dm' && (
                <span className="chat-msg-sender">@{m.sender}</span>
              )}
              <div className="chat-msg-row">
                <div className="chat-msg-content">
                  {hasBubble && (
                    <div className={`chat-msg-bubble${imageOnly ? ' image-only' : ''}`}>
                      {text && renderMessageText(text)}
                      {images.map((url) => (
                        <button
                          key={url}
                          type="button"
                          className="chat-image-btn"
                          onClick={(e) => { e.stopPropagation(); setLightboxUrl(url) }}
                        >
                          <img className="chat-msg-image" src={url} alt="" loading="lazy" />
                        </button>
                      ))}
                    </div>
                  )}
                  {postLink && <ChatLinkCard link={postLink} />}
                  {m.createdAt && (
                    <span className="chat-msg-time" title={new Date(m.createdAt).toLocaleString()}>
                      {timeAgo(m.createdAt)}
                    </span>
                  )}
                </div>
                <div className="chat-msg-actions">
                  <button
                    type="button"
                    className="chat-msg-menu-btn"
                    aria-label="Message actions"
                    onClick={(e) => { e.stopPropagation(); setMenuFor((cur) => (cur === m._id ? null : m._id)) }}
                  >
                    <MoreHorizontal size={15} />
                  </button>
                  {menuFor === m._id && (
                    <div className="chat-msg-menu">
                      <button type="button" onClick={(e) => { e.stopPropagation(); startQuote(m); setMenuFor(null) }}>
                        Quote
                      </button>
                      <button type="button" onClick={(e) => { e.stopPropagation(); forwardMessage(m); setMenuFor(null) }}>
                        Forward
                      </button>
                    </div>
                  )}
                </div>
              </div>
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
        {quoteTarget && (
          <div className="chat-quote-preview">
            <div className="chat-quote-preview-main">
              <span className="chat-quote-preview-label">Quoting @{quoteTarget.sender}</span>
              <blockquote className="chat-quote chat-quote-preview-text">{quoteSnippet(quoteTarget.content)}</blockquote>
            </div>
            <button type="button" className="chat-quote-preview-close" aria-label="Cancel quote" onClick={() => setQuoteTarget(null)}>
              <X size={16} />
            </button>
          </div>
        )}
        {attachments.length > 0 && (
          <div className="chat-attachments">
            {attachments.map((a) => (
              <div key={a.id} className={`chat-attachment chat-attachment-${a.status}`}>
                <img src={a.url || a.previewUrl} alt="" />
                {a.status === 'uploading' && (
                  <span className="chat-attachment-overlay"><Loader2 size={18} className="chat-spin" /></span>
                )}
                {a.status === 'error' && <span className="chat-attachment-overlay chat-attachment-err">!</span>}
                <button type="button" className="chat-attachment-x" aria-label="Remove image" onClick={() => removeAttachment(a.id)}>
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="chat-composer-row">
          <ChatComposerTools
            onPickEmoji={(e) => updateDraft((d) => d + e)}
            onPickGif={(url) => { sendMessage(url) }}
          />
          <EmojiTextInput
            className="chat-msg-input"
            placeholder="Type a message…"
            value={draft}
            onChange={(v) => { updateDraft(v); setTyping(v.length > 0) }}
            onSubmit={send}
            onPasteFiles={handlePasteFiles}
            inputRef={inputRef}
          />
          <button
            type="submit"
            disabled={
              attachments.some((a) => a.status === 'uploading') ||
              (!draft.trim() && !quoteTarget && !attachments.some((a) => a.status === 'done'))
            }
            aria-label="Send"
          >
            <Send size={18} />
          </button>
        </div>
      </form>

      <ChatImageLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />
    </div>
  )
}

export default function ChatPage() {
  const { ready, connecting, activeConversation, openDmWith, shareDraft } = useChat()
  const authenticated = useAppStore((s) => s.authenticated)
  const [searchParams, setSearchParams] = useSearchParams()

  // Deep link: /chat?dm=<username> (e.g. the "Write message" profile button)
  // opens that DM once chat is connected, then drops the param.
  useEffect(() => {
    const dm = searchParams.get('dm')
    if (!ready || !dm) return
    openDmWith(dm).catch(() => {})
    const next = new URLSearchParams(searchParams)
    next.delete('dm')
    setSearchParams(next, { replace: true })
  }, [ready, searchParams, openDmWith, setSearchParams])

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
          <Thread key={activeConversation._id} conv={activeConversation} />
        ) : (
          <div className="chat-empty chat-page-placeholder">
            {shareDraft ? 'Choose a chat to send to.' : 'Select a conversation, or start a new one.'}
          </div>
        )}
      </div>
    </div>
  )
}
