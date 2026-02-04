import { Link } from 'react-router-dom';
import { MdPlaylistPlay } from 'react-icons/md';
import { useVideoPlaylists } from '../../hooks/useVideoPlaylists';
import './VideoPlaylists.scss';

function VideoPlaylists({ author, permlink }) {
  const { data: playlists = [], isLoading } = useVideoPlaylists(author, permlink);

  // Don't render anything if loading or no playlists
  if (isLoading || playlists.length === 0) return null;

  return (
    <div className="video-playlists">
      <h4>
        <MdPlaylistPlay /> Included in {playlists.length} {playlists.length === 1 ? 'playlist' : 'playlists'}
      </h4>
      <div className="playlist-chips">
        {playlists.map((playlist, index) => (
          <Link
            key={playlist.id || `playlist-${index}`}
            to={`/playlist/${playlist.id}`}
            className="playlist-chip"
          >
            <span className="name">{playlist.name}</span>
            <span className="owner">@{playlist.owner}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default VideoPlaylists;
