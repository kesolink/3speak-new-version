import { useCallback, useEffect, useRef, useState } from 'react';
import { HangoutsProvider, RoomLobby } from '@snapie/hangouts-react';
import '@snapie/hangouts-react/src/styles/hangouts.css';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAioha } from '@aioha/react-ui';
import { useHangout } from '../context/HangoutContext';
import { useAppStore } from '../lib/store';
import { usePremiumStatus } from '../hooks/usePremiumStatus';
import { providerSignPrompt } from '../utils/aiohaProviderUi';
import { OPENPODS_STANDALONE } from '../utils/config';
import { defaultEndpoint, pickLeastLoadedEndpoint, fetchAllEndpoints } from '../utils/hangoutsEndpoints';
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
  const location = useLocation();
  const { roomName: roomNameFromUrl } = useParams();
  const premiumStatus = usePremiumStatus(user);
  const isPremium = !!premiumStatus?.premium;

  // New sessions go to whichever deployment reports the lightest load
  // (fewest sessions, then fewest viewers) via its /health.
  const [endpoint, setEndpoint] = useState(() => defaultEndpoint());
  useEffect(() => {
    let alive = true;
    pickLeastLoadedEndpoint().then((ep) => { if (alive) setEndpoint(ep); });
    return () => { alive = false; };
  }, []);

  // A session we can hand over to OpenPods. Deliberately NOT limited to wallets
  // that can sign client-side: the challenge is signed server-side by
  // @threespeak's DELEGATED posting authority, which works for every login type
  // — including HiveSigner and ManteAuth, neither of which can sign a buffer in
  // the browser. loginToHangouts tries that delegated signer FIRST and only
  // falls back to a client-side signature. Gating on a signable provider (as
  // this used to) meant mobile users, who have no Keychain extension, never got
  // a handover at all and were told to sign in again.
  const handoverUser = aiohaUser || user;
  const canHandover = !!authenticated && !!handoverUser;

  // If they're genuinely signed in on 3Speak, hand that session over in the
  // background so hosting/speaking lights up automatically. Otherwise do
  // nothing — they browse as a guest and sign on demand (button below).
  // Either way the lobby renders immediately and never blocks.
  const handoverTriedRef = useRef(null);
  const [handoverFailed, setHandoverFailed] = useState(false);
  useEffect(() => {
    if (!canHandover || sessionToken || sessionLoading) return;
    // Exactly ONE automatic attempt per user. A failed handover clears
    // sessionLoading, which re-triggers this effect — without this guard a user
    // who hasn't granted @threespeak posting authority would sit in a tight
    // retry loop hammering /openpods/sign-challenge with 403s.
    if (handoverTriedRef.current === handoverUser) return;
    handoverTriedRef.current = handoverUser;
    setHandoverFailed(false);
    Promise.resolve(retryLogin(handoverUser)).then((token) => {
      if (!token) setHandoverFailed(true);
    });
  }, [canHandover, handoverUser, sessionToken, sessionLoading, retryLogin]);

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

  // List rooms from EVERY deployment, not just the one we'd create on.
  // Joining still works by name — OpenPodModal resolves the owning host.
  // useCallback keeps the identity stable so the lobby's 10s poll survives.
  const fetchAllRooms = useCallback(() => fetchAllEndpoints('/rooms'), []);

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
        apiBaseUrl={endpoint.api}
        livekitServerUrl={endpoint.lk}
        imageServerApiKey={IMAGE_KEY || undefined}
        sessionToken={sessionToken || undefined}
        username={hangoutsUser || undefined}
        aioha={aioha}
      >
        <RoomLobby
          /* "Go Live" links to /openpods?create=1 — open the create form
             straight away instead of making the host find the button. The
             dialog itself stays gated on being authenticated, so it appears
             as soon as the handover lands. */
          defaultCreateOpen={new URLSearchParams(location.search).get('create') === '1'}
          onJoinRoom={handleJoinRoom}
          onRoomCreated={handleRoomCreated}
          fetchRooms={fetchAllRooms}
          allowGuestBrowse
          allowStandalone={OPENPODS_STANDALONE}
          isPremium={isPremium}
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
            <>
              <button
                className="openpods-login-btn"
                onClick={() => {
                  handoverTriedRef.current = null;
                  setHandoverFailed(false);
                  retryLogin(handoverUser);
                }}
              >
                Enable hosting &amp; speaking
              </button>
              {handoverFailed && (
                <p className="openpods-guest-cta__hint">
                  Couldn’t enable hosting automatically. OpenPods posts on your behalf via
                  @threespeak — check that you’ve granted it posting authority, then try again.
                </p>
              )}
            </>
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
