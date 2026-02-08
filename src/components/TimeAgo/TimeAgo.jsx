import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import './TimeAgo.scss';

dayjs.extend(relativeTime);

function shortTime(date) {
  const now = dayjs();
  const d = dayjs(date);
  const seconds = now.diff(d, 'second');
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = now.diff(d, 'minute');
  if (minutes < 60) return `${minutes}m ago`;
  const hours = now.diff(d, 'hour');
  if (hours < 24) return `${hours}h ago`;
  const days = now.diff(d, 'day');
  if (days < 30) return `${days}d ago`;
  const months = now.diff(d, 'month');
  if (months < 12) return `${months}mo ago`;
  const years = now.diff(d, 'year');
  return `${years}y ago`;
}

function TimeAgo({ date, unix }) {
  const d = unix ? dayjs.unix(date) : dayjs(date);
  return (
    <span className="time-ago-wrap">
      <span className="time-long">{d.fromNow()}</span>
      <span className="time-short">{shortTime(d)}</span>
    </span>
  );
}

export default TimeAgo;
