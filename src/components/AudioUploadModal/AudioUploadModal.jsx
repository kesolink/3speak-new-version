import { useState, useRef, useEffect, useCallback } from 'react';
import {
  MdClose, MdCloudUpload, MdMic, MdStop, MdDelete,
  MdArrowBack, MdArrowForward, MdPlaylistAdd, MdPlaylistAddCheck,
  MdPublic, MdLock, MdCheck, MdAdd,
} from 'react-icons/md';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { KeyTypes } from '@aioha/aioha';
import { useMyPlaylists } from '../../hooks/useMyPlaylists';
import { createPlaylist } from '../../utils/playlistOperations';
import { uploadAudioTo3Speak, getSnapsContainer } from '../../utils/audioUpload';
import { broadcastWithAioha } from '../../hive-api/aioha';
import { useAppStore } from '../../lib/store';
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
  { id: 2, label: 'Titles' },
  { id: 3, label: 'Playlist' },
  { id: 4, label: 'Review' },
];

const MAX_RECORD_SEC = 300;
const AUDIO_EXT_RE = /\.(mp3|wav|ogg|webm|m4a|flac|aac)$/i;

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

function AudioUploadModal({ isOpen, onClose }) {
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

  const addBlobAsTrack = useCallback(async (blob, filename, source = 'file') => {
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
    }]);
  }, []);

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

  const handleCreatePlaylist = useCallback(async ({ name, access }) => {
    if (!user) { toast.error('Sign in first'); return; }
    const trimmed = name.trim();
    if (!trimmed) { toast.error('Enter a playlist name'); return; }
    const playlistId = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    try {
      toast.info(`Creating playlist "${trimmed}"…`);
      await createPlaylist(trimmed, access, playlistId, [], 'audio');
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

  if (!isOpen) return null;

  const canNext = (() => {
    if (step === 1) return tracks.length > 0 && !isRecording;
    if (step === 2) return tracks.every(t => t.title.trim().length > 0);
    if (step === 3) return true;
    return false;
  })();

  const goNext = () => setStep(s => Math.min(s + 1, 4));
  const goBack = () => setStep(s => Math.max(s - 1, 1));

  const setTrackStatus = (trackId, patch) => {
    setPublishStatus(prev => ({ ...prev, [trackId]: { ...(prev[trackId] || {}), ...patch } }));
  };

  const onPublish = async () => {
    if (!user) { toast.error('Sign in first'); return; }
    if (tracks.length === 0) return;
    setIsPublishing(true);

    const initial = {};
    for (const t of tracks) initial[t.id] = { state: 'pending' };
    setPublishStatus(initial);

    // Resolve snap container once for the whole batch
    let container;
    try {
      container = await getSnapsContainer();
    } catch (err) {
      setIsPublishing(false);
      toast.error(`Couldn't resolve peak.snaps container: ${err?.message || 'unknown'}`);
      return;
    }

    let allOk = true;
    for (const track of tracks) {
      try {
        // 1) Upload to 3Speak audio service
        setTrackStatus(track.id, { state: 'uploading' });
        const { permlink: audioPermlink, playUrl } = await uploadAudioTo3Speak({
          blob: track.blob,
          durationSec: track.durationSec,
          username: user,
          title: track.title,
        });

        // 2) Broadcast snap-style comment under peak.snaps + optional playlist add
        setTrackStatus(track.id, { state: 'posting', playUrl });
        const hivePermlink = generatePermlink(track.title) || audioPermlink;
        const tags = Array.from(new Set(HIVE_DEFAULT_TAGS));
        const body = `${(track.title || '').trim()}\n\n${playUrl}`.trim();
        const json_metadata = JSON.stringify({ app: HIVE_APP_NAME, tags });

        const ops = [[
          'comment',
          {
            parent_author: container.author,
            parent_permlink: container.permlink,
            author: user,
            permlink: hivePermlink,
            title: '',
            body,
            json_metadata,
          },
        ]];

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
        setTrackStatus(track.id, { state: 'success' });
      } catch (err) {
        allOk = false;
        setTrackStatus(track.id, { state: 'error', message: err?.message || 'Failed' });
      }
    }

    setIsPublishing(false);

    if (allOk) {
      toast.success(`Published ${tracks.length} track${tracks.length !== 1 ? 's' : ''}`);
      queryClient.invalidateQueries({ queryKey: ['myPlaylists', user] });
      setTimeout(() => onClose(), 1200);
    } else {
      toast.error('Some tracks failed to publish — see details');
    }
  };

  return (
    <div className="audio-upload-overlay" onClick={attemptClose}>
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
            <TitlesStep tracks={tracks} setTitle={setTitle} onRemove={removeTrack} />
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
            <ReviewStep
              tracks={tracks}
              playlists={playlists}
              playlistChoice={playlistChoice}
              pendingPlaylist={pendingPlaylist}
              publishStatus={publishStatus}
            />
          )}
        </div>

        <div className="audio-upload-footer">
          {step > 1 ? (
            <button className="audio-upload-btn-secondary" onClick={goBack} disabled={isPublishing}>
              <MdArrowBack size={16} /> Back
            </button>
          ) : <span />}
          {step < 4 ? (
            <button className="audio-upload-btn-primary" onClick={goNext} disabled={!canNext}>
              Next <MdArrowForward size={16} />
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

function TitlesStep({ tracks, setTitle, onRemove }) {
  return (
    <div className="audio-upload-titles">
      <p className="audio-upload-step-help">Give each track a title. We pre-filled them from filenames.</p>
      {tracks.map((t, i) => (
        <div key={t.id} className="audio-upload-title-row">
          <span className="audio-upload-title-num">{i + 1}.</span>
          <input
            type="text"
            className="audio-upload-title-input"
            value={t.title}
            onChange={(e) => setTitle(t.id, e.target.value)}
            placeholder="Track title"
            maxLength={120}
          />
          <span className="audio-upload-track-meta">{fmtTime(t.durationSec)}</span>
          <button className="audio-upload-track-remove" onClick={() => onRemove(t.id)} aria-label="Remove">
            <MdDelete size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

function PlaylistStep({ playlists, loading, choice, onChoose, pendingPlaylist, onCreate }) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newAccess, setNewAccess] = useState('public');
  const [submitting, setSubmitting] = useState(false);

  const showPending = pendingPlaylist && !playlists.some(p => p.id === pendingPlaylist.id);

  const submit = async () => {
    setSubmitting(true);
    const ok = await onCreate({ name: newName, access: newAccess });
    setSubmitting(false);
    if (ok) {
      setShowCreateForm(false);
      setNewName('');
      setNewAccess('public');
    }
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
          <div className="audio-upload-playlist-form-actions">
            <button
              type="button"
              className="audio-upload-btn-secondary"
              onClick={() => { setShowCreateForm(false); setNewName(''); }}
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

function ReviewStep({ tracks, playlists, playlistChoice, pendingPlaylist, publishStatus = {} }) {
  const chosen = playlists.find(p => p.id === playlistChoice)
    || (pendingPlaylist && pendingPlaylist.id === playlistChoice ? pendingPlaylist : null);
  return (
    <div className="audio-upload-review">
      <p className="audio-upload-step-help">
        Ready to publish {tracks.length} track{tracks.length !== 1 ? 's' : ''}
        {chosen ? ` to playlist "${chosen.name}"` : ''}.
      </p>
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
            <audio controls preload="metadata" src={t.objectUrl} className="audio-upload-review-player" />
          </div>
        );
      })}
    </div>
  );
}

function PublishBadge({ status }) {
  if (!status?.state || status.state === 'pending') return null;
  if (status.state === 'uploading') return <span className="audio-upload-review-badge uploading">Uploading…</span>;
  if (status.state === 'posting') return <span className="audio-upload-review-badge posting">Posting to Hive…</span>;
  if (status.state === 'success') return <span className="audio-upload-review-badge success"><MdCheck size={12} /> Published</span>;
  if (status.state === 'error') return <span className="audio-upload-review-badge error" title={status.message}>Failed</span>;
  return null;
}

export default AudioUploadModal;
