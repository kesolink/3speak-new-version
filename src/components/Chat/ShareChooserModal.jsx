import { createPortal } from 'react-dom'
import { MessageCircle, Share2, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useChat } from '../../context/ChatContext'
import './shareChooser.scss'

/**
 * A small chooser shown when sharing a video/short: send it inside 3Speak Chat,
 * or fall back to the regular share (native share sheet / copy link).
 *
 * Props:
 *  - open: boolean
 *  - url: the shareable URL
 *  - title: optional title (prepended to the chat message)
 *  - onClose: () => void
 *  - onGeneralShare: () => void  — the page's existing share handler
 */
export default function ShareChooserModal({ open, url, title, onClose, onGeneralShare }) {
  const navigate = useNavigate()
  const { setShareDraft } = useChat()

  if (!open) return null

  const sendInChat = () => {
    // Just the link — the chat renders a rich card (title/author/thumb) from it.
    setShareDraft(url)
    onClose?.()
    navigate('/chat')
  }

  const generalShare = () => {
    onClose?.()
    onGeneralShare?.()
  }

  return createPortal(
    <div className="share-chooser-overlay" onClick={onClose}>
      <div className="share-chooser" role="dialog" aria-label="Share" onClick={(e) => e.stopPropagation()}>
        <button className="share-chooser-close" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>
        <h3 className="share-chooser-title">Share</h3>
        <button className="share-chooser-opt" onClick={sendInChat}>
          <MessageCircle size={20} />
          <span>
            <span className="share-chooser-opt-title">Send in 3Speak Chat</span>
            <span className="share-chooser-opt-sub">Message it to someone on 3Speak</span>
          </span>
        </button>
        <button className="share-chooser-opt" onClick={generalShare}>
          <Share2 size={20} />
          <span>
            <span className="share-chooser-opt-title">Share / copy link</span>
            <span className="share-chooser-opt-sub">Other apps, or copy the link</span>
          </span>
        </button>
      </div>
    </div>,
    document.body
  )
}
