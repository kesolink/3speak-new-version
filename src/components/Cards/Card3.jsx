import PayoutAmount from "../PayoutAmount/PayoutAmount";
import { useDeadVideos } from '../../lib/deadVideos';
import UpvoteCount from "../UpvoteCount/UpvoteCount";
import ViewCount from "../ViewCount/ViewCount";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { IoCalendarOutline } from "react-icons/io5";
dayjs.extend(utc);
import { MdDelete, MdError, MdPhoneIphone, MdVisibilityOff } from "react-icons/md";
import { FaCog, FaFileAlt } from "react-icons/fa";
import CardOptionsMenu from "../CardOptionsMenu/CardOptionsMenu";
import TimeAgo from "../TimeAgo/TimeAgo";
import { Link, useNavigate } from "react-router-dom";
import PropTypes from "prop-types";
import "./Cards.scss";
import { useState, useMemo, memo, useCallback } from "react";
import img from "../../assets/image/speak.jpg";
import CardThumbnail from "./CardThumbnail";
import { fixVideoThumbnail } from "../../utils/fixThumbnails";
import AuthorBadge from "../AuthorBadge/AuthorBadge";
import ProfileModal from "../modal/ProfileModal";
import useHoverPreview from "../../hooks/useHoverPreview";


/**
 * Splice extra nodes into the card grid after every `every` cards — used by the
 * Discover tab to drop a shorts rail between video rows.
 *
 * The inserted node must span the whole grid (`grid-column: 1 / -1`, see
 * ShortsRow.scss) or it would just occupy one cell and shove the row out of
 * alignment. `every` is computed from the LIVE column count, not guessed, so the
 * rail always lands on a row boundary at any breakpoint.
 */
// Supports MULTIPLE full-width interleave streams (e.g. shorts rails + community
// posts), each `{ every, render, key }`. Both can land after the same card.
function withInterleave(cards, channels) {
  const active = (channels || []).filter((c) => c && c.every >= 1 && typeof c.render === 'function');
  if (!active.length) return cards;
  const out = [];
  cards.forEach((card, i) => {
    out.push(card);
    const n = i + 1;
    if (n >= cards.length) return; // never append after the last card
    active.forEach((ch) => {
      if (n % ch.every !== 0) return;
      const slot = n / ch.every - 1;
      const node = ch.render(slot);
      if (node) out.push(<div className="card-interleave" key={`${ch.key || 'il'}-${slot}`}>{node}</div>);
    });
  });
  return out;
}

function Card3({ videos = [], loading = false, error = null, interleaveEvery = 0, renderInterleave = null, communityEvery = 0, renderCommunity = null, getContentForVideo = null, isWatched = null, getViewCount = null, linkPrefix = '/watch', linkQuery = '', shortTimeAgo = true, shortsGrid = false, priority = false, hideWatched = false, watchedVersion = 0 }) {
  const navigate = useNavigate();
  const [modalUser, setModalUser] = useState(null);

  // Locally dismissed content ("not interested" / hidden creator). The checker
  // filters these out server-side, but only from the NEXT feed fetch — so we drop
  // the cards here immediately, and put them back if the user hits Undo.
  const [dismissed, setDismissed] = useState({ videos: new Set(), creators: new Set() });

  const handleDismiss = useCallback((kind, { owner, permlink } = {}) => {
    const key = `${String(owner).toLowerCase()}/${permlink}`;
    const creator = String(owner).toLowerCase();
    setDismissed((prev) => {
      const next = { videos: new Set(prev.videos), creators: new Set(prev.creators) };
      if (kind === "video") next.videos.add(key);
      else if (kind === "undo-video") next.videos.delete(key);
      else if (kind === "creator") next.creators.add(creator);
      else if (kind === "undo-creator") next.creators.delete(creator);
      return next;
    });
  }, []);

  // Hover-to-play preview (single reused player overlay) — shared with other grids.
  // On hover-capable devices the options menu is rendered INSIDE the preview
  // overlay: `.card:hover` sets a transform, which makes the card its own stacking
  // context, so a menu rendered in the card is always painted under the overlay.
  const renderCardControls = useCallback(({ author, permlink, title, setLock }) => (
    <CardOptionsMenu
      author={author}
      permlink={permlink}
      title={title}
      onDismiss={handleDismiss}
      onOpenChange={setLock}
    />
  ), [handleDismiss]);

  const { containerProps, getCardProps, overlay, canHover } = useHoverPreview({
    renderControls: renderCardControls,
  });

  const formatViewCount = (views) => {
    if (views === null || views === undefined) return null;
    if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M`;
    if (views >= 1000) return `${(views / 1000).toFixed(1)}K`;
    return views.toLocaleString();
  };

  // Videos the checker has confirmed are dead (404 on EVERY gateway). Cards preload
  // their own manifest, so a dead one is usually found while it's still on screen —
  // drop it right away instead of leaving a card that plays nothing until the next
  // feed fetch. Empty on the normal path, so this costs nothing.
  const deadVideos = useDeadVideos();

  // Memoize video processing to prevent re-computing thumbnails on every render
  const processedVideos = useMemo(() => {
    const ownerOf = (v) => String(v.author?.username || v.author || v.owner || "").toLowerCase();
    return videos
      .filter((v) => !dismissed.creators.has(ownerOf(v)))
      .filter((v) => !dismissed.videos.has(`${ownerOf(v)}/${v.permlink}`))
      .filter((v) => !deadVideos.has(`${ownerOf(v)}/${v.permlink}`))
      // Already-watched: same reason as `dismissed` above — the checker only drops
      // watched videos from the NEXT feed fetch, so a just-watched one lingers in the
      // cached feed until then. When the caller opts in (feeds with "Hide watched"
      // on), drop it here immediately. Opt-in so profiles/playlists/related — which
      // pass isWatched only to BADGE — keep showing watched videos.
      //
      // NOTE the author here is the NON-lowercased `video.author?.username || …`,
      // matching exactly how useWatchHistory keys its map and how the badge below
      // calls isWatched (vcAuthor) — `ownerOf` lowercases and would miss.
      // watchedVersion is in the deps so this recomputes when watch data arrives
      // (isWatched is a stable ref-reader and wouldn't trigger it alone).
      .filter((v) => !(hideWatched && isWatched
        && isWatched(v.author?.username || v.author || v.owner, v.permlink) === true))
      .map(video => ({
        ...video,
        _processedThumbnail: fixVideoThumbnail(video, shortsGrid)
      }));
  }, [videos, shortsGrid, dismissed, deadVideos, hideWatched, isWatched, watchedVersion]);

  if (loading && videos.length === 0) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div
      className={`card-container${shortsGrid ? ' card-container--shorts' : ''}`}
      {...containerProps}
    >
      {withInterleave(processedVideos.map((video, index) => {
        const postKey = `${video.author?.username || video.author || video.owner}/${
          video.permlink
        }`;

        const cardAuthor = video.author?.username || video.author || video.owner;

        return (
          <Link
            to={`${linkPrefix}?v=${cardAuthor}/${
              video.permlink
            }${linkQuery}${video._scheduled ? '&scheduled=1' : ''}`}
            className="card"
            key={postKey}
            data-vidkey={postKey}
            {...getCardProps(postKey, cardAuthor, video.permlink, video._processedThumbnail, video.status, video.title)}
          >
            {/* Thumbnail — fast fallback so a dead image host can't leave the
                card blank for ~a minute (see CardThumbnail). */}
            <div className="img-wrap">
              <CardThumbnail
                src={video._processedThumbnail}
                fallback={img}
                eager={priority && index < 6}
              />
              {!shortsGrid && (
                <div className="wrap">
                  <span className="play">
                    {Math.floor((video.spkvideo?.duration || video.duration) / 60)}:
                    {Math.floor((video.spkvideo?.duration || video.duration) % 60)
                      .toString()
                      .padStart(2, "0")}
                  </span>
                </div>
              )}

              {/* Options menu (playlist / not interested / hide creator).
                  Hover-capable devices get it inside the preview overlay instead —
                  see renderCardControls above. Touch devices never get the
                  `.card:hover` transform, so rendering here works for them. */}
              {!canHover && (
                <CardOptionsMenu
                  author={video.author?.username || video.author || video.owner}
                  permlink={video.permlink}
                  title={video.title}
                  onDismiss={handleDismiss}
                />
              )}

              {/* Status Badges */}
              {video.status === 'scheduled' && video.publish_type === 'schedule' && (
                <div className="status-badge scheduled">
                  <IoCalendarOutline size={18} />
                  <span>
                    {video.publish_data
                      ? dayjs(typeof video.publish_data === 'number' ? video.publish_data * 1000 : video.publish_data).format('MMM D, h:mm A')
                      : 'Scheduled'}
                  </span>
                </div>
              )}

              {video.publish_type === 'publish_manual' && (
                <div className="status-badge manual" title="Uploaded via mobile app">
                  <MdPhoneIphone size={18} />
                  <span>Mobile</span>
                </div>
              )}

              {video.status === 'encoding' && (
                <div className="status-badge encoding" title="Video is being processed">
                  <FaCog size={16} className="spin-icon" />
                  <span>Processing</span>
                </div>
              )}

              {video.status === 'draft' && (
                <div className="status-badge draft" title="Draft - not published yet">
                  <FaFileAlt size={16} />
                  <span>Draft</span>
                </div>
              )}

              {video.status === 'deleted' && (
                <div className="status-badge deleted" title="This video has been deleted">
                  <MdDelete size={18} />
                  <span>Deleted</span>
                </div>
              )}

              {video.status === 'failed' && (
                <div className="status-badge failed" title="Video processing failed">
                  <MdError size={18} />
                  <span>Failed</span>
                </div>
              )}

              {video.unlisted && (
                <div className="status-badge unlisted" title="Unlisted — hidden from feeds & search, only reachable by direct link">
                  <MdVisibilityOff size={18} />
                  <span>Unlisted</span>
                </div>
              )}
            </div>

            {/* Title */}
            <h2>{video.title}</h2>

            {/* Author */}
            <div className="profile-view-wrap">
              <AuthorBadge
                author={video.author?.username || video.author || video.owner}
                noLink
                compact
              />
              {(() => {
                const vcAuthor = video.author?.username || video.author || video.owner;
                // Prefer the count already in the feed payload (the only source that
                // resolves embed videos — /views can't look them up by hive permlink).
                // Fall back to the batched /views fetch for legacy videos.
                const feedViews = video.views ?? video.stats?.num_views;
                const fetchedViews = getViewCount?.(vcAuthor, video.permlink);
                const resolvedViews = feedViews != null ? feedViews : fetchedViews;
                if (resolvedViews == null) return null;
                return (
                  <ViewCount
                    views={resolvedViews}
                    watched={isWatched?.(vcAuthor, video.permlink) === true}
                    formatViews={formatViewCount}
                  />
                );
              })()}
            </div>

            {/* Bottom actions */}
            <div className="bottom-action">
              <div className="wrap-left">
                <PayoutAmount
                  amount={(() => {
                    const author = video.author?.username || video.author || video.owner;
                    const content = getContentForVideo?.(author, video.permlink);
                    const val = content?.payout ?? video.stats?.total_hive_reward;
                    return val != null ? Number(val) : null;
                  })()}
                />
                <UpvoteCount
                  count={(() => {
                    const author = video.author?.username || video.author || video.owner;
                    const content = getContentForVideo?.(author, video.permlink);
                    return content?.voters ?? video.stats?.num_votes ?? null;
                  })()}
                />
              </div>
              <p><TimeAgo date={video.created_at || video.created} short={shortTimeAgo} /></p>
            </div>
          </Link>
        );
      }), [
        { every: interleaveEvery, render: renderInterleave, key: 'shorts' },
        { every: communityEvery, render: renderCommunity, key: 'community' },
      ])}
      {modalUser && (
        <ProfileModal
          username={modalUser}
          onClose={() => setModalUser(null)}
        />
      )}

      {overlay}
    </div>
  );
}

Card3.propTypes = {
  videos: PropTypes.array.isRequired,
  loading: PropTypes.bool,
  error: PropTypes.string,
  getContentForVideo: PropTypes.func,
  isWatched: PropTypes.func,
  hideWatched: PropTypes.bool,       // opt-in: drop (not just badge) already-watched videos
  watchedVersion: PropTypes.number,  // bump from useWatchHistory so the filter reacts to new data
  getViewCount: PropTypes.func,
  linkPrefix: PropTypes.string,
};

export default memo(Card3);
