import { useState, useEffect, useCallback } from 'react';
import { TRANSLATE_API_URL } from '../utils/config';
import { parseSrt } from '../utils/srtParser';

const SUBTITLE_LANG_KEY = '3speak-subtitle-lang';
const SUBTITLE_STYLE_KEY = '3speak-subtitle-style';

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
 * Hook for managing subtitle state on a video.
 * @param {string} author - Video author
 * @param {string} permlink - Video permlink
 */
export default function useSubtitles(author, permlink) {
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

        // Auto-select only if user previously chose a language
        const stored = localStorage.getItem(SUBTITLE_LANG_KEY);
        if (stored) {
          if (data.some(d => d.lang === stored)) {
            setSelectedLang(stored);
          } else if (data.some(d => d.lang === 'en')) {
            setSelectedLang('en');
          }
        }
      } catch (err) {
        console.error('[useSubtitles] Failed to check availability:', err);
        if (!cancelled) setAvailableLanguages(null);
      }
    })();

    return () => { cancelled = true; };
  }, [author, permlink]);

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
        const res = await fetch(
          `https://hotipfs-3speak-1.b-cdn.net/ipfs/${langEntry.cid}`
        );
        if (cancelled) return;
        const srtText = await res.text();
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
