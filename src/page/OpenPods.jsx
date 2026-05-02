import { HangoutsProvider, RoomLobby } from '@snapie/hangouts-react';
import '@snapie/hangouts-react/src/styles/hangouts.css';
import { useNavigate } from 'react-router-dom';
import { useHangout } from '../context/HangoutContext';
import { useAppStore } from '../lib/store';
import { commentWithAioha } from '../hive-api/aioha';
import { toast } from 'sonner';
import {
  fetchLatestSnapsPost,
  buildOpenPodSnapBody,
  buildOpenPodPermlink,
  buildOpenPodSnapMetadata,
} from '../utils/openpodUtils';
import './OpenPods.scss';

const API_URL = import.meta.env.VITE_HANGOUTS_API_URL;
const LK_URL = import.meta.env.VITE_LIVEKIT_URL || 'wss://livekit.3speak.tv';
const IMAGE_KEY = import.meta.env.VITE_IMAGE_SERVER_API_KEY;
const HANGOUT_BASE_URL = 'https://hangout.3speak.tv/room';

export default function OpenPods() {
  const { openRoom, sessionToken, hangoutsUser } = useHangout();
  const { authenticated, user } = useAppStore();
  const navigate = useNavigate();

  const handleRoomCreated = async (room) => {
    // Open the modal immediately — don't wait for the snap post
    openRoom(room.name);

    // Post a snap announcement to Hive in the background
    if (!authenticated || !user) return;

    try {
      const snapPost = await fetchLatestSnapsPost();
      const roomUrl = `${HANGOUT_BASE_URL}/${room.name}`;
      const body = buildOpenPodSnapBody(room.title, roomUrl);
      const permlink = buildOpenPodPermlink();
      const metadata = buildOpenPodSnapMetadata(room.name);

      await commentWithAioha(
        snapPost.author,
        snapPost.permlink,
        permlink,
        '',
        body,
        metadata,
      );
    } catch (err) {
      // Non-blocking — the pod is live regardless of whether the snap posted
      console.error('OpenPod snap announcement failed:', err);
      toast.error('OpenPod started, but the Hive announcement could not be posted.');
    }
  };

  const handleJoinRoom = (roomName) => {
    openRoom(roomName);
  };

  if (!authenticated) {
    return (
      <div className="openpods-page">
        <div className="openpods-login-gate">
          <h2>OpenPods</h2>
          <p>Log in to start or join an OpenPod.</p>
          <button className="openpods-login-btn" onClick={() => navigate('/login')}>
            Log in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="openpods-page" data-hh-theme="dark">
      <HangoutsProvider
        apiBaseUrl={API_URL}
        livekitServerUrl={LK_URL}
        imageServerApiKey={IMAGE_KEY || undefined}
        sessionToken={sessionToken || undefined}
        username={hangoutsUser || undefined}
      >
        <RoomLobby
          onJoinRoom={handleJoinRoom}
          onRoomCreated={handleRoomCreated}
        />
      </HangoutsProvider>
    </div>
  );
}
