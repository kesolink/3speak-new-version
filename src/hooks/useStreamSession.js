import { useEffect, useRef, useState } from 'react';
import { useAioha } from '@aioha/react-ui';
import { useHangout } from '../context/HangoutContext';
import { useAppStore } from '../lib/store';

/**
 * Everything a page needs to join an OpenPods room AS THE LOGGED-IN HIVE USER.
 *
 * Handing the 3Speak session over to the hangouts backend is asynchronous, and
 * two things go wrong if you just connect immediately:
 *
 *   - a cold load (opening a stream by URL) hasn't finished the handover yet,
 *     so the viewer joins as an anonymous guest — wrong chat name, and the
 *     server drops their messages before the streamer ever sees them;
 *   - the SDK joins ONCE, so a token that lands later never upgrades the
 *     identity. `joinKey` exists to be used as a React `key` on
 *     <StandaloneWatch>, forcing a re-join under the real user.
 *
 * Shared by the shorts-style mobile stream page and the live player embedded in
 * the normal watch page, which must behave identically — a viewer who chats
 * from one and then the other should be the same person both times.
 */
export function useStreamSession() {
  const { sessionToken, sessionLoading, retryLogin, hangoutsUser } = useHangout();
  const { aioha, user: aiohaUser } = useAioha();
  const authenticated = useAppStore((s) => s.authenticated);
  const user = useAppStore((s) => s.user);

  // NOT limited to wallets that can sign client-side: the challenge is signed
  // server-side by @threespeak's delegated posting authority, which covers
  // HiveSigner and ManteAuth too. Gating on a signable provider meant mobile
  // viewers — who have no Keychain extension — silently joined as guests.
  const handoverUser = aiohaUser || user;
  const canHandover = !!authenticated && !!handoverUser;
  const triedRef = useRef(null);
  useEffect(() => {
    if (!canHandover || sessionToken || sessionLoading) return;
    // One automatic attempt per user — a failure clears sessionLoading, which
    // would otherwise re-trigger this effect in a loop.
    if (triedRef.current === handoverUser) return;
    triedRef.current = handoverUser;
    retryLogin(handoverUser);
  }, [canHandover, handoverUser, sessionToken, sessionLoading, retryLogin]);

  // Give the handover a moment before falling back to a guest connection.
  const [waited, setWaited] = useState(false);
  useEffect(() => { const t = setTimeout(() => setWaited(true), 4000); return () => clearTimeout(t); }, []);

  return {
    aioha,
    authenticated,
    sessionToken,
    hangoutsUser,
    connectReady: !!sessionToken || !canHandover || waited,
    joinKey: sessionToken ? `auth-${hangoutsUser || 'user'}` : 'guest',
  };
}
