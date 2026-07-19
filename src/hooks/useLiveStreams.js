import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../lib/store';
import { getFollowing } from '../utils/hiveUtils';

import { fetchAllEndpoints } from '../utils/hangoutsEndpoints';

/**
 * Currently-live OpenPods standalone streams, mapped to Card3-compatible
 * objects so they can be prepended into the normal video grids as regular
 * tiles (with a LIVE badge). Card3 special-cases `_liveStream` items to link
 * to /watch/<roomName> and skip hover-preview/duration.
 *
 * `following: true` filters to streamers the signed-in user follows (Follow
 * feed). Includes unlisted streams for now (the /streams endpoint does).
 */
export function useLiveStreams({ following = false } = {}) {
  const [streams, setStreams] = useState([]);
  const [followSet, setFollowSet] = useState(null); // null = not loaded
  const user = useAppStore((s) => s.user);

  useEffect(() => {
    let alive = true;
    if (!following) { setFollowSet(null); return undefined; }
    if (!user) { setFollowSet(new Set()); return undefined; }
    getFollowing(user, '', 1000)
      .then((list) => { if (alive) setFollowSet(new Set(list || [])); })
      .catch(() => { if (alive) setFollowSet(new Set()); });
    return () => { alive = false; };
  }, [following, user]);

  useEffect(() => {
    let alive = true;
    const load = () => {
      // Aggregated across every configured OpenPods deployment, so the feeds
      // show live sessions wherever they're hosted.
      fetchAllEndpoints('/streams')
        .then((list) => { if (alive) setStreams((Array.isArray(list) ? list : []).filter((s) => s.live)); })
        .catch(() => { if (alive) setStreams([]); });
    };
    load();
    const t = setInterval(load, 30000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  return useMemo(() => {
    let list = streams;
    if (following) list = followSet ? streams.filter((s) => followSet.has(s.host)) : [];
    return list.map((s) => ({
      _liveStream: true,
      roomName: s.name,
      permlink: s.name, // used only for React keys / dedupe here
      author: s.host,
      owner: s.host,
      title: s.title,
      thumbnail: s.thumbnail,
      created_at: s.createdAt,
    }));
  }, [streams, following, followSet]);
}
