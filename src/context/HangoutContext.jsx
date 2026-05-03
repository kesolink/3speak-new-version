import { createContext, useContext, useState, useEffect } from 'react';
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

  const loginToHangouts = async () => {
    if (!authenticated || !user) return;

    // Return cached token immediately
    const cached = sessionCache.get(user);
    if (cached) {
      hangoutsClient.setSessionToken(cached);
      setSessionToken(cached);
      return;
    }

    // Deduplicate: if a login is already in-flight, await it
    if (pendingLogin) {
      try {
        const token = await pendingLogin;
        setSessionToken(token);
      } catch { /* error already logged by the initiating call */ }
      return;
    }

    setSessionLoading(true);

    const signFn = async (message) => {
      const res = await aioha.signMessage(message, KeyTypes.Posting);
      if (!res.success) throw new Error(res.error || 'Failed to sign hangouts challenge');
      return res.result;
    };

    pendingLogin = loginWithSignFn(hangoutsClient, user, signFn)
      .then(session => {
        sessionCache.set(user, session.token);
        hangoutsClient.setSessionToken(session.token);
        return session.token;
      })
      .catch(err => {
        console.error('[OpenPods] Session auth failed:', err);
        throw err;
      })
      .finally(() => { pendingLogin = null; });

    try {
      const token = await pendingLogin;
      setSessionToken(token);
    } catch {
      setSessionToken(null);
    } finally {
      setSessionLoading(false);
    }
  };

  useEffect(() => {
    if (authenticated && user) {
      loginToHangouts();
    } else {
      setSessionToken(null);
      sessionCache.clear();
      hangoutsClient.clearSessionToken();
    }
  }, [authenticated, user]);

  return (
    <HangoutContext.Provider value={{
      activeRoom,
      openRoom:       setActiveRoom,
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
