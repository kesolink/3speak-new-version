import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { IoIosNotifications } from 'react-icons/io';
import { useAppStore } from '../../lib/store';
import { useHiveNotifications } from '../../hooks/useHiveNotifications';
import {
  getNotificationRoute,
  getNotificationActor,
  getNotificationTypeLabel,
  formatNotifTime,
  getNotificationPostKey,
} from '../../utils/notificationHelpers';
import {
  use3SpeakDetection,
  resolveRootPost,
  ensure3SpeakStatus,
} from '../../utils/threeSpeakDetection';
import threeSpeakLogo from '../../assets/image/3S_mark.svg';
import './NotificationBell.scss';

const PREVIEW_LIMIT = 24;

function NotificationBell() {
  const { user, authenticated } = useAppStore();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  const {
    notifications,
    loading,
    unreadCount,
    lastSeen,
    markAllAsRead,
  } = useHiveNotifications(authenticated ? user : null, { limit: 60 });

  // 3Speak detection for all post/comment notifications. For each notification
  // URL we check the post itself AND (if it's a comment) walk up to the root
  // so we can show the badge on "replied to your video" notifications too.
  const postKeys = notifications
    .map(getNotificationPostKey)
    .filter(Boolean);
  const is3SpeakMap = use3SpeakDetection(postKeys);

  // Track root post status per notification key
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

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  // When dropdown opens, advance last-seen so the red dot goes away.
  // Keep notifications themselves highlighted for this session via `lastSeen`
  // snapshot below.
  const [seenAtOpen, setSeenAtOpen] = useState(0);
  const handleToggle = () => {
    const next = !open;
    if (next) {
      setSeenAtOpen(lastSeen);
      // Defer so we can show the unread highlight first, then clear the badge
      setTimeout(markAllAsRead, 200);
    }
    setOpen(next);
  };

  const handleRowClick = async (notif) => {
    const route = getNotificationRoute(notif);
    setOpen(false);
    if (!route) return;

    // For post/comment notifications: if the root post is a 3Speak video,
    // route straight to /watch; otherwise use the generic /post page.
    const postKey = getNotificationPostKey(notif);
    if (postKey) {
      try {
        const rootKey = await resolveRootPost(postKey);
        const isRoot3Speak = await ensure3SpeakStatus(rootKey);
        if (isRoot3Speak) {
          navigate(`/watch?v=${rootKey}`);
          return;
        }
        navigate(`/post/${rootKey}`);
        return;
      } catch {
        /* fall through to default route */
      }
    }
    navigate(route);
  };

  if (!authenticated || !user) return null;

  const preview = notifications.slice(0, PREVIEW_LIMIT);

  return (
    <div className="notif-bell-wrapper" ref={ref}>
      <button
        type="button"
        className="notif-bell-btn"
        onClick={handleToggle}
        aria-label={`Notifications${unreadCount ? ` (${unreadCount} unread)` : ''}`}
        title="Notifications"
      >
        <IoIosNotifications size={22} />
        {unreadCount > 0 && (
          <span className="notif-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
        )}
      </button>

      {open && (
        <div className="notif-dropdown" role="menu">
          <div className="notif-dropdown-header">
            <span className="notif-dropdown-title">Notifications</span>
            <Link
              to="/notifications"
              className="notif-dropdown-seeall"
              onClick={() => setOpen(false)}
            >
              See all
            </Link>
          </div>

          {loading && notifications.length === 0 && (
            <div className="notif-dropdown-empty">Loading…</div>
          )}

          {!loading && notifications.length === 0 && (
            <div className="notif-dropdown-empty">You have no notifications yet.</div>
          )}

          {preview.length > 0 && (
            <ul className="notif-list">
              {preview.map((n) => {
                const actor = getNotificationActor(n);
                const unread = n.id > seenAtOpen;
                const postKey = getNotificationPostKey(n);
                const is3Speak = postKey
                  ? (is3SpeakMap.get(postKey) === true || rootIs3Speak[postKey] === true)
                  : false;
                return (
                  <li
                    key={n.id}
                    className={`notif-row${unread ? ' notif-row-unread' : ''}`}
                    onClick={() => handleRowClick(n)}
                  >
                    {actor && (
                      <img
                        className="notif-avatar"
                        src={`https://images.hive.blog/u/${actor}/avatar/small`}
                        alt={actor}
                        onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }}
                      />
                    )}
                    <div className="notif-body">
                      <div className="notif-msg">
                        {n.msg || getNotificationTypeLabel(n.type)}
                      </div>
                      <div className="notif-meta">
                        <span className="notif-type">{getNotificationTypeLabel(n.type)}</span>
                        <span className="notif-dot">·</span>
                        <span className="notif-time">{formatNotifTime(n.date)}</span>
                      </div>
                    </div>
                    {is3Speak && (
                      <img
                        className="notif-3speak-icon"
                        src={threeSpeakLogo}
                        alt="3Speak"
                        title="3Speak video"
                      />
                    )}
                    {unread && <span className="notif-unread-dot" aria-hidden="true" />}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export default NotificationBell;
