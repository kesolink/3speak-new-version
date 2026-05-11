import { useQuery } from '@tanstack/react-query';
import { HangoutsApiClient } from '@snapie/hangouts-core';
import { Link, useNavigate } from 'react-router-dom';
import { useHangout } from '../../context/HangoutContext';
import { useAppStore } from '../../lib/store';
import { MdMic } from 'react-icons/md';
import './OpenPodsLiveStrip.scss';

const HANGOUTS_API_URL = import.meta.env.VITE_HANGOUTS_API_URL || '';
const client = HANGOUTS_API_URL
  ? new HangoutsApiClient({ baseUrl: HANGOUTS_API_URL })
  : null;

export default function OpenPodsLiveStrip() {
  const { openRoom } = useHangout();
  const { authenticated } = useAppStore();
  const navigate = useNavigate();

  const { data: rooms = [] } = useQuery({
    queryKey: ['openpods-live-rooms'],
    queryFn: () => client.listRooms(),
    refetchInterval: 30_000,
    staleTime: 20_000,
    enabled: !!client,
  });

  if (rooms.length === 0) return null;

  const handleJoinRoom = (roomName) => {
    if (!authenticated) {
      navigate('/login');
      return;
    }
    openRoom(roomName);
  };

  return (
    <div className="openpods-live-strip">
      <div className="strip-header">
        <MdMic className="strip-mic-icon" />
        <span className="strip-label">
          <span className="strip-count">{rooms.length}</span>
          {' '}OpenPod{rooms.length !== 1 ? 's' : ''} live now
        </span>
        <Link to="/openpods" className="strip-view-all">View all</Link>
      </div>

      <div className="strip-cards">
        {rooms.map((room) => (
          <button
            key={room.name}
            className="strip-card"
            onClick={() => handleJoinRoom(room.name)}
            aria-label={`Join OpenPod: ${room.title}`}
          >
            <img
              className="strip-card-avatar"
              src={`https://images.hive.blog/u/${room.host}/avatar/sm`}
              alt={room.host}
              onError={(e) => { e.target.style.display = 'none'; }}
            />
            <div className="strip-card-info">
              <span className="strip-card-title">{room.title}</span>
              <span className="strip-card-host">@{room.host}</span>
            </div>
            {room.numParticipants > 0 && (
              <span className="strip-card-listeners">{room.numParticipants}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
