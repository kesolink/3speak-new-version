import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../lib/store';
import {
  useHiveNotifications,
  NOTIF_CATEGORIES,
} from '../hooks/useHiveNotifications';
import {
  getNotificationRoute,
  getNotificationActor,
  getNotificationTypeLabel,
  formatNotifTime,
  getNotificationPostKey,
} from '../utils/notificationHelpers';
import {
  use3SpeakDetection,
  resolveRootPost,
  ensure3SpeakStatus,
} from '../utils/threeSpeakDetection';
import threeSpeakLogo from '../assets/image/3S_mark.svg';
import './Notifications.scss';

function Notifications() {
  const { user, authenticated } = useAppStore();
  const navigate = useNavigate();
  const [filter, setFilter] = useState('all');

  const {
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
  } = useHiveNotifications(authenticated ? user : null, { limit: 50 });

  // Snapshot lastSeen when the page mounts so the visual "unread" highlight
  // persists even after markAllAsRead() advances the stored marker.
  const [seenAtMount] = useState(lastSeen);

  // Mark everything seen after a short delay on mount
  useEffect(() => {
    if (!authenticated || !user) return;
    const id = setTimeout(markAllAsRead, 400);
    return () => clearTimeout(id);
  }, [authenticated, user, markAllAsRead]);

  const postKeys = notifications.map(getNotificationPostKey).filter(Boolean);
  const is3SpeakMap = use3SpeakDetection(postKeys);

  // Also check each notification's root post so comments on 3Speak videos
  // show the 3Speak badge as well.
  const [rootIs3Speak, setRootIs3Speak] = useState({});
  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (const key of postKeys) {
        if (rootIs3Speak[key] !== undefined) continue;
        try {
          const rootKey = await resolveRootPost(key);
          const isSpeak = await ensure3SpeakStatus(rootKey);
          if (cancelled) return;
          setRootIs3Speak((prev) =>
            prev[key] === isSpeak ? prev : { ...prev, [key]: isSpeak }
          );
        } catch { /* ignore */ }
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postKeys.join('|')]);

  const filtered = useMemo(() => {
    if (filter === 'all') return notifications;
    const allowed = NOTIF_CATEGORIES[filter]?.types;
    if (!allowed) return notifications;
    return notifications.filter((n) => allowed.includes(n.type));
  }, [notifications, filter]);

  const handleClick = async (notif) => {
    const route = getNotificationRoute(notif);
    if (!route) return;
    const postKey = getNotificationPostKey(notif);
    if (postKey) {
      try {
        const rootKey = await resolveRootPost(postKey);
        const isRoot3Speak = await ensure3SpeakStatus(rootKey);
        if (isRoot3Speak) { navigate(`/watch?v=${rootKey}`); return; }
        navigate(`/post/${rootKey}`);
        return;
      } catch { /* fall through */ }
    }
    navigate(route);
  };

  if (!authenticated || !user) {
    return (
      <div className="notifications-page">
        <div className="notifications-empty">Please log in to view your notifications.</div>
      </div>
    );
  }

  return (
    <div className="notifications-page">
      <header className="notifications-header">
        <h1 className="notifications-title">
          Notifications
          {unreadCount > 0 && <span className="notifications-unread-chip">{unreadCount} new</span>}
        </h1>
        <button
          type="button"
          className="notifications-refresh"
          onClick={() => refetch()}
          disabled={loading}
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </header>

      <div className="notifications-filters" role="tablist">
        {Object.entries(NOTIF_CATEGORIES).map(([key, cat]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={filter === key}
            className={`notifications-filter-btn${filter === key ? ' active' : ''}`}
            onClick={() => setFilter(key)}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="notifications-error">
          Could not load notifications. <button onClick={() => refetch()}>Retry</button>
        </div>
      )}

      {!error && loading && filtered.length === 0 && (
        <div className="notifications-empty">Loading…</div>
      )}

      {!error && !loading && filtered.length === 0 && (
        <div className="notifications-empty">
          {filter === 'all'
            ? 'You have no notifications yet.'
            : `No ${NOTIF_CATEGORIES[filter].label.toLowerCase()} yet.`}
        </div>
      )}

      {filtered.length > 0 && (
        <>
        <ul className="notifications-list">
          {filtered.map((n) => {
            const actor = getNotificationActor(n);
            const unread = n.id > seenAtMount;
            const postKey = getNotificationPostKey(n);
            const is3Speak = postKey
              ? (is3SpeakMap.get(postKey) === true || rootIs3Speak[postKey] === true)
              : false;
            return (
              <li
                key={n.id}
                className={`notifications-row${unread ? ' unread' : ''}`}
                onClick={() => handleClick(n)}
              >
                {actor && (
                  <img
                    className="notifications-avatar"
                    src={`https://images.hive.blog/u/${actor}/avatar/small`}
                    alt={actor}
                    onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }}
                  />
                )}
                <div className="notifications-body">
                  <div className="notifications-msg">
                    {n.msg || getNotificationTypeLabel(n.type)}
                  </div>
                  <div className="notifications-meta">
                    <span className="notifications-type">{getNotificationTypeLabel(n.type)}</span>
                    <span className="notifications-dot">·</span>
                    <span className="notifications-time">{formatNotifTime(n.date)}</span>
                  </div>
                </div>
                {is3Speak && (
                  <img
                    className="notifications-3speak-icon"
                    src={threeSpeakLogo}
                    alt="3Speak"
                    title="3Speak video"
                  />
                )}
                {unread && <span className="notifications-unread-dot" aria-hidden="true" />}
              </li>
            );
          })}
        </ul>
        {hasMore && filter === 'all' && (
          <div className="notifications-load-more-wrap">
            <button
              type="button"
              className="notifications-load-more"
              onClick={loadMore}
              disabled={loadingMore}
            >
              {loadingMore ? 'Loading…' : 'Load more'}
            </button>
          </div>
        )}
        {!hasMore && notifications.length > 0 && (
          <div className="notifications-end">You've reached the end.</div>
        )}
        </>
      )}
    </div>
  );
}

export default Notifications;
