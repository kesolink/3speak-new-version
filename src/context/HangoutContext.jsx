import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { HangoutsApiClient, loginWithSignFn } from '@snapie/hangouts-core';
import { useAppStore } from '../lib/store';
import aioha, { KeyTypes } from '../hive-api/aioha';

const HangoutContext = createContext(undefined);

// Module-level shared state so concurrent callers share one request and one cache
const sessionCache = new Map();
let pendingLogin = null;

const hangoutsClient = new HangoutsApiClient({
  baseUrl: import.meta.env.VITE_HANGOUTS_API_URL,
});

export function HangoutContextProvider({ children }) {
  const [activeRoom, setActiveRoom]       = useState(null);
  const [sessionToken, setSessionToken]   = useState(null);
  const [sessionLoading, setSessionLoading] = useState(false);

  const { authenticated, user } = useAppStore();

  const loginToHangouts = useCallback(async (requestedUser = user) => {
    if (!authenticated || !requestedUser) return null;

    const isStillCurrentUser = () => {
      const state = useAppStore.getState();
      return state.authenticated && state.user === requestedUser;
    };

    // Return cached token immediately
    const cached = sessionCache.get(requestedUser);
    if (cached) {
      if (isStillCurrentUser()) {
        hangoutsClient.setSessionToken(cached);
        setSessionToken(cached);
      }
      return cached;
    }

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

    const signFn = async (message) => {
      const res = await aioha.signMessage(message, KeyTypes.Posting);
      if (!res.success) throw new Error(res.error || 'Failed to sign hangouts challenge');
      return res.result;
    };

    const loginPromise = loginWithSignFn(hangoutsClient, requestedUser, signFn)
      .then(session => {
        sessionCache.set(session.username || requestedUser, session.token);
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
    if (!roomName || !authenticated || !user) return false;

    if (!sessionToken && !sessionLoading) {
      loginToHangouts(user);
    }

    setActiveRoom(roomName);
    return true;
  }, [authenticated, user, sessionToken, sessionLoading, loginToHangouts]);

  useEffect(() => {
    if (authenticated && user) {
      setActiveRoom(null);
      setSessionToken(null);
      hangoutsClient.clearSessionToken();
      loginToHangouts(user);
    } else {
      setActiveRoom(null);
      setSessionToken(null);
      setSessionLoading(false);
      sessionCache.clear();
      hangoutsClient.clearSessionToken();
    }
  }, [authenticated, user, loginToHangouts]);

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
