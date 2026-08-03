import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Camera } from 'lucide-react';
import HiveAvatar from '../HiveAvatar/HiveAvatar';
import { getHiveClient } from '../../utils/hiveNode';
import { fetchProfile } from '../../utils/profileMeta';
import { setResolvedAvatar } from '../../utils/avatarCache';
import './ProfileHeader.scss';

/**
 * Shared banner header for the user-profile and community pages.
 *
 * Renders a cover banner with a faded bottom, an overlapping avatar, the name
 * in the default 3Speak font (just larger), an optional bio directly under the
 * name, plus optional `badges` (under the name) and `actions` (buttons on the
 * right). Used by UserProfilePage, ProfilePage (own) and CommunityPage so the
 * header only ever has to change in one place.
 *
 * `username` is the Hive account (user or community id) — it drives both the
 * cover image and the avatar.
 *
 * Pass an explicit `bio` (e.g. a community's about text), or set `fetchBio`
 * to have the header pull the account's Hive profile "about" itself — used for
 * user profiles so the bio shows under the username without each page wiring
 * up its own fetch.
 */
export default function ProfileHeader({
  username,
  name,
  bio,
  fetchBio = false,
  badges,
  actions,
  // Sits inline with the display name — the page's focal point — so the two
  // actions a visitor came for (Follow, Message) are read together with WHO
  // they'd be following, not parked in the corner with share/report.
  nameActions,
  // Slot between the bio/location and the badge row — user profiles put their
  // stat line here (see ProfileStats); community pages pass nothing.
  meta,
  avatarBadgeSize = 16,
  refreshKey = 0,
  showHandle = false,
  onAvatarClick,
}) {
  const [hiveBio, setHiveBio] = useState('');
  const [hiveName, setHiveName] = useState('');
  const [hiveLocation, setHiveLocation] = useState('');

  const wantsBio = fetchBio && !bio;
  useEffect(() => {
    if (!wantsBio || !username) return;
    let cancelled = false;
    (async () => {
      try {
        // bridge, not the raw account: it also answers for communities, whose
        // "about" doesn't live in account metadata.
        const profile = await getHiveClient().call('bridge', 'get_profile', { account: username });
        if (!cancelled) setHiveBio(profile?.metadata?.profile?.about || '');
      } catch {
        /* non-blocking — just no bio */
      }
    })();
    return () => { cancelled = true; };
    // refreshKey lets a caller re-read the profile after it was edited.
  }, [wantsBio, username, refreshKey]);

  // The display name comes from the account metadata rather than bridge, which
  // truncates it to 20 characters ("badadib tibbis te...").
  useEffect(() => {
    if (!showHandle || !username) return;
    let cancelled = false;
    (async () => {
      const profile = await fetchProfile(username);
      if (cancelled || !profile) return;
      setHiveName(profile.name || '');
      setHiveLocation(profile.location || '');
      // We already have their metadata, so hand the real picture to the avatar
      // cache rather than leaving the header on the day-cached hive proxy.
      setResolvedAvatar(username, profile.profile_image || '');
    })();
    return () => { cancelled = true; };
  }, [showHandle, username, refreshKey]);

  const bioText = bio || hiveBio;
  // With showHandle, a display name becomes the heading and the account name
  // moves underneath as @handle. No display name set: heading stays the account
  // name, and we don't repeat it as a handle right below itself.
  const displayName = showHandle && hiveName.trim() ? hiveName.trim() : '';
  const locationText = hiveLocation.trim();
  const heading = displayName || name || username;
  const avatarClickable = typeof onAvatarClick === 'function';

  // Keep the avatar exactly as tall as the identity lines beside it (display
  // name, @handle, bio, location). Measured rather than done in CSS: a flex
  // item resolves its width from content before the cross-axis stretch, so
  // "square as tall as my sibling" isn't expressible with aspect-ratio.
  const metaRef = useRef(null);
  const [avatarSize, setAvatarSize] = useState(0);
  useLayoutEffect(() => {
    const el = metaRef.current;
    if (!el) return;
    const measure = () => setAvatarSize(el.offsetHeight);
    measure();
    if (typeof ResizeObserver === 'undefined') return;   // fine, CSS min-* holds
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [heading, bioText, locationText, badges]);

  return (
    <div className="profile-card">
      <div className="profile-header">
        <img
          className="gradient-bg"
          src={`https://images.hive.blog/u/${username}/cover`}
          alt=""
        />
      </div>
      <div className="profile-body">
        <div className="top-section">
          <div className="left-info">
            {/* Avatar + identity lines: the avatar is sized off this row, so it
                matches the text lines and stops above the badges. */}
            <div className="identity-row">
            <div
              className={`avatar${avatarClickable ? ' avatar--clickable' : ''}`}
              style={avatarSize ? { width: avatarSize, height: avatarSize } : undefined}
              {...(avatarClickable ? {
                role: 'button',
                tabIndex: 0,
                title: 'Edit your profile',
                onClick: onAvatarClick,
                onKeyDown: (e) => {
                  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAvatarClick(); }
                },
              } : {})}
            >
              <HiveAvatar
                username={username}
                size={null}
                alt={`${heading} avatar`}
                badgeSize={avatarBadgeSize}
              />
              {avatarClickable ? (
                <span className="avatar-edit-overlay" aria-hidden="true">
                  <Camera size={22} />
                </span>
              ) : null}
            </div>
            <div className="user-meta" ref={metaRef}>
              <div className="name-row">
                <h2>{heading}</h2>
                {nameActions ? <div className="name-actions">{nameActions}</div> : null}
              </div>
              {displayName ? <span className="profile-handle">@{username}</span> : null}
              {bioText ? <p className="profile-bio">{bioText}</p> : null}
              {locationText ? (
                <p className="profile-location">
                  <span className="profile-location-label">Location:</span> {locationText}
                </p>
              ) : null}
              {meta}
            </div>
            </div>
            {badges ? <div className="user-badges">{badges}</div> : null}
          </div>
          {actions ? <div className="button-group">{actions}</div> : null}
        </div>
      </div>
    </div>
  );
}
