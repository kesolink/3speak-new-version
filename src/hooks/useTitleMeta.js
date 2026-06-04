import { useState, useEffect, useCallback } from 'react';
import { TRANSLATE_API_URL } from '../utils/config';

// Remembered title-language preference (independent of the subtitle language).
const TITLE_LANG_KEY = '3speak-title-lang';

/**
 * Fetches the translation "meta" for a video from the translator service:
 *   GET {TRANSLATE_API_URL}/subtitles/{author}/{permlink}/meta
 *   → { summary_en, title_translations: { <lang>: title }, meta_cid }
 *
 * Exposes the available title languages, the user's remembered language choice
 * (applied automatically whenever this video has a translation for it), the
 * resulting translated title, and the summary. Videos without translations
 * simply 404 → everything comes back empty and callers hide the UI.
 */
export default function useTitleMeta(author, permlink) {
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedLang, setSelectedLang] = useState(() => {
    try {
      return localStorage.getItem(TITLE_LANG_KEY) || null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (!author || !permlink) {
      setMeta(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setMeta(null);
    (async () => {
      try {
        const res = await fetch(`${TRANSLATE_API_URL}/subtitles/${author}/${permlink}/meta`);
        if (cancelled) return;
        if (!res.ok) {
          setMeta(null);
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        setMeta(data && (data.title_translations || data.summary_en) ? data : null);
      } catch {
        if (!cancelled) setMeta(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [author, permlink]);

  const titleTranslations = meta?.title_translations || null;
  const availableLangs = titleTranslations ? Object.keys(titleTranslations) : [];

  // The remembered preference only applies when this video actually has a
  // translation for it — otherwise we fall back to the original title.
  const effectiveLang =
    selectedLang && availableLangs.includes(selectedLang) ? selectedLang : null;
  const translatedTitle = effectiveLang ? titleTranslations[effectiveLang] : null;

  // Prefer a summary in the chosen language; the backend currently only ships
  // English (summary_en), but this auto-upgrades if localized summaries appear.
  const summary = meta
    ? meta[`summary_${effectiveLang || 'en'}`] || meta.summary_en || null
    : null;

  const selectLanguage = useCallback((lang) => {
    setSelectedLang(lang);
    try {
      if (lang) localStorage.setItem(TITLE_LANG_KEY, lang);
      else localStorage.removeItem(TITLE_LANG_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  return {
    hasTitleTranslations: availableLangs.length > 0,
    availableLangs,
    selectedLang: effectiveLang,
    selectLanguage,
    translatedTitle,
    summary,
    hasSummary: !!summary,
    loading,
  };
}
