import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  X, Camera, Mic, RotateCcw, Check, Download, GripHorizontal, ChevronLeft, ChevronDown, ChevronUp, RotateCw, Sliders,
} from 'lucide-react';
import { useEmbedUpload } from '../../context/EmbedUploadContext';
import { useVoiceTeleprompter } from '../../hooks/useVoiceTeleprompter';
import { generateVideoThumbnails } from '../../utils/videoThumbnails';
import { ENABLE_CAMERA_RECORD, SHORTS_MAX_DURATION_SEC, STT_WS_URL } from '../../utils/config';
import { normalizeSpeechLang } from '../../utils/browser';
import { createSttStream } from '../../utils/sttClient';
import './EmbedCameraRecord.scss';

const SETTINGS_KEY = 'tp-overlay-settings';
const BOX_KEY = 'tp-overlay-box';
const DEFAULT_SETTINGS = { fontSize: 26, fontColor: '#ffffff', bgColor: '#000000', bgOpacity: 0.5, lang: 'en-US' };
const MIN_W = 150;
const MIN_H = 90;

const LANG_OPTIONS = [
  { value: 'en-US', label: 'English (US)' },
  { value: 'en-GB', label: 'English (UK)' },
  { value: 'es-ES', label: 'Español' },
  { value: 'pt-BR', label: 'Português (BR)' },
  { value: 'fr-FR', label: 'Français' },
  { value: 'de-DE', label: 'Deutsch' },
  { value: 'it-IT', label: 'Italiano' },
  { value: 'nl-NL', label: 'Nederlands' },
  { value: 'ru-RU', label: 'Русский' },
  { value: 'hi-IN', label: 'हिन्दी' },
  { value: 'ar-SA', label: 'العربية' },
  { value: 'ja-JP', label: '日本語' },
  { value: 'ko-KR', label: '한국어' },
  { value: 'zh-CN', label: '中文' },
];

function pickMimeType() {
  const candidates = ['video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  if (typeof MediaRecorder === 'undefined') return '';
  for (const c of candidates) {
    try { if (MediaRecorder.isTypeSupported(c)) return c; } catch { /* ignore */ }
  }
  return '';
}

function fmtTime(totalSec) {
  const s = Math.max(0, Math.floor(totalSec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function shouldMirror(track) {
  try { return track?.getSettings?.().facingMode !== 'environment'; } catch { return true; }
}

function speechErrorLabel(err) {
  switch (err) {
    case 'network': return 'Speech service unreachable — recognition needs an internet connection (Chrome sends audio to Google to transcribe).';
    case 'audio-capture': return 'No audio reached recognition — the mic may be busy. Try a headset.';
    case 'not-allowed':
    case 'service-not-allowed': return 'Microphone permission is blocked for speech recognition.';
    case 'no-speech':
    case 'aborted':
    case '': return '';
    default: return `Speech recognition error: ${err}`;
  }
}

function hexToRgba(hex, a) {
  const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex || '');
  if (!m) return `rgba(0,0,0,${a})`;
  return `rgba(${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)},${a})`;
}

function loadJson(key, fallback) {
  try {
    const raw = JSON.parse(localStorage.getItem(key) || 'null');
    return raw && typeof raw === 'object' ? { ...fallback, ...raw } : fallback;
  } catch { return fallback; }
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const winW = () => (typeof window !== 'undefined' ? window.innerWidth : 375);
const winH = () => (typeof window !== 'undefined' ? window.innerHeight : 667);

// Reusable move-only draggable, position persisted. `handleProps` go on the drag
// grip, `surfaceProps` on the moving element (which the grip's pointer is captured
// to). Position is applied via direct DOM during the drag, committed on release.
function useMovable(storageKey, makeDefault) {
  const [pos, setPos] = useState(() => loadJson(storageKey, makeDefault()));
  const ref = useRef(null);
  const drag = useRef(null);
  const posRef = useRef(pos);
  posRef.current = pos;
  const onPointerDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    try { ref.current?.setPointerCapture?.(e.pointerId); } catch { /* ignore */ }
    drag.current = { sx: e.clientX, sy: e.clientY, ox: posRef.current.x, oy: posRef.current.y, cur: { ...posRef.current } };
  };
  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d) return;
    const el = ref.current;
    const w = el ? el.offsetWidth : 0;
    const h = el ? el.offsetHeight : 0;
    const x = clamp(d.ox + (e.clientX - d.sx), 4, window.innerWidth - w - 4);
    const y = clamp(d.oy + (e.clientY - d.sy), 4, window.innerHeight - h - 4);
    d.cur = { x, y };
    if (el) { el.style.left = `${x}px`; el.style.top = `${y}px`; }
  };
  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (d) { setPos(d.cur); try { localStorage.setItem(storageKey, JSON.stringify(d.cur)); } catch { /* ignore */ } }
  };
  // Rotating the phone swaps viewport dimensions — re-clamp so a saved position
  // (e.g. bottom-right in portrait) doesn't end up off-screen in landscape.
  useEffect(() => {
    const onResize = () => {
      const el = ref.current;
      const w = el ? el.offsetWidth : 0;
      const h = el ? el.offsetHeight : 0;
      setPos((p) => {
        const nx = clamp(p.x, 4, Math.max(4, window.innerWidth - w - 4));
        const ny = clamp(p.y, 4, Math.max(4, window.innerHeight - h - 4));
        if (nx === p.x && ny === p.y) return p;
        const np = { x: nx, y: ny };
        try { localStorage.setItem(storageKey, JSON.stringify(np)); } catch { /* ignore */ }
        return np;
      });
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [storageKey]);
  return { pos, ref, handleProps: { onPointerDown }, surfaceProps: { onPointerMove, onPointerUp, onPointerCancel: onPointerUp } };
}

function EmbedCameraRecord() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    fromStories, setFromStories, setVideoFile, setPrevVideoFile,
    setVideoDuration, setGeneratedThumbnail, setVideoMode,
  } = useEmbedUpload();

  useEffect(() => {
    const from = new URLSearchParams(location.search).get('from');
    setFromStories(from === 'stories' || from === 'shorts');
  }, [location.search, setFromStories]);

  const rootRef = useRef(null);
  const previewRef = useRef(null);
  const stageRef = useRef(null);
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const audioTrackRef = useRef(null);
  const sttRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const elapsedRef = useRef(0);
  const shortsCap = fromStories ? SHORTS_MAX_DURATION_SEC : Infinity;

  const [phase, setPhase] = useState('script'); // script → setup → recording → review
  const [script, setScript] = useState('');
  const [settings, setSettings] = useState(() => loadJson(SETTINGS_KEY, {
    ...DEFAULT_SETTINGS,
    lang: normalizeSpeechLang(typeof navigator !== 'undefined' ? navigator.language : 'en-US'),
  }));
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [devices, setDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [mirror, setMirror] = useState(true);
  const [camError, setCamError] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [recordedUrl, setRecordedUrl] = useState(null);
  const [finishing, setFinishing] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [sttStatus, setSttStatus] = useState(''); // '', 'connecting', 'connected', 'error:<msg>', 'closed'

  // Menu collapse state, persisted.
  const [menuCollapsed, setMenuCollapsed] = useState(() => !!loadJson('tp-menu-collapsed', { v: false }).v);
  useEffect(() => { try { localStorage.setItem('tp-menu-collapsed', JSON.stringify({ v: menuCollapsed })); } catch { /* ignore */ } }, [menuCollapsed]);

  // Draggable widgets (positions persisted).
  const menu = useMovable('tp-menu-pos', () => ({ x: 12, y: 70 }));
  const settingsMov = useMovable('tp-settings-pos', () => ({ x: 12, y: 120 }));

  // Orientation: shorts (?from=stories) → portrait; longform → landscape. Follows
  // the source until the user flips it, then sticks.
  const [orientation, setOrientation] = useState(null);
  const orientationTouched = useRef(false);
  const eff = orientation || (fromStories ? 'portrait' : 'landscape');
  const orientationRef = useRef(eff);
  orientationRef.current = eff;
  useEffect(() => {
    if (!orientationTouched.current) setOrientation(fromStories ? 'portrait' : 'landscape');
  }, [fromStories]);

  const [viewportPortrait, setViewportPortrait] = useState(
    () => (typeof window !== 'undefined' ? window.matchMedia('(orientation: portrait)').matches : true),
  );
  useEffect(() => {
    const mql = window.matchMedia('(orientation: portrait)');
    const on = (e) => setViewportPortrait(e.matches);
    mql.addEventListener('change', on);
    return () => mql.removeEventListener('change', on);
  }, []);

  const mimeType = useMemo(() => pickMimeType(), []);
  const recordingSupported = typeof MediaRecorder !== 'undefined';

  const tp = useVoiceTeleprompter(script, { lang: settings.lang });
  const currentWordRef = useRef(null);

  useEffect(() => { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* ignore */ } }, [settings]);
  const setSetting = (patch) => setSettings((s) => ({ ...s, ...patch }));

  useEffect(() => {
    if (phase !== 'recording') return;
    currentWordRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [tp.matchedCount, phase]);

  // ---- draggable + resizable teleprompter box ------------------------------
  const boxRef = useRef(null);
  const dragRef = useRef(null);
  const [box, setBox] = useState(() => {
    const saved = loadJson(BOX_KEY, null);
    return saved && saved.w ? saved : null;
  });
  const boxRef2 = useRef(box);
  boxRef2.current = box;

  useEffect(() => {
    if ((phase === 'setup' || phase === 'recording') && !boxRef2.current && stageRef.current) {
      const s = stageRef.current;
      setBox({
        x: Math.round(s.clientWidth * 0.05),
        y: Math.round(s.clientHeight * 0.06),
        w: Math.round(s.clientWidth * 0.9),
        h: Math.round(s.clientHeight * 0.38),
      });
    }
  }, [phase]);

  const applyBoxStyle = (r) => {
    const el = boxRef.current;
    if (!el) return;
    el.style.left = `${r.x}px`;
    el.style.top = `${r.y}px`;
    el.style.width = `${r.w}px`;
    el.style.height = `${r.h}px`;
  };

  const beginDrag = (mode) => (e) => {
    if (!boxRef2.current) return;
    e.preventDefault();
    e.stopPropagation();
    try { boxRef.current?.setPointerCapture?.(e.pointerId); } catch { /* ignore */ }
    dragRef.current = { mode, startX: e.clientX, startY: e.clientY, orig: { ...boxRef2.current }, rect: { ...boxRef2.current } };
  };

  const onBoxPointerMove = (e) => {
    const d = dragRef.current;
    if (!d) return;
    const s = stageRef.current;
    const maxW = s ? s.clientWidth : window.innerWidth;
    const maxH = s ? s.clientHeight : window.innerHeight;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    let r;
    if (d.mode === 'move') {
      r = { ...d.orig, x: clamp(d.orig.x + dx, 0, maxW - d.orig.w), y: clamp(d.orig.y + dy, 0, maxH - d.orig.h) };
    } else {
      r = { ...d.orig, w: clamp(d.orig.w + dx, MIN_W, maxW - d.orig.x), h: clamp(d.orig.h + dy, MIN_H, maxH - d.orig.y) };
    }
    d.rect = r;
    applyBoxStyle(r);
  };

  const endDrag = () => {
    const d = dragRef.current;
    dragRef.current = null;
    if (d) {
      setBox(d.rect);
      try { localStorage.setItem(BOX_KEY, JSON.stringify(d.rect)); } catch { /* ignore */ }
    }
  };

  // ---- draggable record/stop button (tap = action, drag = move) ------------
  const recordRef = useRef(null);
  const recordDrag = useRef(null);
  const [recordPos, setRecordPos] = useState(() => loadJson('tp-record-pos', { x: winW() - 84, y: winH() - 168 }));
  const recordPosRef = useRef(recordPos);
  recordPosRef.current = recordPos;

  // ---- camera --------------------------------------------------------------
  const stopStream = useCallback(() => {
    const s = streamRef.current;
    streamRef.current = null;
    if (s) s.getTracks().forEach((t) => t.stop());
    if (audioTrackRef.current) { try { audioTrackRef.current.stop(); } catch { /* ignore */ } audioTrackRef.current = null; }
  }, []);

  const startCamera = useCallback(async (deviceId) => {
    setCamError('');
    const hadStream = !!streamRef.current;
    stopStream();
    if (hadStream) await new Promise((r) => setTimeout(r, 150));
    // VIDEO-ONLY: holding a getUserMedia audio track starves the Web Speech
    // recognizer (it opens its own capture, gets silence, raises no error). The
    // mic stays free so recognition can grab it; the recording's audio track is
    // added later, after recognition is live. `aspectRatio` is a soft hint only.
    const ratio = orientationRef.current === 'landscape' ? 16 / 9 : 9 / 16;
    const videoBase = deviceId ? { deviceId: { exact: deviceId } } : { facingMode: { ideal: 'user' } };
    const constraints = { audio: false, video: { ...videoBase, aspectRatio: { ideal: ratio } } };
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (previewRef.current) {
        previewRef.current.srcObject = stream;
        previewRef.current.play?.().catch(() => {});
      }
      const vtrack = stream.getVideoTracks()[0];
      setMirror(shouldMirror(vtrack));
      const openedId = vtrack?.getSettings?.().deviceId;
      if (openedId) setSelectedDeviceId(openedId);
      const list = await navigator.mediaDevices.enumerateDevices();
      setDevices(list.filter((d) => d.kind === 'videoinput' && d.deviceId));
    } catch (err) {
      setCamError(
        err?.name === 'NotAllowedError'
          ? 'Camera access was denied. Allow it and reload to record.'
          : 'Could not open the camera. Another app may be using it.',
      );
    }
  }, [stopStream]);

  useEffect(() => () => {
    stopStream();
    if (timerRef.current) clearInterval(timerRef.current);
    try { window.screen?.orientation?.unlock?.(); } catch { /* ignore */ }
    try { if (document.fullscreenElement) document.exitFullscreen?.(); } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = previewRef.current;
    if (phase !== 'review' && el && streamRef.current && el.srcObject !== streamRef.current) {
      el.srcObject = streamRef.current;
      el.play?.().catch(() => {});
    }
  }, [phase]);

  useEffect(() => () => { if (recordedUrl) URL.revokeObjectURL(recordedUrl); }, [recordedUrl]);

  // Keep the record button on-screen after a rotation.
  useEffect(() => {
    const onResize = () => {
      const el = recordRef.current;
      const w = el ? el.offsetWidth : 60;
      const h = el ? el.offsetHeight : 60;
      setRecordPos((p) => {
        const nx = clamp(p.x, 4, Math.max(4, window.innerWidth - w - 4));
        const ny = clamp(p.y, 4, Math.max(4, window.innerHeight - h - 4));
        if (nx === p.x && ny === p.y) return p;
        const np = { x: nx, y: ny };
        try { localStorage.setItem('tp-record-pos', JSON.stringify(np)); } catch { /* ignore */ }
        return np;
      });
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Confirm before leaving via the phone/browser back button or a tab close/refresh.
  useEffect(() => {
    const onBeforeUnload = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', onBeforeUnload);
    // Trap "back": push a sentinel entry; when it's popped, re-push and ask.
    window.history.pushState(null, '', window.location.href);
    const onPopState = () => {
      window.history.pushState(null, '', window.location.href);
      setConfirmClose(true);
    };
    window.addEventListener('popstate', onPopState);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      window.removeEventListener('popstate', onPopState);
    };
  }, []);

  // Fullscreen (no orientation lock) — entered when the camera opens. iOS can't
  // fullscreen a div, so it no-ops there (feature is Chromium-only anyway).
  const enterFullscreen = useCallback(async () => {
    try {
      const el = rootRef.current || document.documentElement;
      if (!document.fullscreenElement && el.requestFullscreen) {
        await el.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
      }
    } catch { /* unsupported */ }
  }, []);

  const goToCamera = useCallback(async () => {
    enterFullscreen(); // synchronous within the click gesture
    setPhase('setup');
    if (!streamRef.current) await startCamera('');
  }, [startCamera, enterFullscreen]);

  const onSelectCamera = (e) => {
    const id = e.target.value;
    setSelectedDeviceId(id);
    startCamera(id);
  };

  const setOrient = useCallback((next) => {
    orientationTouched.current = true;
    orientationRef.current = next;
    setOrientation(next);
    if (streamRef.current) startCamera(selectedDeviceId || '');
  }, [startCamera, selectedDeviceId]);

  // ---- orientation lock (while recording) ----------------------------------
  const lockScreenOrientation = useCallback(async () => {
    const want = orientationRef.current === 'landscape' ? 'landscape' : 'portrait';
    try {
      const el = rootRef.current || document.documentElement;
      if (!document.fullscreenElement && el.requestFullscreen) {
        await el.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
      }
      await window.screen?.orientation?.lock?.(want)?.catch?.(() => {});
    } catch { /* unsupported — orientation stays fixed at the app level anyway */ }
  }, []);

  // Only release the orientation lock on stop — stay fullscreen through review.
  const unlockScreenOrientation = useCallback(() => {
    try { window.screen?.orientation?.unlock?.(); } catch { /* ignore */ }
  }, []);

  // ---- recording -----------------------------------------------------------
  const stopTimer = () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } };

  const stopRecording = useCallback(() => {
    stopTimer();
    tp.stop();
    try { sttRef.current?.stop(); } catch { /* ignore */ } sttRef.current = null;
    unlockScreenOrientation();
    const rec = recorderRef.current;
    if (rec && rec.state !== 'inactive') { try { rec.stop(); } catch { /* ignore */ } }
  }, [tp, unlockScreenOrientation]);

  const startRecording = useCallback(async () => {
    const videoStream = streamRef.current;
    if (!videoStream) { toast.error('Camera is not ready yet.'); return; }
    if (!recordingSupported) { toast.error('Recording is not supported in this browser.'); return; }

    // Two voice paths:
    //  • STT server set → we'll tap the SINGLE recording track (no 2nd mic
    //    capture → no conflict), so DON'T start the browser recognizer.
    //  • otherwise → browser Web Speech; start it FIRST while the mic is free,
    //    then open the recording audio as a second consumer (may still conflict).
    const useStt = !!STT_WS_URL;
    lockScreenOrientation();
    tp.reset();
    setSttStatus('');
    if (!useStt) tp.start();

    let recordStream = videoStream;
    try {
      if (!useStt) await new Promise((r) => setTimeout(r, 500)); // let recognition settle
      const audioStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      audioTrackRef.current = audioStream.getAudioTracks()[0] || null;
      recordStream = new MediaStream([...videoStream.getVideoTracks(), ...audioStream.getAudioTracks()]);
    } catch {
      toast('Recording without a microphone (mic unavailable).');
    }

    // STT: reuse the recording audio track over the WebSocket (no extra capture).
    if (useStt && audioTrackRef.current) {
      setSttStatus('connecting');
      sttRef.current = createSttStream({
        track: audioTrackRef.current,
        url: STT_WS_URL,
        lang: settings.lang,
        onTranscript: (t) => tp.ingestTranscript(t),
        onStatus: (s, msg) => setSttStatus(msg ? `${s}:${msg}` : s),
      });
    }

    chunksRef.current = [];
    elapsedRef.current = 0;
    setElapsed(0);

    let recorder;
    try {
      recorder = new MediaRecorder(recordStream, mimeType ? { mimeType } : undefined);
    } catch {
      toast.error('Could not start the recorder for this camera.');
      tp.stop();
      return;
    }
    recorder.ondataavailable = (e) => { if (e.data && e.data.size) chunksRef.current.push(e.data); };
    recorder.onstop = () => {
      if (audioTrackRef.current) { try { audioTrackRef.current.stop(); } catch { /* ignore */ } audioTrackRef.current = null; }
      const blob = new Blob(chunksRef.current, { type: mimeType || 'video/webm' });
      const url = URL.createObjectURL(blob);
      setRecordedBlob(blob);
      setRecordedUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return url; });
      setPhase('review');
    };
    recorderRef.current = recorder;
    try { recorder.start(1000); } catch { toast.error('Recording failed to start.'); tp.stop(); return; }

    setPhase('recording');
    timerRef.current = setInterval(() => {
      elapsedRef.current += 1;
      setElapsed(elapsedRef.current);
      if (elapsedRef.current >= shortsCap) stopRecording();
    }, 1000);
  }, [mimeType, recordingSupported, shortsCap, stopRecording, tp, lockScreenOrientation, settings.lang]);

  const toggleVoiceTest = useCallback(() => {
    if (tp.listening) tp.stop();
    else { tp.reset(); tp.start(); }
  }, [tp]);

  // Record button: tap fires record/stop, a real drag just repositions it.
  const onFabPointerDown = (e) => {
    try { recordRef.current?.setPointerCapture?.(e.pointerId); } catch { /* ignore */ }
    recordDrag.current = { sx: e.clientX, sy: e.clientY, ox: recordPosRef.current.x, oy: recordPosRef.current.y, moved: false, cur: { ...recordPosRef.current } };
  };
  const onFabPointerMove = (e) => {
    const d = recordDrag.current;
    if (!d) return;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    if (Math.abs(dx) > 6 || Math.abs(dy) > 6) d.moved = true;
    const el = recordRef.current;
    const w = el ? el.offsetWidth : 60;
    const h = el ? el.offsetHeight : 60;
    const x = clamp(d.ox + dx, 4, window.innerWidth - w - 4);
    const y = clamp(d.oy + dy, 4, window.innerHeight - h - 4);
    d.cur = { x, y };
    if (el) { el.style.left = `${x}px`; el.style.top = `${y}px`; }
  };
  const onFabPointerUp = () => {
    const d = recordDrag.current;
    recordDrag.current = null;
    if (!d) return;
    if (d.moved) {
      setRecordPos(d.cur);
      try { localStorage.setItem('tp-record-pos', JSON.stringify(d.cur)); } catch { /* ignore */ }
    } else if (phase === 'recording') {
      stopRecording();
    } else {
      startRecording();
    }
  };

  // ---- review / hand-off ---------------------------------------------------
  const fileExt = (mimeType || 'video/webm').includes('mp4') ? 'mp4' : 'webm';

  const retake = useCallback(() => {
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    setRecordedUrl(null);
    setRecordedBlob(null);
    setElapsed(0);
    elapsedRef.current = 0;
    tp.reset();
    setPhase('setup');
  }, [recordedUrl, tp]);

  const downloadRecording = useCallback(() => {
    if (!recordedUrl) return;
    const a = document.createElement('a');
    a.href = recordedUrl;
    a.download = `speak-recording-${Date.now()}.${fileExt}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }, [recordedUrl, fileExt]);

  const useThisVideo = useCallback(async () => {
    if (!recordedBlob) return;
    setFinishing(true);
    const type = mimeType || 'video/webm';
    const file = new File([recordedBlob], `speak-recording-${Date.now()}.${fileExt}`, { type });
    const duration = elapsedRef.current || 0;
    let thumbs = [];
    try { thumbs = await generateVideoThumbnails(file, 2); } catch { /* pick one next step */ }
    stopStream();
    setGeneratedThumbnail(thumbs);
    setVideoFile(file);
    setPrevVideoFile(file);
    setVideoDuration(duration);
    setVideoMode(fromStories ? 'shorts' : 'longform');
    navigate('/embed-studio/thumbnail');
  }, [recordedBlob, mimeType, fileExt, fromStories, navigate, setGeneratedThumbnail, setVideoFile, setPrevVideoFile, setVideoDuration, setVideoMode, stopStream]);

  const requestClose = () => setConfirmClose(true);
  const doClose = () => {
    setConfirmClose(false);
    stopRecording();
    stopStream();
    try { if (document.fullscreenElement) document.exitFullscreen?.(); } catch { /* ignore */ }
    navigate('/embed-studio');
  };

  if (!ENABLE_CAMERA_RECORD) return <Navigate to="/embed-studio" replace />;

  const capLabel = fromStories && isFinite(shortsCap) ? ` / ${fmtTime(shortsCap)}` : '';
  const showBox = (phase === 'setup' || phase === 'recording') && tp.totalWords > 0;
  const rotateHint = phase === 'setup'
    && ((eff === 'landscape' && viewportPortrait) || (eff === 'portrait' && !viewportPortrait));

  const boxStyle = box
    ? { left: box.x, top: box.y, width: box.w, height: box.h }
    : { left: '5%', top: '6%', width: '90%', height: '38%' };
  const scrollStyle = { color: settings.fontColor, fontSize: `${settings.fontSize}px` };
  const boxBg = hexToRgba(settings.bgColor, settings.bgOpacity);

  const orientationToggle = (
    <div className="cr-orient" role="group" aria-label="Recording orientation">
      <button type="button" className={eff === 'portrait' ? 'is-on' : ''} onClick={() => setOrient('portrait')}>Portrait</button>
      <button type="button" className={eff === 'landscape' ? 'is-on' : ''} onClick={() => setOrient('landscape')}>Landscape</button>
    </div>
  );

  const langOptions = LANG_OPTIONS.some((o) => o.value === settings.lang)
    ? LANG_OPTIONS
    : [{ value: settings.lang, label: settings.lang }, ...LANG_OPTIONS];

  const overlaySettingsPanel = (
    <>
      <label className="cr-set-row">
        <span>Font size</span>
        <input type="range" min="14" max="52" step="1" value={settings.fontSize}
          onChange={(e) => setSetting({ fontSize: Number(e.target.value) })} />
        <span className="cr-set-val">{settings.fontSize}px</span>
      </label>
      <div className="cr-set-colors">
        <label className="cr-set-color">
          <span>Text</span>
          <input type="color" value={settings.fontColor} onChange={(e) => setSetting({ fontColor: e.target.value })} />
        </label>
        <label className="cr-set-color">
          <span>Background</span>
          <input type="color" value={settings.bgColor} onChange={(e) => setSetting({ bgColor: e.target.value })} />
        </label>
        <label className="cr-set-row cr-set-opacity">
          <span>BG opacity</span>
          <input type="range" min="0" max="1" step="0.05" value={settings.bgOpacity}
            onChange={(e) => setSetting({ bgOpacity: Number(e.target.value) })} />
          <span className="cr-set-val">{Math.round(settings.bgOpacity * 100)}%</span>
        </label>
      </div>
      <label className="cr-set-row">
        <span>Voice language</span>
        <select className="cr-lang-select" value={settings.lang} onChange={(e) => setSetting({ lang: e.target.value })}>
          {langOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </label>
    </>
  );

  const settingsGearBtn = (
    <button type="button" className={`cr-gear${settingsOpen ? ' is-on' : ''}`} onClick={() => setSettingsOpen((o) => !o)}>
      <Sliders size={15} /> Text style
    </button>
  );

  const settingsPopupEl = settingsOpen ? (
    <div ref={settingsMov.ref} className="cr-settings-pop" style={{ left: settingsMov.pos.x, top: settingsMov.pos.y }} {...settingsMov.surfaceProps}>
      <div className="cr-pop-header" {...settingsMov.handleProps}>
        <GripHorizontal size={14} />
        <span className="cr-pop-title">Text style</span>
        <button type="button" className="cr-pop-close" onPointerDown={(e) => e.stopPropagation()} onClick={() => setSettingsOpen(false)} aria-label="Close">
          <X size={15} />
        </button>
      </div>
      <div className="cr-pop-body">{overlaySettingsPanel}</div>
    </div>
  ) : null;

  const usingStt = !!STT_WS_URL && phase === 'recording';
  const voiceActive = tp.totalWords > 0 && (phase === 'recording' || (phase === 'setup' && tp.listening));
  const voiceStatusEl = voiceActive ? (
    (!tp.supported && !usingStt) ? (
      <div className="cr-tp-warn">Voice scrolling isn&apos;t supported here — scroll the script by hand.</div>
    ) : (usingStt && sttStatus.startsWith('error')) ? (
      <div className="cr-tp-warn">Speech server error — {sttStatus.slice(6) || 'unreachable'}. Scroll by hand.</div>
    ) : (!usingStt && speechErrorLabel(tp.error)) ? (
      <div className="cr-tp-warn">{speechErrorLabel(tp.error)}</div>
    ) : (
      <div className="cr-heard">
        <Mic size={13} />
        <span>
          {tp.interimText
            || (usingStt
              ? (sttStatus === 'connected' ? 'Listening (server)… start reading' : 'Connecting to speech server…')
              : (tp.listening ? 'Listening… start reading aloud' : 'Starting mic…'))}
        </span>
      </div>
    )
  ) : null;

  const confirmDialogEl = confirmClose ? (
    <div className="cr-confirm">
      <div className="cr-confirm-box">
        <p className="cr-confirm-title">Close the teleprompter?</p>
        <p className="cr-confirm-sub">Your recording and script won&apos;t be saved.</p>
        <div className="cr-confirm-actions">
          <button type="button" className="cr-btn cr-btn--ghost" onClick={() => setConfirmClose(false)}>Keep editing</button>
          <button type="button" className="cr-btn cr-btn--record" onClick={doClose}>Close</button>
        </div>
      </div>
    </div>
  ) : null;

  // ---- fullscreen script editor -------------------------------------------
  if (phase === 'script') {
    return (
      <div className="camera-record cr-script-phase">
        <div className="cr-script-head">
          <button type="button" className="cr-icon-btn" onClick={requestClose} aria-label="Close"><X size={22} /></button>
          <span className="cr-title">Experimental teleprompter</span>
          <span style={{ width: 40 }} />
        </div>

        <textarea
          className="cr-script-full"
          value={script}
          onChange={(e) => setScript(e.target.value)}
          placeholder="Write or paste your script here. During recording it scrolls automatically as you read it aloud."
        />

        <div className="cr-script-bar">
          <div className="cr-orient-line"><span>Orientation</span>{orientationToggle}</div>
          {settingsGearBtn}
        </div>

        <div className="cr-controls">
          <button type="button" className="cr-btn cr-btn--record" onClick={goToCamera}>
            <Camera size={18} /> Continue to camera
          </button>
        </div>

        {settingsPopupEl}
        {confirmDialogEl}
      </div>
    );
  }

  // ---- camera view: full-screen stage + floating widgets -------------------
  return (
    <div className="camera-record" ref={rootRef}>
      <div className="cr-stage" ref={stageRef}>
        {phase === 'review' && recordedUrl ? (
          <video className="cr-video cr-video--contain" src={recordedUrl} controls playsInline preload="metadata" />
        ) : (
          <div className={`cr-frame cr-frame--${eff}`}>
            <video ref={previewRef} className={`cr-video${mirror ? ' cr-video--mirror' : ''}`} muted playsInline autoPlay />
          </div>
        )}

        {camError && <div className="cr-error">{camError}</div>}

        {phase === 'recording' && (
          <div className="cr-topbar">
            <span className="cr-rec-badge"><span className="cr-rec-dot" /> REC {fmtTime(elapsed)}{capLabel}</span>
            {tp.totalWords > 0 && (
              <span className={`cr-listen${tp.listening ? ' cr-listen--on' : ''}`}>
                <Mic size={14} /> {tp.matchedCount}/{tp.totalWords}
              </span>
            )}
          </div>
        )}

        {rotateHint && (
          <div className="cr-rotate-hint">
            <RotateCw size={14} /> Rotate your phone to {eff} to fill the frame
          </div>
        )}

        {showBox && (
          <div
            ref={boxRef}
            className="cr-tp-box"
            style={{ ...boxStyle, background: boxBg }}
            onPointerMove={onBoxPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
            <div className="cr-tp-header" onPointerDown={beginDrag('move')}>
              <GripHorizontal size={16} />
              <span className="cr-tp-hint">{phase === 'setup' ? 'Drag / resize' : 'Reading…'}</span>
            </div>
            <div className="cr-tp-scroll" style={scrollStyle}>
              {tp.words.map((w, i) => (
                <span
                  key={i}
                  ref={i === tp.matchedCount ? currentWordRef : null}
                  className={
                    i < tp.matchedCount ? 'cr-word cr-word--read'
                      : i === tp.matchedCount ? 'cr-word cr-word--current' : 'cr-word'
                  }
                >
                  {w.text}{' '}
                </span>
              ))}
            </div>
            <div className="cr-tp-resize" onPointerDown={beginDrag('resize')} />
          </div>
        )}

        {voiceStatusEl}
      </div>

      {/* floating close */}
      <button type="button" className="cr-close" onClick={requestClose} aria-label="Close"><X size={22} /></button>

      {/* floating draggable, collapsible menu */}
      {(phase === 'setup' || phase === 'recording') && (
        <div ref={menu.ref} className="cr-menu" style={{ left: menu.pos.x, top: menu.pos.y }} {...menu.surfaceProps}>
          <div className="cr-menu-head" {...menu.handleProps}>
            <GripHorizontal size={14} />
            <span className="cr-menu-title">Menu</span>
            <button type="button" className="cr-menu-collapse" onPointerDown={(e) => e.stopPropagation()} onClick={() => setMenuCollapsed((c) => !c)} aria-label="Collapse menu">
              {menuCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
            </button>
          </div>
          {!menuCollapsed && (
            <div className="cr-menu-body">
              {phase === 'setup' && (
                <>
                  <div className="cr-menu-line"><span>Orientation</span>{orientationToggle}</div>
                  <button type="button" className="cr-menu-btn" onClick={() => setPhase('script')}>
                    <ChevronLeft size={15} /> Edit script
                  </button>
                  {devices.length > 1 && (
                    <label className="cr-cam-select">
                      <Camera size={15} />
                      <select value={selectedDeviceId} onChange={onSelectCamera}>
                        {devices.map((d, i) => <option key={d.deviceId} value={d.deviceId}>{d.label || `Camera ${i + 1}`}</option>)}
                      </select>
                    </label>
                  )}
                  {tp.totalWords > 0 && tp.supported && (
                    <button type="button" className={`cr-menu-btn cr-test${tp.listening ? ' is-on' : ''}`} onClick={toggleVoiceTest}>
                      <Mic size={15} /> {tp.listening ? 'Stop voice test' : 'Test voice'}
                    </button>
                  )}
                </>
              )}
              {settingsGearBtn}
            </div>
          )}
        </div>
      )}

      {/* floating draggable record / stop button */}
      {(phase === 'setup' || phase === 'recording') && (
        <button
          type="button"
          ref={recordRef}
          className={`cr-fab${phase === 'recording' ? ' cr-fab--recording' : ''}`}
          style={{ left: recordPos.x, top: recordPos.y }}
          onPointerDown={onFabPointerDown}
          onPointerMove={onFabPointerMove}
          onPointerUp={onFabPointerUp}
          onPointerCancel={onFabPointerUp}
          aria-label={phase === 'recording' ? 'Stop recording' : 'Start recording'}
        >
          <span className="cr-fab-inner" />
        </button>
      )}

      {phase === 'review' && (
        <div className="cr-review-actions">
          <button type="button" className="cr-btn cr-btn--ghost" onClick={retake} disabled={finishing}>
            <RotateCcw size={16} /> Re-record
          </button>
          <button type="button" className="cr-btn cr-btn--outline" onClick={downloadRecording} disabled={finishing}>
            <Download size={16} /> Download
          </button>
          <button type="button" className="cr-btn cr-btn--record" onClick={useThisVideo} disabled={finishing}>
            <Check size={16} /> {finishing ? 'Preparing…' : 'Use this video'}
          </button>
        </div>
      )}

      {settingsPopupEl}
      {confirmDialogEl}
    </div>
  );
}

export default EmbedCameraRecord;
