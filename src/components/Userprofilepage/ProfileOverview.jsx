import { useEffect, useState } from 'react';
import Card3 from '../Cards/Card3';
import PlaylistCard from '../Cards/PlaylistCard';
import UserAudioList from './UserAudioList';
import ChannelTrailer from './ChannelTrailer';
import CommunitySnaps from './CommunitySnaps';
import './ProfileOverview.scss';

/**
 * The Overview tab: a channel trailer, then a short preview row of each kind of
 * thing this creator makes, each with a way through to the full tab.
 *
 * The point is that a visitor can see the shape of a channel without choosing a
 * tab first — the old default dropped you straight into an endless video list,
 * which said nothing about whether they also make shorts, audio or playlists.
 *
 * Sections with nothing in them are omitted rather than shown empty.
 */

const DESKTOP_COUNT = 6;
const MOBILE_COUNT = 4;

// Videos and shorts rails show far more than the other sections. The 6/4 cap
// existed only to stop a preview row wrapping into a grid; now that these rails
// scroll sideways they are one row tall whatever they contain, so the cap was
// just hiding content. 20 matches the parent's page size (UserProfilePage's
// LIMIT), so everything already fetched is shown without triggering a new page.
const RAIL_COUNT = 20;

function Section({ title, count, onViewMore, children }) {
  if (!count) return null;
  return (
    <section className="pov-section">
      <div className="pov-head">
        <h3>{title}</h3>
        {onViewMore ? (
          <button type="button" className="pov-more" onClick={onViewMore}>
            View more
          </button>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export default function ProfileOverview({
  username,
  videos = [],
  shorts = [],
  playlists = [],
  snapCount = 0,
  onOpenTab,
  getContentForVideo,
  isWatched,
  getViewCount,
}) {
  // Still responsive for the sections that are not video rails (playlists,
  // audio, snaps), which stay short previews.
  const [perRow, setPerRow] = useState(
    () => (typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches
      ? MOBILE_COUNT : DESKTOP_COUNT),
  );
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const on = () => setPerRow(mq.matches ? MOBILE_COUNT : DESKTOP_COUNT);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  const videoSlice = videos.slice(0, RAIL_COUNT);
  const shortSlice = shorts.slice(0, RAIL_COUNT);
  const playlistSlice = playlists.slice(0, perRow);

  return (
    <div className="profile-overview">
      <ChannelTrailer username={username} />

      <Section title="Videos" count={videoSlice.length} onViewMore={() => onOpenTab('video')}>
        <Card3
          videos={videoSlice}
          getContentForVideo={getContentForVideo}
          isWatched={isWatched}
          getViewCount={getViewCount}
        />
      </Section>

      <Section title="Shorts" count={shortSlice.length} onViewMore={() => onOpenTab('shorts')}>
        <Card3
          videos={shortSlice}
          shortsGrid
          linkPrefix="/shorts"
          getViewCount={getViewCount}
        />
      </Section>

      {/* Audio, community posts and playlists own their own data, so they're
          rendered limited rather than sliced here, and hide when empty. */}
      <section className="pov-section pov-section--audio">
        <div className="pov-head">
          <h3>Audio</h3>
          <button type="button" className="pov-more" onClick={() => onOpenTab('audio')}>View more</button>
        </div>
        <UserAudioList user={username} limit={perRow} />
      </section>

      {snapCount > 0 && (
        <section className="pov-section">
          <div className="pov-head">
            <h3>Community</h3>
            <button type="button" className="pov-more" onClick={() => onOpenTab('community')}>View more</button>
          </div>
          <CommunitySnaps user={username} limit={perRow} hideEmpty />
        </section>
      )}

      <Section title="Playlists" count={playlistSlice.length} onViewMore={() => onOpenTab('playlists')}>
        <PlaylistCard playlists={playlistSlice} />
      </Section>
    </div>
  );
}
