import { useEffect, useState } from 'react';
import HiveAvatar from '../HiveAvatar/HiveAvatar';
import { getHiveClient } from '../../utils/hiveNode';
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
  avatarBadgeSize = 16,
}) {
  const [hiveBio, setHiveBio] = useState('');

  useEffect(() => {
    if (!fetchBio || bio || !username) return;
    let cancelled = false;
    (async () => {
      try {
        const profile = await getHiveClient().call('bridge', 'get_profile', { account: username });
        if (!cancelled) setHiveBio(profile?.metadata?.profile?.about || '');
      } catch {
        /* non-blocking — just no bio */
      }
    })();
    return () => { cancelled = true; };
  }, [fetchBio, bio, username]);

  const bioText = bio || hiveBio;

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
            <div className="avatar">
              <HiveAvatar
                username={username}
                size={null}
                alt={`${name || username} avatar`}
                badgeSize={avatarBadgeSize}
              />
            </div>
            <div className="user-meta">
              <h2>{name || username}</h2>
              {bioText ? <p className="profile-bio">{bioText}</p> : null}
              {badges ? <div className="user-badges">{badges}</div> : null}
            </div>
          </div>
          {actions ? <div className="button-group">{actions}</div> : null}
        </div>
      </div>
    </div>
  );
}
