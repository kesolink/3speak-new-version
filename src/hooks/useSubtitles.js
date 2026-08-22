import { useState, useEffect, useCallback } from 'react';
import { TRANSLATE_API_URL, CHECKER_URL } from '../utils/config';
import { parseSrt } from '../utils/srtParser';

const SUBTITLE_LANG_KEY = '3speak-subtitle-lang';
const SUBTITLE_STYLE_KEY = '3speak-subtitle-style';

// The CDN is fronted by a specific hot-pinning node — content not yet
// propagated to IT 500s ("block was not found locally") even though
// ipfs.3speak.tv already serves it fine. Try the CDN first (fast, direct);
// on failure go through OUR OWN backend rather than fetching ipfs.3speak.tv
// straight from the browser — that gateway sends `access-control-allow-origin`
// TWICE on every response, which every real browser rejects outright
// ("Failed to fetch", confirmed live) even though the value itself is fine.
// The proxy fetches server-to-server (no CORS involved) and re-serves it
// with a single, correct header via our own cors() middleware.
async function fetchSrtWithFallback(cid) {
  try {
    const res = await fetch(`https://hotipfs-3speak-1.b-cdn.net/ipfs/${cid}`);
    if (res.ok) return await res.text();
  } catch { /* fall through to the proxy */ }

  const res = await fetch(`${CHECKER_URL}/subtitle-proxy/${cid}`);
  if (!res.ok) throw new Error(`subtitle-proxy responded ${res.status}`);
  return await res.text();
}

const DEFAULT_STYLE = {
  fontSize: 'medium',
  color: '#ffffff',
  bgOpacity: 0.7,
  fontFamily: 'sans-serif',
  borderWidth: 0,
  borderColor: '#000000',
};

function loadStyle() {
  try {
    const stored = localStorage.getItem(SUBTITLE_STYLE_KEY);
    if (stored) return { ...DEFAULT_STYLE, ...JSON.parse(stored) };
  } catch {}
  return DEFAULT_STYLE;
}

// Module-level cache: "author/permlink/lang" → parsed cues array
const subtitleCache = {};

/**
 * The language list for a video, or [] when it has no subtitles.
 * Shared with the transcript panel, which needs the same list but must NOT
 * drive the on-video overlay (that follows the viewer's own CC choice).
 */
export async function listSubtitleLanguages(author, permlink) {
  if (!author || !permlink || author === 'unknown') return [];
  try {
    const res = await fetch(`${TRANSLATE_API_URL}/subtitles/${author}/${permlink}`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

/**
 * Parsed cues for one language entry ({ lang, cid }), memoised per video+lang.
 * Both the overlay and the transcript read through this, so a viewer who turns
 * captions on after reading the transcript pays no second fetch.
 */
export async function loadSubtitleCues(author, permlink, langEntry) {
  if (!langEntry?.cid) return [];
  const cacheKey = `${author}/${permlink}/${langEntry.lang}`;
  if (subtitleCache[cacheKey]) return subtitleCache[cacheKey];
  const srtText = await fetchSrtWithFallback(langEntry.cid);
  const parsed = parseSrt(srtText);
  subtitleCache[cacheKey] = parsed;
  return parsed;
}

export { SUBTITLE_LANG_KEY };

/**
 * Hook for managing subtitle state on a video.
 * @param {string} author - Video author
 * @param {string} permlink - Video permlink
 */
export default function useSubtitles(author, permlink, { autoEnglish = false } = {}) {
  const [availableLanguages, setAvailableLanguages] = useState(null);
  const [selectedLang, setSelectedLang] = useState(null);
  const [cues, setCues] = useState([]);
  const [loading, setLoading] = useState(false);

  // Fetch available subtitles when author/permlink changes
  useEffect(() => {
    if (!author || !permlink || author === 'unknown') {
      setAvailableLanguages(null);
      setSelectedLang(null);
      setCues([]);
      return;
    }

    let cancelled = false;
    setAvailableLanguages(null);
    setSelectedLang(null);
    setCues([]);

    (async () => {
      try {
        const res = await fetch(
          `${TRANSLATE_API_URL}/subtitles/${author}/${permlink}`
        );
        if (cancelled) return;
        if (!res.ok) {
          setAvailableLanguages(null);
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        if (!Array.isArray(data) || data.length === 0) {
          setAvailableLanguages(null);
          return;
        }
        setAvailableLanguages(data);

        // Auto-select the user's stored language; or, when `autoEnglish` is set
        // (e.g. the hover preview), default to English if present even without a
        // stored preference. setSelectedLang here does NOT persist a choice.
        const stored = localStorage.getItem(SUBTITLE_LANG_KEY);
        if (stored && data.some(d => d.lang === stored)) {
          setSelectedLang(stored);
        } else if ((autoEnglish || stored) && data.some(d => d.lang === 'en')) {
          setSelectedLang('en');
        }
      } catch (err) {
        console.error('[useSubtitles] Failed to check availability:', err);
        if (!cancelled) setAvailableLanguages(null);
      }
    })();

    return () => { cancelled = true; };
  }, [author, permlink, autoEnglish]);

  // Fetch + parse SRT when selectedLang changes
  useEffect(() => {
    if (!selectedLang || !availableLanguages) {
      setCues([]);
      return;
    }

    const langEntry = availableLanguages.find(l => l.lang === selectedLang);
    if (!langEntry) {
      setCues([]);
      return;
    }

    const cacheKey = `${author}/${permlink}/${selectedLang}`;
    if (subtitleCache[cacheKey]) {
      setCues(subtitleCache[cacheKey]);
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const srtText = await fetchSrtWithFallback(langEntry.cid);
        if (cancelled) return;
        const parsed = parseSrt(srtText);
        console.log('[useSubtitles] Parsed', parsed.length, 'cues from', langEntry.cid);
        subtitleCache[cacheKey] = parsed;
        setCues(parsed);
      } catch (err) {
        console.error('[useSubtitles] Failed to fetch SRT:', err);
        if (!cancelled) setCues([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [selectedLang, availableLanguages, author, permlink]);

  // Language selection handler (persists to localStorage)
  const selectLanguage = useCallback((lang) => {
    setSelectedLang(lang);
    if (lang) {
      localStorage.setItem(SUBTITLE_LANG_KEY, lang);
    } else {
      localStorage.removeItem(SUBTITLE_LANG_KEY);
    }
  }, []);

  // Subtitle style (fontSize, color, bgOpacity)
  const [subtitleStyle, setSubtitleStyle] = useState(loadStyle);

  const updateStyle = useCallback((partial) => {
    setSubtitleStyle(prev => {
      const next = { ...prev, ...partial };
      localStorage.setItem(SUBTITLE_STYLE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return {
    availableLanguages,
    selectedLang,
    selectLanguage,
    cues,
    loading,
    subtitleStyle,
    updateStyle,
  };
}
