import { useState, useRef, useEffect } from 'react'
import { Smile, Loader2 } from 'lucide-react'
import EmojiPicker from 'emoji-picker-react'
import { useAppStore } from '../../../lib/store'
import useGiphySearch, { normalizeGifUrl } from '../../../hooks/useGiphySearch'
import './EmojiGifPicker.scss'

/**
 * Emoji + GIF picker for comment/reply composers — the same experience as the
 * chat composer (emoji-picker-react + Giphy). Insertion is delegated to the
 * parent so it can drop the value into its own draft at the caret.
 *
 * Props:
 *  - onPickEmoji(emojiChar)  → insert an emoji
 *  - onPickGif(gifUrl)       → insert a GIF (plain `.gif` URL, ready for markdown)
 *  - align       'left' | 'right'  horizontal anchor of the popover (default 'left')
 *  - openDirection 'up' | 'down'   vertical direction the popover opens (default 'up')
 *  - disabled    hide/disable the buttons
 *  - className   extra classes on the wrapper
 */
export default function EmojiGifPicker({
  onPickEmoji,
  onPickGif,
  align = 'left',
  openDirection = 'up',
  disabled = false,
  className = '',
}) {
  const [open, setOpen] = useState(null) // 'emoji' | 'gif' | null
  const wrapRef = useRef(null)
  const appTheme = useAppStore((s) => s.theme)
  const { query, setQuery, gifs, loading } = useGiphySearch(open === 'gif')

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return
    const onDoc = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(null) }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(null) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey) }
  }, [open])

  const pickGif = (g) => {
    const url = normalizeGifUrl(g)
    if (url) { onPickGif?.(url); setOpen(null) }
  }

  if (disabled) return null

  const popClass = `egp-popover egp-${align} egp-open-${openDirection}`

  return (
    <div className={`egp-tools ${className}`} ref={wrapRef}>
      <button
        type="button"
        className={`egp-btn${open === 'emoji' ? ' active' : ''}`}
        onClick={() => setOpen(open === 'emoji' ? null : 'emoji')}
        aria-label="Emoji"
        title="Emoji"
      >
        <Smile size={18} />
      </button>
      <button
        type="button"
        className={`egp-btn egp-gif-btn${open === 'gif' ? ' active' : ''}`}
        onClick={() => setOpen(open === 'gif' ? null : 'gif')}
        aria-label="GIF"
        title="GIF"
      >
        GIF
      </button>

      {open === 'emoji' && (
        <div className={`${popClass} egp-emoji-popover`}>
          <EmojiPicker
            onEmojiClick={(d) => onPickEmoji?.(d.emoji)}
            theme={appTheme === 'light' ? 'light' : 'dark'}
            lazyLoadEmojis
            width="100%"
            height={380}
            previewConfig={{ showPreview: false }}
            searchPlaceholder="Search emoji"
          />
        </div>
      )}

      {open === 'gif' && (
        <div className={`${popClass} egp-gif-popover`}>
          <input
            className="egp-gif-search"
            type="text"
            placeholder="Search GIFs…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          <div className="egp-gif-grid">
            {loading && <div className="egp-gif-loading"><Loader2 size={20} className="egp-spin" /></div>}
            {!loading && gifs.length === 0 && <div className="egp-gif-empty">No GIFs found.</div>}
            {!loading && gifs.map((g) => (
              <button key={g.id} type="button" className="egp-gif-item" onClick={() => pickGif(g)}>
                <img src={g.images?.fixed_height?.url || g.images?.fixed_height_small?.url} alt={g.title || 'gif'} loading="lazy" />
              </button>
            ))}
          </div>
          <div className="egp-gif-attribution">Powered by GIPHY</div>
        </div>
      )}
    </div>
  )
}
