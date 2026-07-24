// Chromium detection for the experimental teleprompter.
//
// The voice-scroll relies on the Web Speech API, which is only dependable on
// true Chromium engines (Chrome/Edge/Brave/Opera on Android + desktop). Firefox
// has no Web Speech API at all, and every iOS browser is WebKit under the hood
// (its webkitSpeechRecognition is flaky), so we gate the feature to Chromium.
export function isChromium() {
  if (typeof navigator === 'undefined') return false;

  // UA Client Hints — only real Chromium exposes this (not Safari/Firefox, and
  // not iOS browsers), so it's the cleanest positive signal.
  const brands = navigator.userAgentData?.brands;
  if (Array.isArray(brands)) {
    return brands.some((b) => /Chromium/i.test(b.brand));
  }

  // Fallback for Chromium builds without UA-CH: exclude iOS (all WebKit) and
  // Firefox, then accept the Chromium family.
  const ua = navigator.userAgent || '';
  if (/\bFirefox\b|FxiOS|CriOS|EdgiOS|OPiOS/.test(ua)) return false;
  if (/iPhone|iPad|iPod/.test(ua)) return false;
  return /\bChrome\/|\bChromium\/|\bEdg\/|\bOPR\//.test(ua);
}

// Best-effort BCP-47 tag for speech recognition. A bare code like "en" is
// rejected by Chrome's recognizer, so promote common ones to a region.
export function normalizeSpeechLang(input) {
  const raw = (input || '').trim();
  if (/-/.test(raw)) return raw; // already has a region (en-US, pt-BR, …)
  const map = {
    en: 'en-US', de: 'de-DE', es: 'es-ES', fr: 'fr-FR', pt: 'pt-BR', it: 'it-IT',
    nl: 'nl-NL', ru: 'ru-RU', hi: 'hi-IN', ar: 'ar-SA', ja: 'ja-JP', ko: 'ko-KR',
    zh: 'zh-CN', pl: 'pl-PL', tr: 'tr-TR', sv: 'sv-SE',
  };
  return map[raw.toLowerCase()] || 'en-US';
}
