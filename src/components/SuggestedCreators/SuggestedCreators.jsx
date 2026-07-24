import { useEffect, useMemo, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import { SUGGESTED_CREATORS_URL } from '../../utils/config';
import { feedParams } from '../../utils/feedParams';
import { getFeedSeed } from '../../utils/feedSeed';
import { getFollowing } from '../../utils/hiveUtils';
import { getFollowers } from '../../hive-api/api';
import { followWithAioha, isLoggedIn } from '../../hive-api/aioha';
import { useAppStore } from '../../lib/store';
import { getTagLabel, getTagEmoji } from '../../utils/tagsV2';
import HiveAvatar from '../HiveAvatar/HiveAvatar';
import './SuggestedCreators.scss';

// One deterministic top slice is fetched; the client presents it per tab (discover =
// seeded-random, interests = top) and per viewport (mobile scrolls, desktop fits).
const FETCH_LIMIT = 20;    // the pool we pick from — also the discover "top 20"
const MOBILE_MAX = 15;     // how many the mobile scroller shows

const fmtFollowers = (n) => {
  if (n == null) return null;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(n);
};

// Small seeded shuffle so the discover tab's slice is random but STABLE within a
// session (keyed to the shared feed seed) — it doesn't re-shuffle on every render.
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function seededShuffle(arr, seed) {
  const a = [...arr];
  const rng = mulberry32((seed >>> 0) || 1);
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * "Follow these" — a rail of creator tiles interleaved into the discover / interests
 * grids (checker `/feeds/suggested-creators`: interest-matched creators ranked by
 * recent views + comments + reshares, minus the caller and who they follow).
 *
 * Layout is viewport-dependent, by request:
 *   - MOBILE  → a horizontal scroller (fixed-width tiles, swipe sideways).
 *   - DESKTOP → a fit-to-width grid of exactly `perRow` tiles (measured by the
 *               parent from the live grid width), so it fills the row edge-to-edge
 *               with NO horizontal scroll — as many as fit, no more.
 *
 * Tab difference: discover shows a seeded-random slice of the top 20; interests the
 * deterministic top. Both draw from ONE shared fetch.
 */
export default function SuggestedCreators({ variant = 'discover', perRow = 0 }) {
  const user = useAppStore((s) => s.user);
  const interests = useAppStore((s) => s.interests);
  const hasInterests = Array.isArray(interests) && interests.length > 0;

  const [isPhone, setIsPhone] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 600px)').matches,
  );
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 600px)');
    const on = () => setIsPhone(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  const [followSet, setFollowSet] = useState(null);      // null = not resolved yet
  const [justFollowed, setJustFollowed] = useState({});  // name -> true
  const [pending, setPending] = useState({});
  const [followerCounts, setFollowerCounts] = useState({});

  // ONE deterministic top-N fetch, shared by both tabs (the URL is identical), then
  // sliced/shuffled client-side. feedParams() carries interests + currentuser, so the
  // server already excludes the caller and who they follow.
  const params = feedParams();
  const { data: suggested } = useQuery({
    queryKey: ['suggested-creators', params],
    enabled: hasInterests,
    queryFn: async () => {
      const res = await axios.get(`${SUGGESTED_CREATORS_URL}?limit=${FETCH_LIMIT}${params}`);
      return res.data?.creators || [];
    },
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 1,
  });

  // Belt-and-suspenders follow filter (the server excludes follows too, but its set
  // can be a cold miss on the first request). Logged out → empty set; the row still
  // shows and the follow button prompts a login.
  useEffect(() => {
    let alive = true;
    if (!user) { setFollowSet(new Set()); return undefined; }
    getFollowing(user, '', 1000)
      .then((list) => { if (alive) setFollowSet(new Set(list || [])); })
      .catch(() => { if (alive) setFollowSet(new Set()); });
    return () => { alive = false; };
  }, [user]);

  // The non-followed candidates, in the server's score order.
  const pool = useMemo(() => {
    if (!Array.isArray(suggested) || followSet == null) return [];
    return suggested
      .map((c) => ({
        name: (c.author || '').toLowerCase(),
        displayName: c.display_name || c.author,
        avatar: c.avatar,
        // Why we surfaced them: the topic most of their recent videos are tagged in
        // (checker's basisTopic), falling back to the first matched interest topic.
        basis: c.basisTopic || (Array.isArray(c.matchedTopics) ? c.matchedTopics[0] : null),
      }))
      .filter((c) => c.name && c.name !== (user || '').toLowerCase())
      .filter((c) => !followSet.has(c.name) || justFollowed[c.name]);
  }, [suggested, followSet, user, justFollowed]);

  // What actually renders: discover reshuffles (seeded, stable per session); the count
  // is `perRow` on desktop (fit exactly, no scroll) or MOBILE_MAX on the phone scroller.
  const creators = useMemo(() => {
    if (!pool.length) return [];
    const ordered = variant === 'discover' ? seededShuffle(pool, getFeedSeed()) : pool;
    const count = isPhone ? MOBILE_MAX : (perRow || 0);
    return count > 0 ? ordered.slice(0, count) : [];
  }, [pool, variant, isPhone, perRow]);

  // Follower counts, once per creator that makes the cut.
  useEffect(() => {
    let alive = true;
    const missing = creators.map((c) => c.name).filter((n) => followerCounts[n] === undefined);
    if (!missing.length) return undefined;
    Promise.all(missing.map(async (n) => {
      try {
        const r = await getFollowers(n);
        return [n, r?.follower_count ?? null];
      } catch { return [n, null]; }
    })).then((pairs) => {
      if (!alive) return;
      setFollowerCounts((prev) => ({ ...prev, ...Object.fromEntries(pairs) }));
    });
    return () => { alive = false; };
  }, [creators, followerCounts]);

  const handleFollow = useCallback(async (name) => {
    if (!isLoggedIn() || !user) {
      toast.error('Please login to follow creators');
      return;
    }
    setPending((p) => ({ ...p, [name]: true }));
    try {
      await followWithAioha(name, true);
      setJustFollowed((f) => ({ ...f, [name]: true }));
      setFollowSet((s) => new Set([...(s || []), name]));
      toast.success(`Following @${name}`);
    } catch (err) {
      toast.error(`Could not follow @${name}: ${err?.message || 'please try again'}`);
    } finally {
      setPending((p) => ({ ...p, [name]: false }));
    }
  }, [user]);

  if (!hasInterests || !creators.length) return null;

  // Desktop: a grid of exactly this many columns (tiles stretch to fill via 1fr, so
  // the row is edge-to-edge). Mobile: the base `.sc-row` is a flex scroller.
  const gridMode = !isPhone;
  const cols = Math.min(perRow || creators.length, creators.length);

  return (
    <section className="suggested-creators">
      <div
        className={`sc-row${gridMode ? ' sc-row--grid' : ''}`}
        style={gridMode ? { gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` } : undefined}
      >
        {creators.map((c) => {
          const followed = !!justFollowed[c.name];
          const followers = fmtFollowers(followerCounts[c.name]);
          return (
            <div className="sc-card" key={c.name}>
              <Link to={`/p/${c.name}`} className="sc-avatar" title={`@${c.name}`}>
                <HiveAvatar username={c.name} size={null} alt="" badgeSize={12} />
              </Link>
              <Link to={`/p/${c.name}`} className="sc-name" title={`@${c.name}`}>@{c.name}</Link>
              {c.basis && (
                <span className="sc-basis" title={`Mostly posts ${getTagLabel(c.basis)}`}>
                  <span className="sc-basis-emoji">{getTagEmoji(c.basis)}</span>
                  {getTagLabel(c.basis)}
                </span>
              )}
              <span className="sc-followers">
                {followers != null ? `${followers} follower${followers === '1' ? '' : 's'}` : ' '}
              </span>
              <button
                type="button"
                className={`sc-follow${followed ? ' followed' : ''}`}
                onClick={() => !followed && handleFollow(c.name)}
                disabled={followed || !!pending[c.name]}
              >
                {followed ? 'Following' : (pending[c.name] ? '…' : 'Follow')}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
