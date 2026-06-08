import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { HangoutsApiClient, loginWithAioha } from '@snapie/hangouts-core';
import { Providers } from '@aioha/aioha';
import { useAppStore } from '../lib/store';
import aioha from '../hive-api/aioha';

const HangoutContext = createContext(undefined);

// Module-level shared state so concurrent callers share one request and one cache
const sessionCache = new Map();
let pendingLogin = null;

// Token-persistence helpers. Off by default — see <HangoutContextProvider
// tokenStorage="local" /> to opt in. localStorage tokens survive browser
// restarts and are XSS-readable for up to the JWT TTL (24h); sessionStorage
// only survives reloads in the same tab. Keep "none" if you'd rather have
// the user re-sign on every visit.
const TOKEN_STORAGE_PREFIX = 'hh_session_';
const NOOP_STORAGE = { read: () => null, write: () => {}, clear: () => {} };
function buildTokenStorage(mode) {
  if (!mode || mode === 'none' || typeof window === 'undefined') return NOOP_STORAGE;
  if (mode !== 'local' && mode !== 'session') {
    // Custom storage object with read/write/clear — use as-is.
    return mode;
  }
  const store = mode === 'session' ? window.sessionStorage : window.localStorage;
  return {
    read(username) {
      if (!username) return null;
      try {
        const raw = store.getItem(TOKEN_STORAGE_PREFIX + username);
        if (!raw) return null;
        // Decode the JWT exp claim — reject if expired or expiring within
        // 30s so we don't hand the server a token it'll immediately reject.
        const payload = JSON.parse(atob(raw.split('.')[1]));
        if (payload.exp && payload.exp * 1000 < Date.now() + 30_000) {
          store.removeItem(TOKEN_STORAGE_PREFIX + username);
          return null;
        }
        return raw;
      } catch {
        try { store.removeItem(TOKEN_STORAGE_PREFIX + username); } catch { /* ignore */ }
        return null;
      }
    },
    write(username, token) {
      if (!username) return;
      try { store.setItem(TOKEN_STORAGE_PREFIX + username, token); } catch { /* ignore */ }
    },
    clear(username) {
      if (!username) return;
      try { store.removeItem(TOKEN_STORAGE_PREFIX + username); } catch { /* ignore */ }
    },
  };
}

const HANGOUTS_API_URL = import.meta.env.VITE_HANGOUTS_API_URL || '';
const OPENPODS_ENABLED = !!HANGOUTS_API_URL;
// No-op stub when the OpenPods API URL isn't configured, so the rest of the
// app can mount the provider without crashing. Anything that does network is
// guarded by `OPENPODS_ENABLED` and never reaches the stub.
const hangoutsClient = OPENPODS_ENABLED
  ? new HangoutsApiClient({ baseUrl: HANGOUTS_API_URL })
  : {
      setSessionToken: () => {},
      clearSessionToken: () => {},
      getSessionToken: () => null,
      listRooms: async () => [],
      requestChallenge: async () => { throw new Error('VITE_HANGOUTS_API_URL is not configured'); },
      request: async () => { throw new Error('VITE_HANGOUTS_API_URL is not configured'); },
    };

export function HangoutContextProvider({ children, tokenStorage = 'none' }) {
  const [activeRoom, setActiveRoom]       = useState(null);
  const [sessionToken, setSessionToken]   = useState(null);
  const [sessionLoading, setSessionLoading] = useState(false);

  const { authenticated, user } = useAppStore();

  // Token storage is configured at mount time and won't change between
  // renders — keeping it stable avoids re-creating the storage adapter
  // mid-session and tearing down cached entries.
  const storageRef = useRef(buildTokenStorage(tokenStorage));

  const loginToHangouts = useCallback(async (requestedUser = user) => {
    if (!OPENPODS_ENABLED) return null;
    if (!authenticated || !requestedUser) return null;

    const isStillCurrentUser = () => {
      const state = useAppStore.getState();
      return state.authenticated && state.user === requestedUser;
    };

    // Return cached token immediately — checks both in-memory cache and
    // the configured persistent storage (no-op when tokenStorage="none").
    let cached = sessionCache.get(requestedUser);
    if (!cached) {
      const persisted = storageRef.current.read(requestedUser);
      if (persisted) {
        cached = persisted;
        sessionCache.set(requestedUser, persisted);
      }
    }
    if (cached) {
      if (isStillCurrentUser()) {
        hangoutsClient.setSessionToken(cached);
        setSessionToken(cached);
      }
      return cached;
    }

    // No cached token, so we'd have to sign a fresh challenge. That needs a
    // wallet provider that can actually sign a message. The app's
    // `authenticated` flag can be true without one (a restored/stale session,
    // or a provider like HiveSigner that can't sign messages) — in that case
    // don't start a signature that can never complete. Bail and let the caller
    // stay in OpenPods guest mode instead of hanging on "Waiting for wallet…".
    const provider = aioha.getCurrentProvider?.() ?? null;
    if (!provider || provider === Providers.HiveSigner) return null;

    // Deduplicate: if a login is already in-flight, await it
    if (pendingLogin?.user === requestedUser) {
      try {
        const token = await pendingLogin.promise;
        if (isStillCurrentUser()) setSessionToken(token);
        return token;
      } catch { /* error already logged by the initiating call */ }
      return null;
    }

    // If another account is mid-signature, don't apply that token to this user.
    // Wait for it to settle, then retry only if this account is still current.
    if (pendingLogin) {
      setSessionLoading(true);
      try {
        await pendingLogin.promise;
      } catch { /* error already logged by the initiating call */ }
      return isStillCurrentUser() ? loginToHangouts(requestedUser) : null;
    }

    setSessionLoading(true);

    // Hand the already-authenticated Aioha session to the hangouts server.
    // loginWithAioha resolves the username, fetches a challenge, and signs it
    // with the active provider's posting key (Keychain, HiveAuth, PeakVault, …).
    const loginPromise = loginWithAioha(hangoutsClient, aioha, requestedUser)
      .then(session => {
        const tokenUser = session.username || requestedUser;
        sessionCache.set(tokenUser, session.token);
        storageRef.current.write(tokenUser, session.token);
        if (isStillCurrentUser()) {
          hangoutsClient.setSessionToken(session.token);
        } else {
          hangoutsClient.clearSessionToken();
        }
        return session.token;
      })
      .catch(err => {
        console.error('[OpenPods] Session auth failed:', err);
        throw err;
      })
      .finally(() => {
        if (pendingLogin?.user === requestedUser) pendingLogin = null;
      });

    pendingLogin = { user: requestedUser, promise: loginPromise };

    try {
      const token = await loginPromise;
      if (isStillCurrentUser()) setSessionToken(token);
      return token;
    } catch {
      if (isStillCurrentUser()) setSessionToken(null);
      return null;
    } finally {
      if (isStillCurrentUser()) setSessionLoading(false);
    }
  }, [authenticated, user]);

  const openRoom = useCallback((roomName) => {
    if (!roomName) return false;

    // Authenticated user → fetch a hangouts session token (lazy sign).
    // Unauthenticated visitor → still allowed: the room opens in
    // listen-only guest mode (the SDK calls /listen which doesn't need
    // a token).
    if (authenticated && user && !sessionToken && !sessionLoading) {
      loginToHangouts(user);
    }

    setActiveRoom(roomName);
    return true;
  }, [authenticated, user, sessionToken, sessionLoading, loginToHangouts]);

  // No eager login on auth change — sign-prompt is annoying on every page load.
  // Login is triggered lazily when the user actively opens Hangouts:
  //   - lands on /openpods or /openpods/publish (the pages call retryLogin)
  //   - clicks a room (openRoom() calls loginToHangouts)
  //
  // Only clear hangouts state on actual user TRANSITION (logged-out, or user
  // swap). Without the prevUserRef guard, every re-render that happens to
  // re-fire this effect would clear sessionToken / activeRoom — which makes
  // an open <OpenPodModal> unmount mid-session and close its LiveKit
  // WebSocket immediately, surfacing as "could not establish signal
  // connection" 60ms after the room appears.
  //
  // Initial mount is also explicitly NOT a "transition" — child pages
  // (e.g. /openpods/:roomName deep links) may have already set activeRoom
  // via openRoom() in their own useEffects, which fire BEFORE this parent
  // effect. Clearing here would silently swallow that deep link.
  const prevUserRef = useRef({ authenticated: null, user: null });
  const isInitialMountRef = useRef(true);
  useEffect(() => {
    if (!OPENPODS_ENABLED) return;
    const prev = prevUserRef.current;
    // Compare USER identity only — `authenticated` flips false→true after
    // the store rehydrates `user` from localStorage and the async session
    // re-verify lands. That's not a real user transition and we must not
    // clear activeRoom for it (would kill an in-flight deep-link modal).
    const sameUser = prev.user === user;
    prevUserRef.current = { authenticated, user };
    if (sameUser) return;

    if (isInitialMountRef.current) {
      // First run: record current auth state and (when applicable) restore
      // a persisted hangouts token so a refresh on /openpods/:room can use
      // it without re-signing. Crucially, do NOT touch activeRoom — that
      // belongs to whatever page-level deep-link effect already ran.
      isInitialMountRef.current = false;
      if (authenticated && user) {
        const persisted = storageRef.current.read(user);
        if (persisted) {
          sessionCache.set(user, persisted);
          hangoutsClient.setSessionToken(persisted);
          setSessionToken(persisted);
        }
      }
      return;
    }

    if (authenticated && user) {
      setActiveRoom(null);
      setSessionToken(null);
      hangoutsClient.clearSessionToken();
      // When persistence is enabled, try to forward a previously-issued
      // token so the user skips the hangouts re-sign on this load. No-op
      // when tokenStorage="none" — the lazy-sign flow runs as before.
      const persisted = storageRef.current.read(user);
      if (persisted) {
        sessionCache.set(user, persisted);
        hangoutsClient.setSessionToken(persisted);
        setSessionToken(persisted);
      }
    } else {
      // On full logout, drop the previous user's persisted token so they
      // can't share devices and silently re-enter someone else's session.
      if (prev.user) storageRef.current.clear(prev.user);
      setActiveRoom(null);
      setSessionToken(null);
      setSessionLoading(false);
      sessionCache.clear();
      hangoutsClient.clearSessionToken();
    }
  }, [authenticated, user]);

  return (
    <HangoutContext.Provider value={{
      activeRoom,
      openRoom,
      closeRoom:      () => setActiveRoom(null),
      sessionToken,
      sessionLoading,
      retryLogin:     loginToHangouts,
      hangoutsUser:   user,
    }}>
      {children}
    </HangoutContext.Provider>
  );
}

export function useHangout() {
  const ctx = useContext(HangoutContext);
  if (!ctx) throw new Error('useHangout must be used within HangoutContextProvider');
  return ctx;
}
