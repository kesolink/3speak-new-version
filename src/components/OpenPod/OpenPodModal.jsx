import { useState, useEffect } from 'react';
import { HangoutsProvider, HangoutsRoom } from '@snapie/hangouts-react';
import '@snapie/hangouts-react/src/styles/hangouts.css';
import { useWakeLock } from '../../hooks/useWakeLock';
import './OpenPodModal.scss';

const API_URL = import.meta.env.VITE_HANGOUTS_API_URL;
const LK_URL  = import.meta.env.VITE_LIVEKIT_URL || 'wss://livekit.3speak.tv';
const IMAGE_KEY = import.meta.env.VITE_IMAGE_SERVER_API_KEY;

// Hostnames whose rooms should be shared via the 3speak.tv deep link
// (where 3speak users land back inside their existing session). Anything
// else falls back to the standalone hangout site.
const THREE_SPEAK_HOSTS = new Set(['3speak.tv', 'preview.3speak.tv', '3speak.okinoko.io']);

function buildOpenPodShareUrl(roomName, origin) {
  if (origin && THREE_SPEAK_HOSTS.has(origin)) {
    return `https://3speak.tv/openpods/${roomName}`;
  }
  return `https://hangout.3speak.tv/room/${roomName}`;
}

export default function OpenPodModal({ isOpen, onClose, roomName, sessionToken, username, isAuthenticated }) {
  useWakeLock(isOpen);

  // React fires child effects before parent effects. Without this flag,
  // HangoutsRoom.useEffect (join) fires before HangoutsProvider.useEffect
  // (setSessionToken on apiClient) — causing a 401 on every first join attempt.
  // By deferring HangoutsRoom's mount to the render AFTER HangoutsProvider's
  // effects have run, the token is guaranteed to be set before join() is called.
  // Guests don't need a session token, so they're ready as soon as the
  // modal opens.
  const [roomReady, setRoomReady] = useState(false);
  useEffect(() => {
    if (!isOpen || !roomName) {
      setRoomReady(false);
      return;
    }
    // Authenticated user → wait for the hangouts session token first.
    // Unauthenticated visitor → guest path; nothing to wait for.
    setRoomReady(isAuthenticated ? !!sessionToken : true);
  }, [sessionToken, isOpen, roomName, isAuthenticated]);

  if (!isOpen || !roomName) return null;

  // Audio recordings: close the OpenPods modal and forward the blob to
  // the AudioUploadModal at App level, pre-typed as a podcast. App.jsx
  // listens for the custom event and seeds the modal's first track.
  const handleAudioHandoff = (file) => {
    onClose();
    window.dispatchEvent(new CustomEvent('open-audio-upload', {
      detail: {
        blob: file.blob,
        filename: file.filename,
        type: 'podcast',
      },
    }));
  };

  // Video recordings: park the MP4 in the share-target Cache that the
  // legacy /studio PWA-share pickup reads from, then navigate. Same
  // mechanic the SDK previously hardcoded — now provided by the
  // integrator so the SDK stays generic.
  const handleVideoHandoff = async (file) => {
    try {
      const cache = await caches.open('share-target-cache');
      await cache.put('/shared-video', new Response(file.blob, {
        headers: {
          'Content-Type': file.blob.type || 'video/mp4',
          'X-File-Name': file.filename,
        },
      }));
      onClose();
      window.location.href = '/studio?shared=true';
    } catch (err) {
      console.error('OpenPod video handoff failed:', err);
    }
  };

  return (
    <div
      className="openpod-modal-overlay"
      onClick={(e) => {
        // Only count clicks that landed on the overlay itself, not
        // bubbled clicks from inside the modal. Confirm before
        // leaving so the host doesn't accidentally drop the room
        // by missing the modal edge.
        if (e.target !== e.currentTarget) return;
        if (window.confirm('Leave this OpenPod? You can rejoin from the lobby anytime.')) {
          onClose();
        }
      }}
    >
      <div className="openpod-modal" data-hh-theme="dark">
        <HangoutsProvider
          apiBaseUrl={API_URL}
          livekitServerUrl={LK_URL}
          imageServerApiKey={IMAGE_KEY || undefined}
          sessionToken={sessionToken}
          username={username || undefined}
        >
          {roomReady ? (
            <HangoutsRoom
              roomName={roomName}
              onLeave={onClose}
              onVideoHandoff={handleVideoHandoff}
              onAudioHandoff={handleAudioHandoff}
              video
              embedded
              guestFallback
              getShareUrl={buildOpenPodShareUrl}
            />
          ) : (
            <div className="openpod-connecting">
              {sessionToken ? 'Connecting to OpenPods…' : 'Authenticating with OpenPods…'}
            </div>
          )}
        </HangoutsProvider>
      </div>
    </div>
  );
}
