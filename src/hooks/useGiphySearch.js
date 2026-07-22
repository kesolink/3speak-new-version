import { useState, useEffect, useRef, useCallback } from 'react'

// Giphy API key — set VITE_GIPHY_API_KEY per environment (client-side key, baked
// into the bundle). Without it, GIF search returns nothing. Shared with the chat
// composer (see components/Chat/ChatComposerTools.jsx).
const GIPHY_KEY = import.meta.env.VITE_GIPHY_API_KEY || ''

// Pull a plain `.gif` URL out of a Giphy result. We drop the query string so the
// URL ends in `.gif` — that lets the Hive markdown renderer embed it inline.
export function normalizeGifUrl(g) {
  const url = g?.images?.fixed_height?.url || g?.images?.original?.url || ''
  return url ? url.split('?')[0] : ''
}

/**
 * Drives a Giphy trending/search list for a picker popover.
 * Pass `active` (whether the picker is open); it loads trending on open and
 * debounces the query as it changes. A request counter guards against an earlier
 * (trending) response overwriting a later (search) one.
 */
export default function useGiphySearch(active) {
  const [query, setQuery] = useState('')
  const [gifs, setGifs] = useState([])
  const [loading, setLoading] = useState(false)
  const reqRef = useRef(0)

  const load = useCallback(async (q) => {
    const id = ++reqRef.current
    setLoading(true)
    try {
      const endpoint = q.trim()
        ? `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_KEY}&q=${encodeURIComponent(q.trim())}&limit=24&rating=pg-13`
        : `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_KEY}&limit=24&rating=pg-13`
      const res = await fetch(endpoint)
      const data = await res.json()
      if (id !== reqRef.current) return // a newer request superseded this one
      setGifs(Array.isArray(data?.data) ? data.data : [])
    } catch {
      if (id === reqRef.current) setGifs([])
    } finally {
      if (id === reqRef.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!active) return
    const t = setTimeout(() => load(query), query.trim() ? 350 : 0)
    return () => clearTimeout(t)
  }, [active, query, load])

  return { query, setQuery, gifs, loading }
}
