import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { CHECKER_URL } from '../../utils/config';
import { getAccounts } from '../../hive-api/hiveApi';
import './ProfileStats.scss';

/**
 * The one-line stat summary under a profile's bio: how much this creator has
 * published, how much it's been watched, and how long they've been at it.
 *
 * Backed by the checker's `/user/:username/counts`, whose queries MIRROR the
 * tabs below (legacy + embed for videos, the embed_url-keyed query for shorts).
 * A stat that disagrees with the tab under it is worse than no stat.
 *
 * The "since" year comes from the CHAIN (the Hive account's creation date), not
 * from our oldest stored upload: for @meno the oldest row we hold is 2025 while
 * the account dates to 2017, so an upload-derived date would describe when our
 * index picked him up. Hence the honest label, "on Hive since".
 */

const fmt = (n) => {
  const v = Number(n) || 0;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(v);
};

export default function ProfileStats({ username, followers }) {
  const { data } = useQuery({
    queryKey: ['profile-counts', username],
    enabled: !!username,
    staleTime: 5 * 60 * 1000,
    retry: 1,
    queryFn: async () => (await axios.get(`${CHECKER_URL}/user/${encodeURIComponent(username)}/counts`)).data,
  });

  // Account age, straight from the chain. Its own query so a slow/failed Hive
  // node costs the year, not the whole stat line.
  const { data: since } = useQuery({
    queryKey: ['profile-since', username],
    enabled: !!username,
    staleTime: 24 * 60 * 60 * 1000,   // an account's birthday never changes
    retry: 1,
    queryFn: async () => {
      const [account] = await getAccounts([String(username).toLowerCase()]);
      const created = account?.created;
      const year = created ? new Date(`${created}Z`).getFullYear() : null;
      return Number.isFinite(year) ? year : null;
    },
  });

  if (!data) return null;

  // Only render the parts that are actually true for this creator — a row of
  // zeroes says less than a shorter row.
  const items = [
    followers != null && { key: 'followers', value: fmt(followers), label: followers === 1 ? 'follower' : 'followers' },
    data.videos > 0 && { key: 'videos', value: fmt(data.videos), label: data.videos === 1 ? 'video' : 'videos' },
    data.shorts > 0 && { key: 'shorts', value: fmt(data.shorts), label: data.shorts === 1 ? 'short' : 'shorts' },
    data.views > 0 && { key: 'views', value: fmt(data.views), label: data.views === 1 ? 'view' : 'views' },
  ].filter(Boolean);

  if (!items.length) return null;

  return (
    <div className="profile-stats">
      {items.map((i) => (
        <span className="profile-stat" key={i.key}>
          <strong>{i.value}</strong> {i.label}
        </span>
      ))}
      {since ? <span className="profile-stat profile-stat--since">on Hive since {since}</span> : null}
    </div>
  );
}
