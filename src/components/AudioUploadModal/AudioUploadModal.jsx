import { useState, useRef, useEffect, useCallback } from 'react';
import {
  MdClose, MdCloudUpload, MdMic, MdStop, MdDelete,
  MdArrowBack, MdArrowForward, MdPlaylistAdd, MdPlaylistAddCheck,
  MdPublic, MdLock, MdCheck, MdAdd,
} from 'react-icons/md';
import axios from 'axios';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { KeyTypes } from '@aioha/aioha';
import { useMyPlaylists } from '../../hooks/useMyPlaylists';
import { uploadAudioTo3Speak, getSnapsContainer } from '../../utils/audioUpload';
import { uploadThumbnail } from '../../utils/uploadThumbnail';
import { broadcastWithAioha } from '../../hive-api/aioha';
import CommunityModal from '../modal/Community_modal';
import { useAppStore } from '../../lib/store';
import { PPL_BENEFICIARY, ENABLE_PPL, CHECKER_URL, CHECKER_API_KEY } from '../../utils/config';
import './AudioUploadModal.scss';

// Hive post conventions: mirror snapie — comments under the latest peak.snaps container.
const HIVE_APP_NAME = 'new-3speak-tv';
const HIVE_DEFAULT_TAGS = ['audio', 'three-speak', 'mantequilla'];

function slugify(s) {
  return (s || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-\s]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}

function generatePermlink(title) {
  const slug = slugify(title) || 'audio';
  return `${slug}-${Date.now().toString(36)}`;
}

const STEPS = [
  { id: 1, label: 'Source' },
  { id: 2, label: 'Settings' },
  { id: 3, label: 'Playlist' },
  { id: 4, label: 'Description' },
  { id: 5, label: 'Review' },
];

const MAX_RECORD_SEC = 300;
const AUDIO_EXT_RE = /\.(mp3|wav|ogg|webm|m4a|flac|aac)$/i;

// Spacing between sequential broadcasts so the Hive RPC + audio service
// don't see a burst from a single user (avoids rate-limit / dupe-window issues).
const PUBLISH_DELAY_MS = 3500;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Content type per track (matches the existing 3speak audio categories)
const TRACK_TYPES = [
  { value: 'voice_message', label: 'Voice / Snap' },
  { value: 'song',          label: 'Music' },
  { value: 'podcast',       label: 'Podcast' },
  { value: 'audiobook',     label: 'Audiobook' },
  { value: 'interview',     label: 'Interview' },
];

// Hardcoded suggestions; users can still type any genre into the field.
const MUSIC_GENRES = [
  'Electronic', 'Hip-Hop', 'Rock', 'Pop', 'Jazz', 'Classical', 'Folk',
  'Country', 'Reggae', 'R&B', 'Metal', 'Ambient', 'Funk', 'Soul', 'Blues',
  'Indie', 'Latin', 'World', 'House', 'Techno', 'Drum & Bass', 'Lo-Fi',
];

function newId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function defaultTitleFromFile(name) {
  return name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim() || 'Untitled';
}

function fmtTime(sec) {
  if (!Number.isFinite(sec)) return '--:--';
  const s = Math.max(0, Math.floor(sec));
  if (s >= 3600) return `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function probeDuration(blob) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('audio');
    a.preload = 'metadata';
    a.onloadedmetadata = () => {
      const d = Number.isFinite(a.duration) ? a.duration : null;
      URL.revokeObjectURL(url);
      resolve(d);
    };
    a.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    a.src = url;
  });
}

function AudioUploadModal({ isOpen, onClose, initialTrack }) {
  const [step, setStep] = useState(1);
  const [tracks, setTracks] = useState([]);
  const [playlistChoice, setPlaylistChoice] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordSec, setRecordSec] = useState(0);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  // publishStatus: { [trackId]: { state: 'pending'|'uploading'|'posting'|'success'|'error', message?: string, playUrl?: string } }
  const [publishStatus, setPublishStatus] = useState({});
  const [isPublishing, setIsPublishing] = useState(false);
  // 'post'  → keep the normal one-time Hive author payout.
  // 'ppl'   → assign 100% beneficiaries to @threespeak-audio; a separate
  //           program pays the author per listen for the track's lifetime.
  const [rewardMode, setRewardMode] = useState('post');
  // 'snap' (default) → comment under the latest peak.snaps container;
  // 'post' → a standalone Hive root post. Only offered for a single track.
  const [publishAs, setPublishAs] = useState('snap');
  // The post/snap choice only applies to single uploads — revert to snap
  // if the user ends up with 0 or 2+ tracks.
  useEffect(() => {
    if (tracks.length !== 1) setPublishAs('snap');
  }, [tracks.length]);
  // Standalone-post composer fields (only used when publishAs === 'post').
  const [community, setCommunity] = useState({ name: 'hive-181335', title: 'Threespeak' });
  const [communityOpen, setCommunityOpen] = useState(false);
  const [postDescription, setPostDescription] = useState('');
  const [postTagsInput, setPostTagsInput] = useState('');
  const [postThumb, setPostThumb] = useState('');
  const [postThumbUploading, setPostThumbUploading] = useState(false);
  const postThumbRef = useRef(null);

  const onPostThumbFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Pick an image file'); return; }
    setPostThumbUploading(true);
    try {
      setPostThumb(await uploadThumbnail(file));
    } catch (err) {
      toast.error(`Thumbnail upload failed: ${err?.message || 'unknown'}`);
    } finally {
      setPostThumbUploading(false);
      if (postThumbRef.current) postThumbRef.current.value = '';
    }
  };

  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordTimerRef = useRef(null);
  const recordChunksRef = useRef([]);
  const recordStreamRef = useRef(null);
  const objectUrlsRef = useRef(new Set());

  const { data: playlists = [], isLoading: playlistsLoading, refetch: refetchPlaylists } = useMyPlaylists({ limit: 50 });
  const queryClient = useQueryClient();
  const { user } = useAppStore();
  const [pendingPlaylist, setPendingPlaylist] = useState(null); // { id, name, access } shown while waiting for indexer

  const addBlobAsTrack = useCallback(async (blob, filename, source = 'file', overrideType = null) => {
    const url = URL.createObjectURL(blob);
    objectUrlsRef.current.add(url);
    const dur = await probeDuration(blob);
    setTracks(prev => [...prev, {
      id: newId(),
      blob,
      filename,
      title: defaultTitleFromFile(filename),
      durationSec: dur,
      objectUrl: url,
      source,
      // Optional metadata captured in the Titles step. Caller may
      // override the auto-derived type — e.g. an OpenPods recording
      // hand-off pre-fills 'podcast'.
      type: overrideType ?? (source === 'record' ? 'voice_message' : 'podcast'),
      genre: '',
      bpm: '',
    }]);
  }, []);

  // When an initialTrack lands (e.g. an OpenPods recording handed off
  // from the Hangouts SDK), seed it as the first track on open. The
  // ref guard ensures one initial blob per open cycle even if the
  // parent re-renders mid-flight or the user dismisses then reopens.
  const consumedInitialRef = useRef(false);
  useEffect(() => {
    if (!isOpen) {
      consumedInitialRef.current = false;
      return;
    }
    if (consumedInitialRef.current) return;
    if (!initialTrack || !initialTrack.blob) return;
    consumedInitialRef.current = true;
    addBlobAsTrack(
      initialTrack.blob,
      initialTrack.filename || 'openpod-recording.ogg',
      'record',
      initialTrack.type ?? null,
    );
  }, [isOpen, initialTrack, addBlobAsTrack]);

  const handleFiles = useCallback(async (fileList) => {
    const files = Array.from(fileList || []).filter(f => f.type.startsWith('audio/') || AUDIO_EXT_RE.test(f.name));
    if (files.length === 0) return;
    for (const f of files) await addBlobAsTrack(f, f.name, 'file');
  }, [addBlobAsTrack]);

  const onDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer?.files);
  };
  const onDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const onDragLeave = (e) => { e.preventDefault(); setIsDragging(false); };

  const removeTrack = (id) => {
    setTracks(prev => {
      const t = prev.find(x => x.id === id);
      if (t?.objectUrl) {
        URL.revokeObjectURL(t.objectUrl);
        objectUrlsRef.current.delete(t.objectUrl);
      }
      return prev.filter(x => x.id !== id);
    });
  };

  const setTitle = (id, title) => {
    setTracks(prev => prev.map(t => t.id === id ? { ...t, title } : t));
  };

  // Generic patcher for the per-track metadata fields (type/genre/bpm)
  const patchTrack = (id, patch) => {
    setTracks(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t));
  };

  const stopRecordTimer = () => {
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordStreamRef.current = stream;
      recordChunksRef.current = [];
      const mr = new MediaRecorder(stream);
      mr.ondataavailable = (e) => { if (e.data?.size > 0) recordChunksRef.current.push(e.data); };
      mr.onstop = async () => {
        const blob = new Blob(recordChunksRef.current, { type: 'audio/webm' });
        recordStreamRef.current?.getTracks().forEach(t => t.stop());
        recordStreamRef.current = null;
        const idx = newId().slice(0, 4);
        await addBlobAsTrack(blob, `recording-${idx}.webm`, 'record');
        setIsRecording(false);
        setRecordSec(0);
        stopRecordTimer();
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setIsRecording(true);
      setRecordSec(0);
      recordTimerRef.current = setInterval(() => {
        setRecordSec(s => {
          const next = s + 1;
          if (next >= MAX_RECORD_SEC) {
            try { mr.stop(); } catch {}
          }
          return next;
        });
      }, 1000);
    } catch {
      toast.error('Microphone access denied');
    }
  };

  const stopRecording = () => {
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== 'inactive') {
      try { mr.stop(); } catch {}
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRecordTimer();
      const mr = mediaRecorderRef.current;
      if (mr && mr.state === 'recording') {
        try { mr.stop(); } catch {}
      }
      recordStreamRef.current?.getTracks().forEach(t => t.stop());
      objectUrlsRef.current.forEach(u => URL.revokeObjectURL(u));
      objectUrlsRef.current.clear();
    };
  }, []);

  // Clear pending placeholder once the new playlist is indexed and visible
  useEffect(() => {
    if (pendingPlaylist && playlists.some(p => p.id === pendingPlaylist.id)) {
      setPendingPlaylist(null);
    }
  }, [pendingPlaylist, playlists]);

  const handleCreatePlaylist = useCallback(async ({ name, access, credits, musicStyle, year, label, description, thumbnail }) => {
    if (!user) { toast.error('Sign in first'); return; }
    const trimmed = name.trim();
    if (!trimmed) { toast.error('Enter a playlist name'); return; }
    const playlistId = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    try {
      toast.info(`Creating playlist "${trimmed}"…`);
      // Build the album payload — only include fields with values.
      const album = {};
      if (credits && credits.trim()) album.credits = credits.trim();
      if (musicStyle && musicStyle.trim()) album.musicStyle = musicStyle.trim();
      const yearNum = parseInt(year, 10);
      if (!isNaN(yearNum) && yearNum > 0) album.year = yearNum;
      if (label && label.trim()) album.label = label.trim();
      if (description && description.trim()) album.description = description.trim();
      if (thumbnail && thumbnail.trim()) album.thumbnail = thumbnail.trim();
      const hasAlbumMeta = Object.keys(album).length > 0;
      const extraMeta = hasAlbumMeta ? { album } : null;

      // Build operations for a single broadcast: create, then (if any album
      // metadata was provided) an update that puts thumbnail + metadata on the
      // playlist doc. The indexer's _create handler ignores json_metadata, but
      // its _update handler stores `metadata` and `thumbnail` so they surface
      // through the playlists API.
      const createPayload = {
        name: trimmed,
        access,
        playlist_id: playlistId,
      };
      if (extraMeta) createPayload.json_metadata = JSON.stringify({ type: 'audio', ...extraMeta });

      const ops = [
        ['custom_json', {
          required_auths: [],
          required_posting_auths: [user],
          id: '3speak_playlist_create',
          json: JSON.stringify(createPayload),
        }],
      ];

      if (hasAlbumMeta) {
        const updatePayload = { playlist_id: playlistId };
        if (album.thumbnail) updatePayload.thumbnail = album.thumbnail;
        // Persist the whole album object as `metadata` (indexer stores it as
        // a sub-document and the API surfaces it).
        updatePayload.metadata = { album };
        ops.push(['custom_json', {
          required_auths: [],
          required_posting_auths: [user],
          id: '3speak_playlist_update',
          json: JSON.stringify(updatePayload),
        }]);
      }

      await broadcastWithAioha(ops, KeyTypes.Posting);
      toast.success('Playlist created');
      setPlaylistChoice(playlistId);
      setPendingPlaylist({ id: playlistId, name: trimmed, access });
      setTimeout(() => {
        refetchPlaylists();
        queryClient.invalidateQueries({ queryKey: ['myPlaylists', user] });
      }, 3000);
      return true;
    } catch (err) {
      toast.error(`Failed: ${err?.message || 'unknown error'}`);
      return false;
    }
  }, [user, queryClient, refetchPlaylists]);

  const hasUnsavedWork = tracks.length > 0 || isRecording;

  const attemptClose = useCallback(() => {
    if (hasUnsavedWork) {
      setShowCloseConfirm(true);
    } else {
      onClose();
    }
  }, [hasUnsavedWork, onClose]);

  // Esc to close (with confirm guard)
  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (showCloseConfirm) setShowCloseConfirm(false);
      else attemptClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, attemptClose, showCloseConfirm]);

  // ─── Publish helpers (must run on every render — keep above the early return) ───
  // setTrackStatus is referentially stable via setState; we keep it as a plain
  // function (no hook) since it's only used inside other callbacks below.
  const setTrackStatus = (trackId, patch) => {
    setPublishStatus(prev => ({ ...prev, [trackId]: { ...(prev[trackId] || {}), ...patch } }));
  };

  // Cached snap container for the whole modal session — re-used on retry.
  const containerRef = useRef(null);
  const ensureContainer = useCallback(async () => {
    if (containerRef.current) return containerRef.current;
    const c = await getSnapsContainer();
    containerRef.current = c;
    return c;
  }, []);

  // Publish a single track: upload to 3Speak audio, then broadcast Hive comment
  // (+ optional playlist add). Updates publishStatus along the way.
  const publishOneTrack = useCallback(async (track, container) => {
    setTrackStatus(track.id, { state: 'uploading', stage: 'Uploading audio file', message: undefined });
    const { permlink: audioPermlink, playUrl } = await uploadAudioTo3Speak({
      blob: track.blob,
      durationSec: track.durationSec,
      username: user,
      title: track.title,
    });

    setTrackStatus(track.id, { state: 'posting', stage: 'Posting to Hive', playUrl });
    const hivePermlink = generatePermlink(track.title) || audioPermlink;
    // 'post' → standalone Hive root post (community/first tag as category,
    // real title, user description/tags/thumbnail). 'snap' → reply under
    // the peak.snaps container.
    const asPost = publishAs === 'post';

    const audioMeta = { type: track.type || undefined };
    if (track.type === 'song') {
      if (track.genre) audioMeta.genre = String(track.genre).trim();
      const bpmNum = parseInt(track.bpm, 10);
      if (!isNaN(bpmNum) && bpmNum > 0) audioMeta.bpm = bpmNum;
    }

    let tags = Array.from(new Set(HIVE_DEFAULT_TAGS));
    // Snap body: the user's description if given, else the track title.
    let body = `${(postDescription || '').trim() || (track.title || '').trim()}\n\n${playUrl}`.trim();
    let metaObj = { app: HIVE_APP_NAME, tags, audio: audioMeta };

    if (asPost) {
      const userTags = postTagsInput
        .split(/[\s,]+/).map(t => t.trim().toLowerCase()).filter(Boolean);
      tags = userTags.length ? Array.from(new Set(userTags)) : tags;
      const desc = (postDescription || '').trim() || (track.title || '').trim();
      // Thumbnail rendered at the very top of the post body, then the
      // description, then the audio player link.
      const cover = postThumb ? `![${(track.title || 'cover').replace(/[[\]]/g, '')}](${postThumb})\n\n` : '';
      body = `${cover}${desc}\n\n${playUrl}`.trim();
      metaObj = { app: HIVE_APP_NAME, tags, audio: audioMeta };
      if (postThumb) metaObj.image = [postThumb];
    }
    const json_metadata = JSON.stringify(metaObj);

    const ops = [[
      'comment',
      asPost
        ? {
            parent_author: '',
            parent_permlink: (community && community.name) || tags[0],
            author: user,
            permlink: hivePermlink,
            title: (track.title || '').trim() || 'Audio',
            body,
            json_metadata,
          }
        : {
            parent_author: container.author,
            parent_permlink: container.permlink,
            author: user,
            permlink: hivePermlink,
            title: '',
            body,
            json_metadata,
          },
    ]];

    // Pay-per-listen: route 100% of the post's rewards to @threespeak-audio.
    // Must immediately follow the comment op (and precede any custom_json) so
    // the comment exists in-block before comment_options references it.
    if (ENABLE_PPL && rewardMode === 'ppl') {
      ops.push([
        'comment_options',
        {
          author: user,
          permlink: hivePermlink,
          max_accepted_payout: '1000000.000 HBD',
          percent_hbd: 10000,
          allow_votes: true,
          allow_curation_rewards: true,
          extensions: [[0, { beneficiaries: [{ account: PPL_BENEFICIARY, weight: 10000 }] }]],
        },
      ]);
    }

    if (playlistChoice) {
      ops.push([
        'custom_json',
        {
          required_auths: [],
          required_posting_auths: [user],
          id: '3speak_playlist_add',
          json: JSON.stringify({
            playlist_id: playlistChoice,
            author: user,
            permlink: hivePermlink,
            position: 0,
          }),
        },
      ]);
    }

    await broadcastWithAioha(ops, KeyTypes.Posting);

    // The 3Speak audio API doesn't take a thumbnail, so the embed-audio
    // row has none → tiles show the avatar fallback. For a standalone
    // post with a chosen cover, push it to the audio record (best-effort).
    if (asPost && postThumb && CHECKER_API_KEY) {
      try {
        await axios.put(
          `${CHECKER_URL}/video/thumbnail`,
          { owner: user, permlink: audioPermlink, thumbnail: postThumb },
          { headers: { Authorization: `Bearer ${CHECKER_API_KEY}` } },
        );
      } catch (thumbErr) {
        console.warn('Audio thumbnail Mongo update failed (non-fatal):', thumbErr?.message);
      }
    }

    setTrackStatus(track.id, { state: 'success', stage: undefined });
  }, [user, playlistChoice, rewardMode, publishAs, community, postDescription, postTagsInput, postThumb]);

  const retryTrack = useCallback(async (trackId) => {
    const track = tracks.find((t) => t.id === trackId);
    if (!track) return;
    setIsPublishing(true);
    try {
      const container = await ensureContainer();
      await publishOneTrack(track, container);
      if (playlistChoice) queryClient.invalidateQueries({ queryKey: ['myPlaylists', user] });
    } catch (err) {
      const message = err?.message || (typeof err === 'string' ? err : 'Failed');
      setTrackStatus(trackId, { state: 'error', stage: undefined, message });
    } finally {
      setIsPublishing(false);
    }
  }, [tracks, ensureContainer, publishOneTrack, playlistChoice, queryClient, user]);

  const retryAllFailed = useCallback(async () => {
    const failed = tracks.filter((t) => publishStatus[t.id]?.state === 'error');
    if (failed.length === 0) return;
    for (let i = 0; i < failed.length; i++) {
      if (i > 0) await sleep(PUBLISH_DELAY_MS); // throttle between tracks
      // eslint-disable-next-line no-await-in-loop
      await retryTrack(failed[i].id);
    }
  }, [tracks, publishStatus, retryTrack]);

  if (!isOpen) return null;

  const allPublished = tracks.length > 0 && tracks.every(t => publishStatus[t.id]?.state === 'success');

  const isSinglePost = tracks.length === 1 && publishAs === 'post';
  const canNext = (() => {
    if (step === 1) return tracks.length > 0 && !isRecording;
    if (step === 2) return true; // Settings — defaults are valid
    if (step === 3) return true; // Playlist — optional
    if (step === 4) return !isSinglePost || (tracks[0]?.title || '').trim().length > 0; // post needs a title
    return false;
  })();

  const goNext = () => setStep(s => Math.min(s + 1, 5));
  const goBack = () => setStep(s => Math.max(s - 1, 1));

  const onPublish = async () => {
    if (!user) { toast.error('Sign in first'); return; }
    if (tracks.length === 0) return;
    setIsPublishing(true);

    const initial = {};
    for (const t of tracks) initial[t.id] = { state: 'pending' };
    setPublishStatus(initial);

    let container;
    try {
      container = await ensureContainer();
    } catch (err) {
      setIsPublishing(false);
      toast.error(`Couldn't resolve peak.snaps container: ${err?.message || 'unknown'}`);
      return;
    }

    let allOk = true;
    for (let i = 0; i < tracks.length; i++) {
      if (i > 0) await sleep(PUBLISH_DELAY_MS); // throttle between tracks
      const track = tracks[i];
      try {
        await publishOneTrack(track, container);
      } catch (err) {
        allOk = false;
        const message = err?.message || (typeof err === 'string' ? err : 'Failed');
        setTrackStatus(track.id, { state: 'error', stage: undefined, message });
      }
    }

    setIsPublishing(false);

    if (allOk) {
      toast.success(`Published ${tracks.length} track${tracks.length !== 1 ? 's' : ''}`);
      queryClient.invalidateQueries({ queryKey: ['myPlaylists', user] });
      setTimeout(() => onClose(), 1200);
    } else {
      toast.error('Some tracks failed — open the failed track to retry');
    }
  };

  return (
    <div className="audio-upload-overlay" onClick={attemptClose}>
      {/* Shared genre suggestions for both per-track inputs and the album form */}
      <datalist id="audio-upload-genre-options">
        {MUSIC_GENRES.map((g) => <option key={g} value={g} />)}
      </datalist>
      <div className="audio-upload-modal audio-upload-modal-wizard" onClick={e => e.stopPropagation()}>
        <div className="audio-upload-header">
          <h3><MdCloudUpload /> Upload audio</h3>
          <button className="audio-upload-close" onClick={attemptClose} aria-label="Close"><MdClose size={20} /></button>
        </div>

        <ol className="audio-upload-steps">
          {STEPS.map(s => (
            <li
              key={s.id}
              className={`audio-upload-step${step === s.id ? ' active' : ''}${step > s.id ? ' done' : ''}`}
            >
              <span className="audio-upload-step-num">{step > s.id ? <MdCheck size={14} /> : s.id}</span>
              <span className="audio-upload-step-label">{s.label}</span>
            </li>
          ))}
        </ol>

        <div className="audio-upload-body">
          {step === 1 && (
            <SourceStep
              tracks={tracks}
              isRecording={isRecording}
              recordSec={recordSec}
              isDragging={isDragging}
              fileInputRef={fileInputRef}
              onDrop={onDrop}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onPickFiles={() => fileInputRef.current?.click()}
              onFilesSelected={(e) => { handleFiles(e.target.files); e.target.value = ''; }}
              onStart={startRecording}
              onStop={stopRecording}
              onRemove={removeTrack}
            />
          )}
          {step === 2 && (
            <SettingsStep
              tracks={tracks}
              patchTrack={patchTrack}
              isPublishing={isPublishing}
              publishStatus={publishStatus}
              rewardMode={rewardMode}
              setRewardMode={setRewardMode}
              publishAs={publishAs}
              setPublishAs={setPublishAs}
            />
          )}
          {step === 3 && (
            <PlaylistStep
              playlists={playlists}
              loading={playlistsLoading}
              choice={playlistChoice}
              onChoose={setPlaylistChoice}
              pendingPlaylist={pendingPlaylist}
              onCreate={handleCreatePlaylist}
            />
          )}
          {step === 4 && (
            <DescriptionStep
              isPost={isSinglePost}
              title={tracks[0]?.title || ''}
              setTitle={(v) => tracks[0] && patchTrack(tracks[0].id, { title: v })}
              description={postDescription}
              setDescription={setPostDescription}
              community={community}
              setCommunityOpen={setCommunityOpen}
              tagsInput={postTagsInput}
              setTagsInput={setPostTagsInput}
              thumb={postThumb}
              setThumb={setPostThumb}
              thumbUploading={postThumbUploading}
              thumbRef={postThumbRef}
              onThumbFile={onPostThumbFile}
            />
          )}
          {step === 5 && (
            <ReviewStep
              tracks={tracks}
              playlists={playlists}
              playlistChoice={playlistChoice}
              pendingPlaylist={pendingPlaylist}
              publishStatus={publishStatus}
              onRetry={retryTrack}
              onRetryAll={retryAllFailed}
              isPublishing={isPublishing}
              publishAs={publishAs}
              rewardMode={rewardMode}
              community={community}
            />
          )}
          {communityOpen && (
            <CommunityModal
              isOpen={communityOpen}
              data={[]}
              close={() => setCommunityOpen(false)}
              setCommunity={setCommunity}
            />
          )}
        </div>

        <div className="audio-upload-footer">
          {step > 1 ? (
            <button className="audio-upload-btn-secondary" onClick={goBack} disabled={isPublishing}>
              <MdArrowBack size={16} /> Back
            </button>
          ) : <span />}
          {step < 5 ? (
            <button className="audio-upload-btn-primary" onClick={goNext} disabled={!canNext}>
              Next <MdArrowForward size={16} />
            </button>
          ) : allPublished ? (
            <button
              className="audio-upload-btn-primary"
              onClick={onClose}
            >
              <MdCheck size={16} /> Close
            </button>
          ) : (
            <button
              className="audio-upload-btn-primary"
              onClick={onPublish}
              disabled={isPublishing}
            >
              {isPublishing ? 'Publishing…' : 'Publish'}
            </button>
          )}
        </div>

        {showCloseConfirm && (
          <div className="audio-upload-confirm" onClick={(e) => e.stopPropagation()}>
            <div className="audio-upload-confirm-card">
              <h4>Discard upload?</h4>
              <p>
                You have {tracks.length} track{tracks.length !== 1 ? 's' : ''} added
                {isRecording ? ' and a recording in progress' : ''}. Closing will discard them.
              </p>
              <div className="audio-upload-confirm-actions">
                <button
                  className="audio-upload-btn-secondary"
                  onClick={() => setShowCloseConfirm(false)}
                  autoFocus
                >
                  Keep editing
                </button>
                <button
                  className="audio-upload-btn-primary audio-upload-btn-danger"
                  onClick={() => { setShowCloseConfirm(false); onClose(); }}
                >
                  Discard
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SourceStep({
  tracks, isRecording, recordSec, isDragging, fileInputRef,
  onDrop, onDragOver, onDragLeave, onPickFiles, onFilesSelected,
  onStart, onStop, onRemove,
}) {
  return (
    <>
      <div className="audio-upload-source-row">
        <div
          className={`audio-upload-dropzone${isDragging ? ' dragging' : ''}`}
          onClick={onPickFiles}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          role="button"
          tabIndex={0}
        >
          <MdCloudUpload size={32} />
          <p>Drop audio files here, or click to browse</p>
          <small>MP3, WAV, OGG, WEBM, M4A, FLAC, AAC — multiple allowed</small>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            multiple
            hidden
            onChange={onFilesSelected}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
        <div className={`audio-upload-recorder${isRecording ? ' recording' : ''}`}>
          {isRecording ? (
            <>
              <div className="audio-upload-rec-dot" />
              <div className="audio-upload-rec-time">{fmtTime(recordSec)}</div>
              <button className="audio-upload-btn-secondary" onClick={onStop}>
                <MdStop size={16} /> Stop
              </button>
            </>
          ) : (
            <>
              <MdMic size={32} />
              <p>Or record live</p>
              <small>Up to {Math.round(MAX_RECORD_SEC / 60)} min per recording</small>
              <button className="audio-upload-btn-primary" onClick={onStart}>
                <MdMic size={16} /> Record
              </button>
            </>
          )}
        </div>
      </div>
      {tracks.length > 0 && (
        <div className="audio-upload-track-list">
          <h4>Added ({tracks.length})</h4>
          {tracks.map(t => (
            <div key={t.id} className="audio-upload-track-row">
              <span className="audio-upload-track-source" title={t.source === 'record' ? 'Recorded' : 'Uploaded'}>
                {t.source === 'record' ? <MdMic size={14} /> : <MdCloudUpload size={14} />}
              </span>
              <span className="audio-upload-track-name">{t.filename}</span>
              <span className="audio-upload-track-meta">{fmtTime(t.durationSec)}</span>
              <button className="audio-upload-track-remove" onClick={() => onRemove(t.id)} aria-label="Remove">
                <MdDelete size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function TitlesStep({ tracks, setTitle, patchTrack, onRemove }) {
  return (
    <div className="audio-upload-titles">
      <p className="audio-upload-step-help">Title each track and pick a type. Music tracks get genre + BPM fields.</p>
      {tracks.map((t, i) => (
        <div key={t.id} className="audio-upload-title-card">
          <div className="audio-upload-title-row">
            <span className="audio-upload-title-num">{i + 1}.</span>
            <input
              type="text"
              className="audio-upload-title-input"
              value={t.title}
              onChange={(e) => setTitle(t.id, e.target.value)}
              placeholder="Track title"
              maxLength={120}
            />
            <select
              className="audio-upload-type-select"
              value={t.type || 'voice_message'}
              onChange={(e) => patchTrack(t.id, { type: e.target.value })}
            >
              {TRACK_TYPES.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <button className="audio-upload-track-remove" onClick={() => onRemove(t.id)} aria-label="Remove">
              <MdDelete size={14} />
            </button>
          </div>
          {t.type === 'song' && (
            <div className="audio-upload-music-row">
              <input
                type="text"
                className="audio-upload-genre-input"
                value={t.genre || ''}
                onChange={(e) => patchTrack(t.id, { genre: e.target.value })}
                placeholder="Genre"
                list="audio-upload-genre-options"
                maxLength={60}
              />
              <input
                type="number"
                className="audio-upload-bpm-input"
                value={t.bpm || ''}
                onChange={(e) => patchTrack(t.id, { bpm: e.target.value })}
                placeholder="BPM"
                min="20"
                max="400"
              />
            </div>
          )}
          <div className="audio-upload-title-meta-line">
            <span>{fmtTime(t.durationSec)} · {t.source === 'record' ? 'Recorded' : t.filename}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function PlaylistStep({ playlists, loading, choice, onChoose, pendingPlaylist, onCreate }) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newAccess, setNewAccess] = useState('public');
  const [newCredits, setNewCredits] = useState('');
  const [newMusicStyle, setNewMusicStyle] = useState('');
  const [newYear, setNewYear] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [thumbnailUploading, setThumbnailUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const thumbInputRef = useRef(null);

  const showPending = pendingPlaylist && !playlists.some(p => p.id === pendingPlaylist.id);

  const resetForm = () => {
    setShowCreateForm(false);
    setNewName('');
    setNewAccess('public');
    setNewCredits('');
    setNewMusicStyle('');
    setNewYear('');
    setNewLabel('');
    setNewDescription('');
    setThumbnailUrl('');
  };

  const onThumbnailFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Pick an image file');
      return;
    }
    setThumbnailUploading(true);
    try {
      const url = await uploadThumbnail(file);
      setThumbnailUrl(url);
    } catch (err) {
      toast.error(`Thumbnail upload failed: ${err?.message || 'unknown'}`);
    } finally {
      setThumbnailUploading(false);
      if (thumbInputRef.current) thumbInputRef.current.value = '';
    }
  };

  const submit = async () => {
    setSubmitting(true);
    const ok = await onCreate({
      name: newName,
      access: newAccess,
      credits: newCredits,
      musicStyle: newMusicStyle,
      year: newYear,
      label: newLabel,
      description: newDescription,
      thumbnail: thumbnailUrl,
    });
    setSubmitting(false);
    if (ok) resetForm();
  };

  return (
    <div className="audio-upload-playlist-step">
      <p className="audio-upload-step-help">Optional — add all tracks to a playlist.</p>

      <button
        className={`audio-upload-playlist-item${choice === null ? ' selected' : ''}`}
        onClick={() => onChoose(null)}
      >
        <span className="audio-upload-playlist-icon"><MdPlaylistAdd size={18} /></span>
        <span className="audio-upload-playlist-name">
          <span>No playlist</span>
          <small>Tracks won't be grouped</small>
        </span>
        {choice === null && <MdCheck size={16} />}
      </button>

      {showPending && (
        <button
          className={`audio-upload-playlist-item audio-upload-playlist-pending${choice === pendingPlaylist.id ? ' selected' : ''}`}
          onClick={() => onChoose(pendingPlaylist.id)}
        >
          <span className="audio-upload-playlist-icon"><MdPlaylistAddCheck size={18} /></span>
          <span className="audio-upload-playlist-name">
            <span>{pendingPlaylist.name}</span>
            <small>
              {pendingPlaylist.access === 'private' ? <MdLock size={11} /> : <MdPublic size={11} />}{' '}
              creating… (waiting for indexer)
            </small>
          </span>
          {choice === pendingPlaylist.id && <MdCheck size={16} />}
        </button>
      )}

      {loading ? (
        <div className="audio-upload-playlist-loading">Loading playlists…</div>
      ) : playlists.length === 0 && !showPending ? (
        <div className="audio-upload-playlist-empty">You don't have any playlists yet.</div>
      ) : (
        playlists.map(p => (
          <button
            key={p.id}
            className={`audio-upload-playlist-item${choice === p.id ? ' selected' : ''}`}
            onClick={() => onChoose(p.id)}
          >
            <span className="audio-upload-playlist-icon">
              {choice === p.id ? <MdPlaylistAddCheck size={18} /> : <MdPlaylistAdd size={18} />}
            </span>
            <span className="audio-upload-playlist-name">
              <span>{p.name}</span>
              <small>
                {p.access === 'private' ? <MdLock size={11} /> : <MdPublic size={11} />}{' '}
                {p.items?.length || 0} items
              </small>
            </span>
            {choice === p.id && <MdCheck size={16} />}
          </button>
        ))
      )}

      {!showCreateForm ? (
        <button
          type="button"
          className="audio-upload-playlist-create-btn"
          onClick={() => setShowCreateForm(true)}
        >
          <MdAdd size={16} /> New audio playlist
        </button>
      ) : (
        <div className="audio-upload-playlist-form">
          <input
            type="text"
            className="audio-upload-title-input"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Playlist name"
            maxLength={80}
            autoFocus
          />
          <div className="audio-upload-playlist-privacy">
            <button
              type="button"
              className={`audio-upload-playlist-privacy-btn${newAccess === 'public' ? ' active' : ''}`}
              onClick={() => setNewAccess('public')}
            >
              <MdPublic size={14} /> Public
            </button>
            <button
              type="button"
              className={`audio-upload-playlist-privacy-btn${newAccess === 'private' ? ' active' : ''}`}
              onClick={() => setNewAccess('private')}
            >
              <MdLock size={14} /> Private
            </button>
          </div>
          <input
            type="text"
            className="audio-upload-title-input"
            value={newMusicStyle}
            onChange={(e) => setNewMusicStyle(e.target.value)}
            placeholder="Music style / genre (optional, e.g. Electronic)"
            list="audio-upload-genre-options"
            maxLength={60}
          />

          <div className="audio-upload-album-grid">
            <input
              type="text"
              className="audio-upload-title-input"
              value={newCredits}
              onChange={(e) => setNewCredits(e.target.value)}
              placeholder="Credits (optional)"
              maxLength={200}
            />
            <input
              type="number"
              className="audio-upload-title-input"
              value={newYear}
              onChange={(e) => setNewYear(e.target.value)}
              placeholder="Year"
              min="1900"
              max="2100"
            />
            <input
              type="text"
              className="audio-upload-title-input"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="Label (optional)"
              maxLength={120}
            />
          </div>

          <textarea
            className="audio-upload-title-input audio-upload-credits-input"
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            placeholder="Description (optional)"
            rows={3}
            maxLength={1000}
          />

          <div
            className={`audio-upload-album-thumb${thumbnailUrl ? ' has-image' : ''}`}
            onClick={() => !thumbnailUploading && thumbInputRef.current?.click()}
          >
            {thumbnailUrl ? (
              <>
                <img src={thumbnailUrl} alt="Album thumbnail" />
                <button
                  type="button"
                  className="audio-upload-album-thumb-remove"
                  onClick={(e) => { e.stopPropagation(); setThumbnailUrl(''); }}
                  aria-label="Remove thumbnail"
                ><MdClose size={14} /></button>
              </>
            ) : (
              <>
                <MdCloudUpload size={28} />
                <span>{thumbnailUploading ? 'Uploading…' : 'Add cover image'}</span>
                <small>Click to pick — JPG / PNG / WebP</small>
              </>
            )}
            <input
              ref={thumbInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={onThumbnailFile}
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          <div className="audio-upload-playlist-form-actions">
            <button
              type="button"
              className="audio-upload-btn-secondary"
              onClick={resetForm}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="button"
              className="audio-upload-btn-primary"
              onClick={submit}
              disabled={submitting || !newName.trim()}
            >
              {submitting ? 'Creating…' : 'Create'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Step 2: Settings (publish target + reward mode) ───
function SettingsStep({ tracks, patchTrack, isPublishing, publishStatus = {}, rewardMode, setRewardMode, publishAs, setPublishAs }) {
  const locked = isPublishing || tracks.some(t => publishStatus[t.id]?.state);
  const single = tracks.length === 1;
  return (
    <div className="audio-upload-review">
      <p className="audio-upload-step-help">Choose how this audio is published.</p>

      <div className="audio-upload-titles">
        <span className="audio-upload-reward-label">What kind of audio is this?</span>
        {tracks.map((t, i) => (
          <div key={t.id} className="audio-upload-title-card">
            <div className="audio-upload-title-row">
              <span className="audio-upload-title-num">{i + 1}.</span>
              <span className="audio-upload-title-input" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {t.title || t.filename}
              </span>
              <select
                className="audio-upload-type-select"
                value={t.type || 'voice_message'}
                onChange={(e) => patchTrack(t.id, { type: e.target.value })}
                disabled={locked}
              >
                {TRACK_TYPES.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            {t.type === 'song' && (
              <div className="audio-upload-music-row">
                <input
                  type="text"
                  className="audio-upload-genre-input"
                  value={t.genre || ''}
                  onChange={(e) => patchTrack(t.id, { genre: e.target.value })}
                  placeholder="Genre"
                  list="audio-upload-genre-options"
                  maxLength={60}
                  disabled={locked}
                />
                <input
                  type="number"
                  className="audio-upload-bpm-input"
                  value={t.bpm || ''}
                  onChange={(e) => patchTrack(t.id, { bpm: e.target.value })}
                  placeholder="BPM"
                  min="20"
                  max="400"
                  disabled={locked}
                />
              </div>
            )}
            <div className="audio-upload-title-meta-line">
              <span>{fmtTime(t.durationSec)} · {t.source === 'record' ? 'Recorded' : t.filename}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="audio-upload-reward">
        <span className="audio-upload-reward-label">How should this be published?</span>
        <button
          type="button"
          className={`audio-upload-reward-opt${publishAs === 'snap' ? ' is-active' : ''}`}
          onClick={() => setPublishAs('snap')}
          disabled={locked}
        >
          <strong>Snap comment</strong>
          <small>Posts as a reply under the latest peak.snaps container — shows in the Snaps feed (default).</small>
        </button>
        <button
          type="button"
          className={`audio-upload-reward-opt${publishAs === 'post' ? ' is-active' : ''}`}
          onClick={() => single && setPublishAs('post')}
          disabled={locked || !single}
        >
          <strong>Standalone post{!single ? ' (single file only)' : ''}</strong>
          <small>Publishes as its own top-level Hive post with a title, community, tags &amp; thumbnail.</small>
        </button>
      </div>

      {ENABLE_PPL && (
        <div className="audio-upload-reward">
          <span className="audio-upload-reward-label">How should this audio earn?</span>
          <button
            type="button"
            className={`audio-upload-reward-opt${rewardMode === 'post' ? ' is-active' : ''}`}
            onClick={() => setRewardMode('post')}
            disabled={locked}
          >
            <strong>Post rewards (one-time)</strong>
            <small>You receive the normal Hive author payout for this post — paid out once, ~7 days after publishing.</small>
          </button>
          <button
            type="button"
            className={`audio-upload-reward-opt${rewardMode === 'ppl' ? ' is-active' : ''}`}
            onClick={() => setRewardMode('ppl')}
            disabled={locked}
          >
            <strong>Pay-per-listen (lifetime)</strong>
            <small>
              All post rewards go to @{PPL_BENEFICIARY}. Instead of a single payout,
              a 3Speak program pays you per listen for the lifetime of the track.
            </small>
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Step 4: Description (snap → description only; post → full composer) ───
function DescriptionStep({
  isPost, title, setTitle, description, setDescription,
  community, setCommunityOpen, tagsInput, setTagsInput,
  thumb, setThumb, thumbUploading, thumbRef, onThumbFile,
}) {
  return (
    <div className="audio-upload-review audio-upload-post-form">
      {isPost ? (
        <>
          <p className="audio-upload-step-help">Details for your standalone post.</p>

          <input
            type="text"
            className="audio-upload-post-tags"
            placeholder="Title (required)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />

          <button
            type="button"
            className="audio-upload-community-btn"
            onClick={() => setCommunityOpen(true)}
          >
            {community
              ? <><img src={`https://images.hive.blog/u/${community.name}/avatar/small`} alt="" />{community.title || community.name}</>
              : <>Select community</>}
            <span className="audio-upload-community-change">Change</span>
          </button>

          <input
            type="text"
            className="audio-upload-post-tags"
            placeholder="Tags — space or comma separated (optional)"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
          />

          <textarea
            className="audio-upload-post-desc"
            placeholder="Description (optional)"
            rows={4}
            maxLength={5000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          <div
            className={`audio-upload-album-thumb${thumb ? ' has-image' : ''}`}
            onClick={() => !thumbUploading && thumbRef.current?.click()}
          >
            {thumb ? (
              <>
                <img src={thumb} alt="Post thumbnail" />
                <button
                  type="button"
                  className="audio-upload-album-thumb-remove"
                  onClick={(e) => { e.stopPropagation(); setThumb(''); }}
                  aria-label="Remove thumbnail"
                ><MdClose size={14} /></button>
              </>
            ) : (
              <>
                <MdCloudUpload size={26} />
                <span>{thumbUploading ? 'Uploading…' : 'Add cover image'}</span>
                <small>JPG / PNG / WebP</small>
              </>
            )}
            <input
              ref={thumbRef}
              type="file"
              accept="image/*"
              hidden
              onChange={onThumbFile}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </>
      ) : (
        <>
          <p className="audio-upload-step-help">Add a description for your snap (optional).</p>
          <textarea
            className="audio-upload-post-desc"
            placeholder="Description (optional)"
            rows={4}
            maxLength={5000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </>
      )}
    </div>
  );
}

// ─── Step 5: Review (summary + publish) ───
function ReviewStep({ tracks, playlists, playlistChoice, pendingPlaylist, publishStatus = {}, onRetry, onRetryAll, isPublishing, publishAs, rewardMode, community }) {
  const chosen = playlists.find(p => p.id === playlistChoice)
    || (pendingPlaylist && pendingPlaylist.id === playlistChoice ? pendingPlaylist : null);
  const failedCount = tracks.filter((t) => publishStatus[t.id]?.state === 'error').length;
  const isPost = tracks.length === 1 && publishAs === 'post';
  return (
    <div className="audio-upload-review">
      <p className="audio-upload-step-help">
        Ready to publish {tracks.length} track{tracks.length !== 1 ? 's' : ''}
        {chosen ? ` to playlist "${chosen.name}"` : ''}.
      </p>

      <div className="audio-upload-review-summary">
        <div><strong>Publish as:</strong> {isPost ? `Standalone post${community ? ` in ${community.title || community.name}` : ''}` : 'Snap comment'}</div>
        <div><strong>Earnings:</strong> {rewardMode === 'ppl' ? `Pay-per-listen (@${PPL_BENEFICIARY})` : 'Normal post rewards'}</div>
        {chosen && <div><strong>Playlist:</strong> {chosen.name}</div>}
      </div>

      {failedCount > 0 && (
        <div className="audio-upload-review-failed-banner">
          <span>{failedCount} track{failedCount !== 1 ? 's' : ''} failed.</span>
          <button
            type="button"
            className="audio-upload-btn-secondary"
            onClick={onRetryAll}
            disabled={isPublishing}
          >
            Retry all failed
          </button>
        </div>
      )}

      {tracks.map((t, i) => {
        const status = publishStatus[t.id];
        return (
          <div key={t.id} className={`audio-upload-review-row${status?.state ? ` is-${status.state}` : ''}`}>
            <div className="audio-upload-review-info">
              <span className="audio-upload-review-num">{i + 1}.</span>
              <strong className="audio-upload-review-title">{t.title}</strong>
              <small className="audio-upload-review-meta">
                {fmtTime(t.durationSec)} · {t.source === 'record' ? 'Recorded' : t.filename}
              </small>
              {status && <PublishBadge status={status} />}
            </div>

            {status?.state === 'error' && (
              <div className="audio-upload-review-error">
                <p className="audio-upload-review-error-msg">
                  {status.stage ? `Failed during ${status.stage.toLowerCase()}: ` : 'Failed: '}
                  {status.message || 'unknown error'}
                </p>
                <button
                  type="button"
                  className="audio-upload-btn-primary"
                  onClick={() => onRetry?.(t.id)}
                  disabled={isPublishing}
                >
                  Retry
                </button>
              </div>
            )}

            <audio controls preload="metadata" src={t.objectUrl} className="audio-upload-review-player" />
          </div>
        );
      })}
    </div>
  );
}

function PublishBadge({ status }) {
  if (!status?.state || status.state === 'pending') return null;
  if (status.state === 'uploading') return <span className="audio-upload-review-badge uploading">{status.stage || 'Uploading'}…</span>;
  if (status.state === 'posting') return <span className="audio-upload-review-badge posting">{status.stage || 'Posting to Hive'}…</span>;
  if (status.state === 'success') return <span className="audio-upload-review-badge success"><MdCheck size={12} /> Published</span>;
  if (status.state === 'error') return <span className="audio-upload-review-badge error">Failed</span>;
  return null;
}

export default AudioUploadModal;
