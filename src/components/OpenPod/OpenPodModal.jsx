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

  if (!isOpen || !roomName) return null;

  const handleRecordingUploaded = (result) => {
    onClose();
    navigate(`/openpods/publish?audioUrl=${encodeURIComponent(result.playUrl)}&title=${encodeURIComponent(roomName)}`);
  };

  return (
    <div className="openpod-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="openpod-modal" data-hh-theme="dark">
        <button className="openpod-modal-close" onClick={onClose} aria-label="Close OpenPod">✕</button>
        <HangoutsProvider
          apiBaseUrl={API_URL}
          livekitServerUrl={LK_URL}
          imageServerApiKey={IMAGE_KEY || undefined}
          sessionToken={sessionToken || undefined}
          username={username || undefined}
        >
          <HangoutsRoom
            roomName={roomName}
            onLeave={onClose}
            onRecordingUploaded={handleRecordingUploaded}
            video
            embedded
            maxHeight="78vh"
          />
        </HangoutsProvider>
      </div>
    </div>
  );
}
