import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { HIVE_API_URL } from '../utils/config';

/**
 * Hive notification shape from `bridge.account_notifications`:
 *   { id, type, score, date, msg, url }
 *
 * Known `type` values we surface: reply, reply_comment, mention, vote,
 * follow, reblog, transfer, delegate_vests, receive_vesting, powerdown,
 * subscribe, pin_post, unpin_post, set_role, set_label, set_props,
 * set_role_label, inactive_witness.
 */

// Canonical categories for the UI filters
export const NOTIF_CATEGORIES = {
  all: { label: 'All', types: null },
  replies: { label: 'Replies', types: ['reply', 'reply_comment'] },
  mentions: { label: 'Mentions', types: ['mention'] },
  votes: { label: 'Votes', types: ['vote'] },
  reblogs: { label: 'Reblogs', types: ['reblog'] },
  follows: { label: 'Follows', types: ['follow'] },
  transfers: { label: 'Transfers', types: ['transfer'] },
};

const LAST_SEEN_PREFIX = '3speak-notif-last-seen-';
const POLL_INTERVAL_MS = 60_000;

function getLastSeenKey(user) {
  return user ? `${LAST_SEEN_PREFIX}${user}` : null;
}

/** Read the last-seen notification id for a user from localStorage. */
export function getLastSeenId(user) {
  const key = getLastSeenKey(user);
  if (!key) return 0;
  try {
    const v = parseInt(localStorage.getItem(key) || '0', 10);
    return Number.isFinite(v) ? v : 0;
  } catch { return 0; }
}

/** Store the last-seen notification id for a user. */
export function setLastSeenId(user, id) {
  const key = getLastSeenKey(user);
  if (!key) return;
  try { localStorage.setItem(key, String(id)); } catch {}
}

async function fetchNotifications(account, limit = 50, lastId = null) {
  // Hive bridge API: `last_id` returns notifications with id < last_id
  const params = { account, limit };
  if (lastId != null) params.last_id = lastId;
  const res = await axios.post(HIVE_API_URL, {
    jsonrpc: '2.0',
    method: 'bridge.account_notifications',
    params,
    id: 1,
  });
  if (res.data?.error) throw new Error(res.data.error.message || 'RPC error');
  return Array.isArray(res.data?.result) ? res.data.result : [];
}

/**
 * React hook that returns the user's Hive notifications along with an unread
 * count based on a localStorage last-seen marker.
 *
 * @param {string|null|undefined} user - logged-in Hive account
 * @param {object} [opts]
 * @param {number} [opts.limit=50]
 * @param {boolean} [opts.poll=true] - re-fetch every POLL_INTERVAL_MS
 */
export function useHiveNotifications(user, { limit = 50, poll = true } = {}) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState(null);

  // Rerender when last-seen changes so unreadCount updates
  const [lastSeen, setLastSeenState] = useState(() => getLastSeenId(user));
  const userRef = useRef(user);
  userRef.current = user;

  const refetch = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      setHasMore(true);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchNotifications(user, limit);
      if (userRef.current === user) {
        setNotifications(data);
        setHasMore(data.length >= limit);
      }
    } catch (err) {
      console.error('[notifications] fetch failed:', err);
      if (userRef.current === user) setError(err);
    } finally {
      if (userRef.current === user) setLoading(false);
    }
  }, [user, limit]);

  const loadMore = useCallback(async () => {
    if (!user || loadingMore || !hasMore) return;
    if (notifications.length === 0) return;
    const oldestId = notifications[notifications.length - 1]?.id;
    if (!oldestId) return;
    setLoadingMore(true);
    setError(null);
    try {
      const data = await fetchNotifications(user, limit, oldestId);
      if (userRef.current === user) {
        setNotifications((prev) => {
          // Dedupe by id (cheap guard against overlap)
          const seen = new Set(prev.map((n) => n.id));
          const additions = data.filter((n) => !seen.has(n.id));
          return [...prev, ...additions];
        });
        setHasMore(data.length >= limit);
      }
    } catch (err) {
      console.error('[notifications] load more failed:', err);
      if (userRef.current === user) setError(err);
    } finally {
      if (userRef.current === user) setLoadingMore(false);
    }
  }, [user, limit, notifications, loadingMore, hasMore]);

  // Initial + user-change fetch
  useEffect(() => {
    setNotifications([]);
    setHasMore(true);
    setLastSeenState(getLastSeenId(user));
    if (!user) return;
    refetch();
  }, [user, refetch]);

  // Polling
  useEffect(() => {
    if (!user || !poll) return;
    const id = setInterval(refetch, POLL_INTERVAL_MS);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refetch();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [user, poll, refetch]);

  // Mark all as read (advance last-seen to highest id)
  const markAllAsRead = useCallback(() => {
    if (!user) return;
    const maxId = notifications.reduce((m, n) => (n.id > m ? n.id : m), 0);
    if (maxId > lastSeen) {
      setLastSeenId(user, maxId);
      setLastSeenState(maxId);
    }
  }, [user, notifications, lastSeen]);

  const unreadCount = notifications.reduce(
    (acc, n) => (n.id > lastSeen ? acc + 1 : acc),
    0
  );

  return {
    notifications,
    loading,
    loadingMore,
    hasMore,
    error,
    refetch,
    loadMore,
    unreadCount,
    lastSeen,
    markAllAsRead,
  };
}
