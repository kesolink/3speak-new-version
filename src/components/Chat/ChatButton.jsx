import { NavLink } from 'react-router-dom'
import { MessageCircle } from 'lucide-react'
import { useServerUnread } from '../../hooks/useServerUnread'
import { useChat } from '../../context/ChatContext'
import './ChatButton.scss'

// Split out so the unread subscription only mounts once chat is connected —
// the SDK hook keys its subscription on the client, not on auth state, so we
// remount it (via conditional render) when `ready` flips.
function UnreadDot() {
  // Server-truth, never a locally accumulated number (see useServerUnread).
  const { unreadCount } = useServerUnread()
  if (!unreadCount) return null
  return (
    <span className="chat-nav-badge" aria-hidden="true">
      {unreadCount > 9 ? '9+' : unreadCount}
    </span>
  )
}

export default function ChatButton() {
  const { ready } = useChat()

  return (
    <NavLink
      to="/chat"
      className={({ isActive }) => `chat-nav-btn${isActive ? ' open' : ''}`}
      aria-label="Chat"
      title="Chat"
    >
      <MessageCircle size={21} />
      {ready && <UnreadDot />}
    </NavLink>
  )
}
