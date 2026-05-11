import { useEffect, useRef } from 'react';
import { HangoutsProvider, RoomLobby } from '@snapie/hangouts-react';
import '@snapie/hangouts-react/src/styles/hangouts.css';
import { useNavigate, useParams } from 'react-router-dom';
import { useAioha } from '@aioha/react-ui';
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
import { providerSignPrompt } from '../utils/aiohaProviderUi';
import './OpenPods.scss';

const API_URL = import.meta.env.VITE_HANGOUTS_API_URL;
const LK_URL = import.meta.env.VITE_LIVEKIT_URL || 'wss://livekit.3speak.tv';
const IMAGE_KEY = import.meta.env.VITE_IMAGE_SERVER_API_KEY;
const HANGOUT_BASE_URL = 'https://3speak.tv/openpods';

export default function OpenPods() {
  const { openRoom, sessionToken, sessionLoading, hangoutsUser, retryLogin } = useHangout();
  const { authenticated, user } = useAppStore();
  const { aioha } = useAioha();
  const navigate = useNavigate();
  const { roomName: roomNameFromUrl } = useParams();

  // Lazy login: HangoutContext doesn't auto-sign on auth change anymore — only
  // when the user actively opens Hangouts. Landing on this page counts.
  useEffect(() => {
    if (authenticated && user && !sessionToken && !sessionLoading) {
      retryLogin(user);
    }
  }, [authenticated, user, sessionToken, sessionLoading, retryLogin]);

  // Deep-link: /openpods/:roomName auto-opens the modal once. We track the
  // last-opened name so closing the modal doesn't immediately reopen on the
  // next render (the URL still carries the param). A fresh nav to a different
  // room name re-fires.
  const openedDeepLinkRef = useRef(null);
  useEffect(() => {
    if (!roomNameFromUrl) return;
    if (openedDeepLinkRef.current === roomNameFromUrl) return;
    openedDeepLinkRef.current = roomNameFromUrl;
    openRoom(roomNameFromUrl);
  }, [roomNameFromUrl, openRoom]);

  const handleRoomCreated = async (room, options) => {
    // Open the modal immediately — don't wait for the snap post
    openRoom(room.name);

    // Honor the host's "Announce on Hive" checkbox from the create
    // dialog — when unchecked, skip the snap so private/test rooms
    // don't litter the user's blog.
    if (options && options.notifyOnHive === false) return;

    // Post a snap announcement to Hive in the background
    if (!authenticated || !user) return;

    try {
      const snapPost = await fetchLatestSnapsPost();
      const roomUrl = `${HANGOUT_BASE_URL}/${room.name}`;
      const body = buildOpenPodSnapBody(room.title, roomUrl, room.backgroundImage);
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

  // Unauthenticated visitors get a listen-only browse: they can see
  // active OpenPods and drop into any room as a guest. The SDK's
  // `guestFallback` on HangoutsRoom auto-calls /listen for them.
  // Skip the wallet-sign wait below since they have no Hive account.
  if (!authenticated) {
    return (
      <div className="openpods-page" data-hh-theme="dark">
        <HangoutsProvider
          apiBaseUrl={API_URL}
          livekitServerUrl={LK_URL}
          imageServerApiKey={IMAGE_KEY || undefined}
        >
          <RoomLobby
            onJoinRoom={handleJoinRoom}
            onRoomCreated={handleRoomCreated}
            allowGuestBrowse
          />
        </HangoutsProvider>
        <div className="openpods-guest-cta">
          <button className="openpods-login-btn" onClick={() => navigate('/login')}>
            Sign in with Hive to host or speak
          </button>
        </div>
      </div>
    );
  }

  // Wait for the Hangouts session token — without it HangoutsProvider would
  // show its own internal login form (wrong UX) and any join call would 401.
  if (sessionLoading || !sessionToken) {
    // While the user's wallet is processing the signing request, surface
    // *which* wallet to look at and *what* to do there. HiveAuth in
    // particular silently waits on a phone push otherwise.
    const provider = aioha?.getCurrentProvider?.() ?? null;
    const prompt = providerSignPrompt(provider);
    return (
      <div className="openpods-page">
        <div className="openpods-connecting">
          <span className="openpods-connecting__action">{prompt}</span>
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
        sessionToken={sessionToken}
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
