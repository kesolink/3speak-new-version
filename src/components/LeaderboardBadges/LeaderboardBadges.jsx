import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { MdOndemandVideo, MdVisibility, MdTimer, MdLocalOffer } from 'react-icons/md';
import ShortsIcon from '../icons/ShortsIcon';
import {
  fetchLeaderboardBadges,
  visibleBadges,
  badgeLabel,
  badgeTitle,
} from '../../lib/leaderboardData';
import './LeaderboardBadges.scss';

// One icon per topic, so the shortened label doesn't have to carry the meaning.
const BADGE_ICONS = {
  video_uploads: MdOndemandVideo,
  short_uploads: ShortsIcon,
  video_watch_secs: MdVisibility,
  short_watch_secs: MdTimer,
  tags_given: MdLocalOffer,
};

/**
 * Leaderboard standings shown on a profile ("#1 Videos"). The checker returns
 * the user's best tier per metric across every window; we show the few
 * strongest. Clicking one opens the exact board it was earned on, scrolled to
 * and highlighting the row of the profile you came from (`?user=`).
 *
 * Renders nothing when the user holds no badges — most accounts won't, and an
 * empty row would just add noise to the profile header.
 */
function LeaderboardBadges({ username }) {
  const { data } = useQuery({
    queryKey: ['leaderboard-badges', username],
    queryFn: () => fetchLeaderboardBadges(username),
    enabled: !!username,
    staleTime: 10 * 60 * 1000,
    retry: false,
  });

  const badges = visibleBadges(data?.badges);
  if (!badges.length) return null;

  return (
    <div className="lb-badges">
      {badges.map((b) => {
        const Icon = BADGE_ICONS[b.metric] || MdOndemandVideo;
        return (
          <Link
            key={b.metric}
            to={`/leaderboard?window=${b.window}&metric=${b.metric}&user=${encodeURIComponent(username)}`}
            className={`lb-badge lb-badge-${b.tier}`}
            title={badgeTitle(b)}
          >
            <Icon className="lb-badge-icon" />
            <span>{badgeLabel(b)}</span>
          </Link>
        );
      })}
    </div>
  );
}

export default LeaderboardBadges;
