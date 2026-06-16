import { useEffect, useRef } from 'react';
import { HangoutsProvider, RoomLobby } from '@snapie/hangouts-react';
import '@snapie/hangouts-react/src/styles/hangouts.css';
import { useNavigate, useParams } from 'react-router-dom';
import { useAioha } from '@aioha/react-ui';
import { Providers } from '@aioha/aioha';
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

// Strip any trailing slash — useHangoutsRoom builds `${apiBaseUrl}/rooms` with a
// raw fetch, so a trailing slash yields `//rooms` and a 404 from the API.
const API_URL = (import.meta.env.VITE_HANGOUTS_API_URL || '').replace(/\/$/, '');
const LK_URL = import.meta.env.VITE_LIVEKIT_URL || 'wss://livekit.3speak.tv';
const IMAGE_KEY = import.meta.env.VITE_IMAGE_SERVER_API_KEY;
const HANGOUT_BASE_URL = 'https://3speak.tv/openpods';

export default function OpenPods() {
  const { openRoom, sessionToken, sessionLoading, hangoutsUser, retryLogin } = useHangout();
  const { authenticated, user } = useAppStore();
  const { aioha, provider, user: aiohaUser } = useAioha();
  const navigate = useNavigate();
  const { roomName: roomNameFromUrl } = useParams();

  // A session we can actually hand over to OpenPods: the user is signed in on
  // 3Speak with a wallet that can sign a challenge. HiveSigner can't sign
  // messages, and a stale `authenticated` flag with no live provider can't
  // either — neither counts.
  const canHandover = !!provider && provider !== Providers.HiveSigner && !!aiohaUser;

  // If they're genuinely signed in on 3Speak, hand that session over in the
  // background so hosting/speaking lights up automatically. Otherwise do
  // nothing — they browse as a guest and sign on demand (button below).
  // Either way the lobby renders immediately and never blocks.
  useEffect(() => {
    if (canHandover && !sessionToken && !sessionLoading) {
      retryLogin(aiohaUser || user);
    }
  }, [canHandover, aiohaUser, user, sessionToken, sessionLoading, retryLogin]);

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

  // Single guest-first path: the lobby always renders, so visitors can browse
  // active OpenPods and drop into any room as listen-only guests (the SDK's
  // `allowGuestBrowse` / `guestFallback` handle the /listen flow). A hangouts
  // `sessionToken` — handed over from the user's 3Speak wallet session — simply
  // unlocks hosting and speaking on top of that. We never block on it.
  return (
    <div className="openpods-page" data-hh-theme="dark">
      <HangoutsProvider
        apiBaseUrl={API_URL}
        livekitServerUrl={LK_URL}
        imageServerApiKey={IMAGE_KEY || undefined}
        sessionToken={sessionToken || undefined}
        username={hangoutsUser || undefined}
        aioha={aioha}
      >
        <RoomLobby
          onJoinRoom={handleJoinRoom}
          onRoomCreated={handleRoomCreated}
          allowGuestBrowse
        />
      </HangoutsProvider>

      {/* No session yet → show the right call-to-action without blocking the
          lobby. Signing in progress · can hand over on demand · not signed in. */}
      {!sessionToken && (
        <div className="openpods-guest-cta">
          {sessionLoading ? (
            <span className="openpods-connecting__action">{providerSignPrompt(provider)}</span>
          ) : canHandover ? (
            <button className="openpods-login-btn" onClick={() => retryLogin(aiohaUser || user)}>
              Enable hosting &amp; speaking
            </button>
          ) : (
            <button className="openpods-login-btn" onClick={() => navigate('/login')}>
              Sign in with Hive to host or speak
            </button>
          )}
        </div>
      )}
    </div>
  );
}
