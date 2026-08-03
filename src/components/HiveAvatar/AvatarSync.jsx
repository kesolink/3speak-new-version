import { useEffect } from 'react';
import { useAppStore } from '../../lib/store';
import { fetchProfile } from '../../utils/profileMeta';
import { setResolvedAvatar, reconcileAvatarOverride } from '../../utils/avatarCache';

/**
 * Reads the logged-in user's profile_image out of their Hive metadata once per
 * session and hands it to the avatar cache, so their own face comes from the
 * immutable image URL instead of the hive proxy — which caches for 24h in the
 * browser and would otherwise show them a stale picture for a day after they
 * change it.
 *
 * Renders nothing. Mounted once at the app root.
 */
export default function AvatarSync() {
  const user = useAppStore((s) => s.user);
  const authenticated = useAppStore((s) => s.authenticated);

  useEffect(() => {
    if (!authenticated || !user) return;
    let alive = true;
    (async () => {
      const profile = await fetchProfile(user);
      if (!alive || profile == null) return;
      reconcileAvatarOverride(user, profile.profile_image);
      setResolvedAvatar(user, profile.profile_image || '');
    })();
    return () => { alive = false; };
  }, [authenticated, user]);

  return null;
}
