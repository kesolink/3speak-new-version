import { useNavigate } from 'react-router-dom';
import { MdPlayArrow, MdPlaylistPlay, MdShare, MdAdd } from 'react-icons/md';
import { useAppStore } from '../../lib/store';
import PayoutAmount from '../PayoutAmount/PayoutAmount';
import { fixVideoThumbnail, fallbackImg } from '../../utils/fixThumbnails';
// Reuse the existing tile styles defined in Audio.scss so this component is the
// single source of truth and stays visually identical across pages.
import '../../page/Audio.scss';

function audioThumb(item) {
  if (!item) return fallbackImg;
  const fixed = fixVideoThumbnail({ thumbnail_url: item.thumbnail_url, thumbnail: item.thumbnail_url });
  if (fixed && fixed !== fallbackImg && fixed !== '/images/speak.jpg') return fixed;
  // Fall back to the cover of the first playlist this audio was published into
  // (set by the checker via $lookup against the playlists collection).
  if (item.playlist_thumbnail) return item.playlist_thumbnail;
  return `https://images.hive.blog/u/${item.owner}/avatar`;
}

function fmt(sec) {
  if (!sec || isNaN(sec)) return '0:00';
  const s = Math.floor(sec);
  if (s >= 3600) return `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function fmtAgo(ds) {
  if (!ds) return '';
  const d = Math.floor((Date.now() - new Date(ds).getTime()) / 1000);
  if (d < 60) return 'now';
  if (d < 3600) return `${Math.floor(d / 60)}m`;
  if (d < 86400) return `${Math.floor(d / 3600)}h`;
  if (d < 2592000) return `${Math.floor(d / 86400)}d`;
  return `${Math.floor(d / 2592000)}mo`;
}

const CATEGORY_LABELS = {
  podcast: 'Podcast',
  voice_message: 'Voice',
  song: 'Music',
  audiobook: 'Audiobook',
  interview: 'Interview',
};

// Build a one-line metadata summary shown beneath the username:
//   - For music tracks with a genre, the genre replaces the type label
//   - Audio with no category falls back to "Voice"
//   - bpm is appended when present
function getMetaLine(item) {
  const parts = [];
  const isMusic = item.category === 'song' || item.category === 'music';
  if (isMusic && item.genre) {
    parts.push(String(item.genre));
  } else if (item.category && CATEGORY_LABELS[item.category]) {
    parts.push(CATEGORY_LABELS[item.category]);
  } else {
    parts.push(CATEGORY_LABELS.voice_message);
  }
  if (item.bpm) parts.push(`${item.bpm} bpm`);
  return parts.join(' · ');
}

/**
 * Self-contained audio tile. Plays through the global player by default.
 *
 * Props:
 *   item          — required, an `embed-audio` doc
 *   contextItems  — optional list used for next/prev autoplay (defaults to [item])
 *   onPlay        — override the default play behavior
 *   onAddToQueue  — override default queue behavior
 *   onAuthorClick — override default (navigate to /@owner)
 *   onAddToPlaylist, onShare, onVote — optional; the corresponding action button
 *                  is only rendered when its callback is provided
 *   loggedIn      — gate playlist button rendering (defaults to false)
 */
function AudioTile({
  item,
  contextItems,
  onPlay,
  onAddToQueue,
  onAuthorClick,
  onAddToPlaylist,
  onShare,
  onVote, // eslint-disable-line no-unused-vars
  loggedIn = false,
}) {
  const audioCurrent = useAppStore((s) => s.audioCurrent);
  const audioIsPlaying = useAppStore((s) => s.audioIsPlaying);
  const audioPlay = useAppStore((s) => s.audioPlay);
  const audioAddToQueue = useAppStore((s) => s.audioAddToQueue);
  const navigate = useNavigate();

  const isCurrent = audioCurrent?._id === item._id;
  const isPlaying = isCurrent && audioIsPlaying;

  const handlePlay = () => {
    if (onPlay) return onPlay();
    audioPlay(item, contextItems || [item]);
  };
  const handleQueue = (e) => {
    e.stopPropagation();
    if (onAddToQueue) return onAddToQueue();
    audioAddToQueue(item);
  };
  const handleAuthor = (e) => {
    e.stopPropagation();
    if (onAuthorClick) return onAuthorClick();
    navigate(`/p/${item.owner}?tab=audio`);
  };

  const thumb = audioThumb(item);
  const metaLine = getMetaLine(item);

  const actions = (
    <div className="audio-tile-actions" onClick={(e) => e.stopPropagation()}>
      <button className="audio-tile-action-btn" onClick={handleQueue} title="Queue"><MdAdd size={14} /></button>
      {loggedIn && onAddToPlaylist && (
        <button className="audio-tile-action-btn" onClick={(e) => { e.stopPropagation(); onAddToPlaylist(); }} title="Playlist"><MdPlaylistPlay size={14} /></button>
      )}
      {onShare && (
        <button className="audio-tile-action-btn" onClick={(e) => { e.stopPropagation(); onShare(); }} title="Share"><MdShare size={14} /></button>
      )}
    </div>
  );

  const cover = (
    <div className="audio-tile-cover" onClick={handlePlay}>
      <img src={thumb} alt="" onError={(e) => { e.currentTarget.src = fallbackImg; }} />
      <div className="audio-tile-overlay">
        {isPlaying ? <div className="audio-tile-eq"><span /><span /><span /></div> : <MdPlayArrow size={28} />}
      </div>
      <span className="audio-tile-duration">{fmt(item.duration)}</span>
      {actions}
    </div>
  );

  const body = (
    <div className="audio-tile-body">
      <span className="audio-tile-title" onClick={handlePlay}>{item.title || 'Untitled'}</span>
      <span className="audio-tile-author" onClick={handleAuthor}>@{item.owner}</span>
      {metaLine && <span className="audio-tile-meta">{metaLine}</span>}
      <div className="audio-tile-footer">
        {item.plays > 0 && <span>{item.plays} plays</span>}
        {item.stats?.total_hive_reward > 0 && <PayoutAmount amount={item.stats.total_hive_reward} size={10} />}
        <span>{fmtAgo(item.createdAt)}</span>
      </div>
    </div>
  );

  return (
    <div className={`audio-tile${isCurrent ? ' audio-tile-active' : ''}`}>
      {cover}
      {body}
    </div>
  );
}

export function AudioTileSkeleton({ count = 5 }) {
  return [...Array(count)].map((_, i) => <div key={i} className="audio-tile-skeleton" />);
}

export default AudioTile;
