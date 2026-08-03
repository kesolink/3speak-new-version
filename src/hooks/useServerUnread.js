import { useCallback, useEffect, useRef, useState } from 'react';
import { getChatClient } from '../lib/snapieChat';

const POLL_MS = 20000;

/**
 * Unread counts read STRAIGHT FROM THE SERVER, never cached client-side.
 *
 * The SDK's useUnreadCount keeps its own running copy, which can drift up and
 * never come back down: a user sat on a badge of 3 while /unread reported 0 for
 * them, because nothing resynced the local number to the authoritative one. So
 * ask the server instead — on mount, whenever the tab regains focus, and on a
 * short interval — and treat its answer as the only truth.
 *
 * Returns { unreadCount, byConversation, refresh }. `refresh` is exposed so a
 * caller can resync immediately after marking something read.
 */
export function useServerUnread(enabled = true) {
  const [state, setState] = useState({ unreadCount: 0, byConversation: null });
  const alive = useRef(true);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    try {
      const client = getChatClient();
      if (!client?.isAuthenticated?.()) return;
      const res = await client.getUnread();
      if (!alive.current || !res) return;
      setState({
        unreadCount: Number(res.unread ?? res.total ?? 0) || 0,
        byConversation: res.conversations || res.byConversation || null,
      });
    } catch {
      // Transient (offline, 5xx): keep the last answer rather than inventing one.
    }
  }, [enabled]);

  useEffect(() => {
    alive.current = true;
    refresh();
    const id = setInterval(refresh, POLL_MS);
    const onWake = () => refresh();
    window.addEventListener('focus', onWake);
    document.addEventListener('visibilitychange', onWake);
    return () => {
      alive.current = false;
      clearInterval(id);
      window.removeEventListener('focus', onWake);
      document.removeEventListener('visibilitychange', onWake);
    };
  }, [refresh]);

  return { ...state, refresh };
}

export default useServerUnread;
