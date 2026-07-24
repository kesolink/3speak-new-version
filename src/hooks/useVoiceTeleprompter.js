import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createMatcher, tokenize, normalize } from '../utils/scriptMatcher';

// Voice-driven teleprompter.
//
// All the matching logic lives in utils/scriptMatcher.js (pure, no React) so it
// can be exercised directly — this hook is just the recognizer plumbing and the
// React state around it.

const SpeechRecognitionImpl =
  typeof window !== 'undefined'
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : null;

export function useVoiceTeleprompter(scriptText, { lang } = {}) {
  const words = useMemo(() => tokenize(scriptText || ''), [scriptText]);

  const matcherRef = useRef(null);
  if (!matcherRef.current) matcherRef.current = createMatcher(words);
  matcherRef.current.setWords(words);

  const [matchedCount, setMatchedCount] = useState(0);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState('');
  const [interimText, setInterimText] = useState('');

  // How many words of the CURRENT utterance we've already consumed. Recognizers
  // resend the whole utterance on every partial, so without this we'd re-match
  // already-spoken words against upcoming script text and race ahead.
  const consumedRef = useRef(0);

  const recognitionRef = useRef(null);
  const activeRef = useRef(false);

  const supported = !!SpeechRecognitionImpl;

  // A changed script invalidates the pointer: the old position would land
  // somewhere in the middle of the new text. Start from the top instead.
  useEffect(() => {
    matcherRef.current.reset();
    setMatchedCount(0);
    setInterimText('');
    consumedRef.current = 0;
  }, [scriptText]);

  // Shared ingestion for BOTH sources (Web Speech + server STT). `isFinal` closes
  // the utterance so the next one starts counting from zero.
  const ingestCore = useCallback((text, isFinal) => {
    const cleaned = (text || '').trim();
    if (cleaned) {
      setInterimText(cleaned.length > 90 ? `…${cleaned.slice(-90)}` : cleaned);
      setError('');
    }
    const spoken = cleaned.split(/\s+/).map(normalize).filter(Boolean);
    // Only the words we haven't already acted on — never re-scan the whole tail.
    const fresh = spoken.slice(consumedRef.current);
    if (fresh.length) setMatchedCount(matcherRef.current.advance(fresh));
    consumedRef.current = isFinal ? 0 : spoken.length;
  }, []);

  /** Drive the matcher from an external transcript source (the STT WebSocket). */
  const ingestTranscript = useCallback(
    (text, isFinal = false) => ingestCore(text, isFinal),
    [ingestCore],
  );

  const handleResult = useCallback((event) => {
    const res = event.results[event.results.length - 1];
    if (!res) return;
    ingestCore(res[0]?.transcript || '', !!res.isFinal);
  }, [ingestCore]);

  const start = useCallback(() => {
    if (!SpeechRecognitionImpl) { setError('unsupported'); return; }
    if (recognitionRef.current) return;
    setError('');
    consumedRef.current = 0;
    const rec = new SpeechRecognitionImpl();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = lang || 'en-US';
    rec.onstart = () => setListening(true);
    rec.onresult = handleResult;
    rec.onerror = (e) => {
      setError(e.error || 'error');
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        activeRef.current = false;
      }
    };
    rec.onend = () => {
      consumedRef.current = 0; // a restart begins a fresh utterance
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
      rec.onend = null;
      try { rec.stop(); } catch { /* ignore */ }
    }
    setListening(false);
  }, []);

  const reset = useCallback(() => {
    matcherRef.current.reset();
    setMatchedCount(0);
    setInterimText('');
    consumedRef.current = 0;
  }, []);

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
