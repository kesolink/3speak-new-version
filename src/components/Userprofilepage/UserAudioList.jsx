import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { CHECKER_URL } from '../../utils/config';
import AudioTile from '../AudioTile/AudioTile';
import BarLoader from '../Loader/BarLoader';
import icon from '../../../public/images/stack.png';
import './UserAudioList.scss';

function UserAudioList({ user }) {
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
    return (
      <div className="empty-wrap">
        <img src={icon} alt="" />
        <span>No Audio Tracks Available</span>
      </div>
    );
  }

  return (
    <div className="audio-tile-grid user-audio-list-grid">
      {audio.map((item) => (
        <AudioTile key={item._id || item.permlink} item={item} contextItems={audio} />
      ))}
    </div>
  );
}

export default UserAudioList;
