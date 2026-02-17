import { useRef, useState, useCallback } from 'react';
import { translateText, getTargetLanguage } from '../utils/translate';

export default function useTranslation() {
  const cacheRef = useRef({}); // key: `${permlink}:${lang}` → translated text
  const [translating, setTranslating] = useState({}); // permlink → true

  const translate = useCallback(async (permlink, text, langCode) => {
    const lang = langCode || getTargetLanguage();
    const key = `${permlink}:${lang}`;

    if (cacheRef.current[key]) return cacheRef.current[key];

    setTranslating(prev => ({ ...prev, [permlink]: true }));
    try {
      const result = await translateText(text, lang);
      cacheRef.current[key] = result;
      return result;
    } finally {
      setTranslating(prev => {
        const next = { ...prev };
        delete next[permlink];
        return next;
      });
    }
  }, []);

  const getTranslation = useCallback((permlink) => {
    const lang = getTargetLanguage();
    return cacheRef.current[`${permlink}:${lang}`] || null;
  }, []);

  const clearTranslation = useCallback((permlink) => {
    // Remove all cached translations for this permlink
    for (const k of Object.keys(cacheRef.current)) {
      if (k.startsWith(`${permlink}:`)) {
        delete cacheRef.current[k];
      }
    }
  }, []);

  return { translate, getTranslation, clearTranslation, translating };
}
