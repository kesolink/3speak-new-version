import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { CHECKER_URL } from '../../utils/config';
import AudioTile from '../AudioTile/AudioTile';
import BarLoader from '../Loader/BarLoader';
import ProfileEmptyState from './ProfileEmptyState';
import './UserAudioList.scss';

// `limit` renders only the newest N (the Overview tab shows a preview row).
function UserAudioList({ user, limit = 0, isOwnProfile = false }) {
  const { data: audio = [], isLoading } = useQuery({
    queryKey: ['user-audio', user],
    queryFn: async () => {
      const { data } = await axios.get(`${CHECKER_URL}/audio?owner=${encodeURIComponent(user)}&limit=100&sort=newest`);
      return data?.audio || [];
    },
    enabled: !!user,
  });

  if (isLoading) return <BarLoader />;
  if (audio.length === 0) {
    return <ProfileEmptyState kind="audio" isOwnProfile={isOwnProfile} username={user} />;
  }

  const shown = limit > 0 ? audio.slice(0, limit) : audio;

  return (
    <div className="audio-tile-grid user-audio-list-grid">
      {shown.map((item) => (
        <AudioTile key={item._id || item.permlink} item={item} contextItems={audio} />
      ))}
    </div>
  );
}

export default UserAudioList;
