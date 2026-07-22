import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { normalizeSpeechLang } from '../utils/browser';

// Voice-driven teleprompter matcher.
//
// Tokenises a script into words and advances a "read so far" pointer as the
// Web Speech API reports what the speaker actually said. The prompter only ever
// moves FORWARD, and only when a recognised word matches an upcoming script word
// — so it scrolls when (and only when) the reader speaks a phrase from the
// script, which is exactly the behaviour asked for.

// How many upcoming script words a single spoken word may jump over. Lets the
// prompter tolerate one misread/skipped word without stalling, while staying
// small enough that unrelated chatter can't fast-forward the whole script.
const LOOKAHEAD = 6;
// Interim speech results grow as the engine refines them, so only the tail of
// each transcript is re-scanned — otherwise words the reader already passed get
// re-matched and over-advance the pointer.
const TAIL = 12;

const SpeechRecognitionImpl =
  typeof window !== 'undefined'
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : null;

// Lowercase + strip anything that isn't a letter/number (unicode-aware) so
// "Hello," and "hello" match, and punctuation-only tokens normalise to ''.
function normalize(w) {
  return w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}

function tokenize(text) {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((raw) => ({ text: raw, norm: normalize(raw) }));
}

export function useVoiceTeleprompter(scriptText, { lang } = {}) {
  const words = useMemo(() => tokenize(scriptText || ''), [scriptText]);
  const wordsRef = useRef(words);
  wordsRef.current = words;

  const [matchedCount, setMatchedCount] = useState(0);
  const matchedRef = useRef(0);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState('');
  // The latest thing the recognizer heard — surfaced so the UI can prove the
  // mic is live even when nothing matches the script yet.
  const [interimText, setInterimText] = useState('');

  const recognitionRef = useRef(null);
  const activeRef = useRef(false);

  const supported = !!SpeechRecognitionImpl;

  const setMatched = useCallback((n) => {
    matchedRef.current = n;
    setMatchedCount(n);
  }, []);

  // Skip over punctuation-only tokens (norm === '') so the pointer never stalls
  // on a lone "—" the reader can't say.
  const skipDead = useCallback((p, list) => {
    let i = p;
    while (i < list.length && !list[i].norm) i += 1;
    return i;
  }, []);

  const advance = useCallback((recWords) => {
    const list = wordsRef.current;
    let p = skipDead(matchedRef.current, list);
    for (const r of recWords) {
      if (!r || p >= list.length) break;
      const end = Math.min(p + LOOKAHEAD, list.length);
      for (let j = p; j < end; j += 1) {
        if (list[j].norm && list[j].norm === r) {
          p = skipDead(j + 1, list);
          break;
        }
      }
    }
    if (p > matchedRef.current) setMatched(p);
  }, [setMatched, skipDead]);

  const handleResult = useCallback((event) => {
    let transcript = '';
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      transcript += `${event.results[i][0].transcript} `;
    }
    const cleaned = transcript.trim();
    if (cleaned) {
      setInterimText(cleaned.length > 90 ? `…${cleaned.slice(-90)}` : cleaned);
      setError(''); // it's producing results — clear any transient error
    }
    const recWords = transcript
      .split(/\s+/)
      .map(normalize)
      .filter(Boolean)
      .slice(-TAIL);
    if (recWords.length) advance(recWords);
  }, [advance]);

  const start = useCallback(() => {
    if (!SpeechRecognitionImpl) { setError('unsupported'); return; }
    if (recognitionRef.current) return;
    setError('');
    const rec = new SpeechRecognitionImpl();
    rec.continuous = true;
    rec.interimResults = true;
    // A bare tag like "en" is rejected by Chrome's recognizer (→ zero results),
    // so always normalise to a region-qualified BCP-47 tag.
    rec.lang = normalizeSpeechLang(
      lang || (typeof navigator !== 'undefined' ? navigator.language : 'en-US'),
    );
    rec.onstart = () => setListening(true);
    rec.onresult = handleResult;
    rec.onerror = (e) => {
      // Surface the real reason so the UI isn't guessing. 'no-speech'/'aborted'
      // are transient (onend restarts); permission errors are terminal.
      setError(e.error || 'error');
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        activeRef.current = false;
      }
    };
    rec.onend = () => {
      // Mobile engines cut out on silence — restart while we're still recording.
      if (activeRef.current) {
        try { rec.start(); } catch { /* already restarting */ }
      } else {
        setListening(false);
      }
    };
    recognitionRef.current = rec;
    activeRef.current = true;
    try { rec.start(); } catch { /* double-start is harmless */ }
  }, [handleResult, lang]);

  const stop = useCallback(() => {
    activeRef.current = false;
    const rec = recognitionRef.current;
    recognitionRef.current = null;
    if (rec) {
      rec.onend = null; // don't let the restart loop revive it
      try { rec.stop(); } catch { /* ignore */ }
    }
    setListening(false);
  }, []);

  // Drive the matcher from an EXTERNAL transcript source (e.g. the self-hosted
  // STT WebSocket) instead of the browser Web Speech API. Same forward-only
  // matching; the caller owns the audio streaming.
  const ingestTranscript = useCallback((text) => {
    const cleaned = (text || '').trim();
    if (!cleaned) return;
    setInterimText(cleaned.length > 90 ? `…${cleaned.slice(-90)}` : cleaned);
    setError('');
    const recWords = cleaned.split(/\s+/).map(normalize).filter(Boolean).slice(-TAIL);
    if (recWords.length) advance(recWords);
  }, [advance]);

  const reset = useCallback(() => { setMatched(0); setInterimText(''); }, [setMatched]);

  useEffect(() => () => {
    activeRef.current = false;
    const rec = recognitionRef.current;
    recognitionRef.current = null;
    if (rec) { rec.onend = null; try { rec.stop(); } catch { /* ignore */ } }
  }, []);

  return {
    supported,
    listening,
    error,
    interimText,
    matchedCount,
    totalWords: words.length,
    words,
    start,
    stop,
    reset,
    ingestTranscript,
  };
}

export default useVoiceTeleprompter;
