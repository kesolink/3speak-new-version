import { useState, useEffect } from 'react';
import { HangoutsProvider, HangoutsRoom } from '@snapie/hangouts-react';
import '@snapie/hangouts-react/src/styles/hangouts.css';
import { useNavigate } from 'react-router-dom';
import { useWakeLock } from '../../hooks/useWakeLock';
import './OpenPodModal.scss';

const API_URL = import.meta.env.VITE_HANGOUTS_API_URL;
const LK_URL  = import.meta.env.VITE_LIVEKIT_URL || 'wss://livekit.3speak.tv';
const IMAGE_KEY = import.meta.env.VITE_IMAGE_SERVER_API_KEY;

export default function OpenPodModal({ isOpen, onClose, roomName, sessionToken, username }) {
  const navigate = useNavigate();
  useWakeLock(isOpen);

  // React fires child effects before parent effects. Without this flag,
  // HangoutsRoom.useEffect (join) fires before HangoutsProvider.useEffect
  // (setSessionToken on apiClient) — causing a 401 on every first join attempt.
  // By deferring HangoutsRoom's mount to the render AFTER HangoutsProvider's
  // effects have run, the token is guaranteed to be set before join() is called.
  const [roomReady, setRoomReady] = useState(false);
  useEffect(() => {
    setRoomReady(!!sessionToken && isOpen && !!roomName);
  }, [sessionToken, isOpen, roomName]);

  if (!isOpen || !roomName) return null;

  const handleRecordingUploaded = (result) => {
    onClose();
    navigate(
      `/openpods/publish?audioUrl=${encodeURIComponent(result.playUrl)}` +
      `&title=${encodeURIComponent(roomName)}` +
      `&audioPerm=${encodeURIComponent(result.permlink)}` +
      `&roomName=${encodeURIComponent(roomName)}`
    );
  };

  return (
    <div className="openpod-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="openpod-modal" data-hh-theme="dark">
        <button className="openpod-modal-close" onClick={onClose} aria-label="Close OpenPod">✕</button>
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
              onRecordingUploaded={handleRecordingUploaded}
              video
              embedded
              maxHeight="78vh"
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
