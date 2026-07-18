import { useEffect, useRef } from 'react';
import { HangoutsProvider, RoomLobby } from '@snapie/hangouts-react';
import '@snapie/hangouts-react/src/styles/hangouts.css';
import { useNavigate, useParams } from 'react-router-dom';
import { useAioha } from '@aioha/react-ui';
import { Providers } from '@aioha/aioha';
import { useHangout } from '../context/HangoutContext';
import { useAppStore } from '../lib/store';
import { usePremiumStatus } from '../hooks/usePremiumStatus';
import { providerSignPrompt } from '../utils/aiohaProviderUi';
import { postOpenPodAnnouncement, setPendingAnnouncement, setAnnounceConfig } from '../utils/openpodAnnounce';
import AnnounceOptions from '../components/openpods/AnnounceOptions';
import MarkdownComposer from '../components/studio/MarkdownComposer';
import './OpenPods.scss';

// Strip any trailing slash — useHangoutsRoom builds `${apiBaseUrl}/rooms` with a
// raw fetch, so a trailing slash yields `//rooms` and a 404 from the API.
const API_URL = (import.meta.env.VITE_HANGOUTS_API_URL || '').replace(/\/$/, '');
const LK_URL = import.meta.env.VITE_LIVEKIT_URL || 'wss://livekit.3speak.tv';
const IMAGE_KEY = import.meta.env.VITE_IMAGE_SERVER_API_KEY;

export default function OpenPods() {
  const { openRoom, sessionToken, sessionLoading, hangoutsUser, retryLogin } = useHangout();
  const { authenticated, user } = useAppStore();
  // Follow the 3speak-selected theme (light/dark/system) for the SDK lobby.
  const hhTheme = useAppStore((s) => s.getEffectiveTheme());
  const { aioha, provider, user: aiohaUser } = useAioha();
  const navigate = useNavigate();
  const { roomName: roomNameFromUrl } = useParams();
  const premiumStatus = usePremiumStatus(user);
  const isPremium = !!premiumStatus?.premium;

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
    // Open the modal immediately — don't wait for the Hive post
    openRoom(room.name);

    // Carry the create dialog's "Announce on Hive" choice into the shared
    // config, so the studio's own toggle opens matching it. Without this the
    // studio showed announcing as ON (its persisted default) for a room that
    // was deliberately created with announcements off.
    setAnnounceConfig({ announceEnabled: options?.notifyOnHive !== false });

    // Honor that choice — when unchecked, skip the announcement so
    // private/test rooms don't litter the user's blog.
    if (options && options.notifyOnHive === false) return;
    if (!authenticated || !user) return;

    // community/payout/beneficiaries come from the shared announce config
    // (edited in the dialog AND the studio post tab), read at post time.
    const payload = { room, options, user, isPremium };

    // A standalone stream must ONLY announce once the host actually hits
    // "Start Stream" in the studio — not when the room is created. Stash the
    // intent; OpenPodModal fires it (room-scoped) on the start signal.
    if (room.mode === 'standalone') {
      setPendingAnnouncement(payload);
      return;
    }

    // Conference rooms have no separate "start" step — announce right away.
    await postOpenPodAnnouncement(payload);
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
    <div className="openpods-page" data-hh-theme={hhTheme}>
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
          allowStandalone
          renderAnnounceOptions={(announceType) => (
            <AnnounceOptions announceType={announceType} isPremium={isPremium} />
          )}
          renderDescriptionEditor={(value, onChange) => (
            <MarkdownComposer
              value={value}
              onChange={onChange}
              placeholder="What's this session about? Add show notes, links, or a summary…"
            />
          )}
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
