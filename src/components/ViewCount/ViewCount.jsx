import { useState, useEffect } from 'react';
import { IoEye, IoEyeOutline } from 'react-icons/io5';
import axios from 'axios';
import { useAppStore } from '../../lib/store';
import { batchCheckWatched } from '../../utils/watchHistory';
import { VIEWS_URL } from '../../utils/config';
import './ViewCount.scss';

function ViewCount({ views, watched, formatViews, author, permlink, size }) {
  const { user } = useAppStore();
  const [selfWatched, setSelfWatched] = useState(false);
  const [selfViews, setSelfViews] = useState(null);

  useEffect(() => {
    if (watched != null || !author || !permlink || !user) return;
    let cancelled = false;
    batchCheckWatched(user, [{ author, permlink }]).then((result) => {
      if (!cancelled) {
        setSelfWatched(result.has(`${author}/${permlink}`));
      }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [author, permlink, user, watched]);

  useEffect(() => {
    if (views || !author || !permlink) return;
    let cancelled = false;
    axios.post(`${VIEWS_URL}/views`, {
      videos: [{ author, permlink }]
    }, { timeout: 15000 }).then((res) => {
      if (!cancelled && res.data?.success) {
        const count = res.data.data?.[`${author}/${permlink}`];
        if (count != null) setSelfViews(count);
      }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [author, permlink, views]);

  const isWatched = watched ?? selfWatched;
  const displayViews = views ?? selfViews;
  const display = formatViews ? formatViews(displayViews) : displayViews?.toLocaleString() ?? '0';
  const iconSize = size ? Math.round(size * 1.15) : undefined;

  return (
    <div className={`view-count-badge${isWatched ? ' watched' : ''}`} style={size ? { fontSize: size } : undefined}>
      {isWatched ? <IoEye size={iconSize} className="view-icon" /> : <IoEyeOutline size={iconSize} className="view-icon" />}
      <span>{display}</span>
    </div>
  );
}

export default ViewCount;
