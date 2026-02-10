import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import utc from 'dayjs/plugin/utc';
import './TimeAgo.scss';

dayjs.extend(relativeTime);
dayjs.extend(utc);

// Ensure date is treated as UTC (Hive dates have no "Z" suffix)
function toUtc(date) {
  if (dayjs.isDayjs(date)) return date.isUTC() ? date : date.utc();
  const s = typeof date === 'string' ? date : '';
  // If no timezone indicator, treat as UTC
  if (s && !/Z$/.test(s) && !/[+-]\d{2}:\d{2}$/.test(s)) {
    return dayjs.utc(date);
  }
  return dayjs(date).utc();
}

function shortTime(date) {
  const now = dayjs.utc();
  const d = toUtc(date);
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

function longTime(date) {
  const now = dayjs.utc();
  const d = toUtc(date);
  const seconds = now.diff(d, 'second');
  if (seconds < 60) return 'just now';
  const minutes = now.diff(d, 'minute');
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
  const hours = now.diff(d, 'hour');
  if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  const days = now.diff(d, 'day');
  if (days < 30) return `${days} day${days !== 1 ? 's' : ''} ago`;
  const months = now.diff(d, 'month');
  if (months < 12) return `${months} month${months !== 1 ? 's' : ''} ago`;
  const years = now.diff(d, 'year');
  return `${years} year${years !== 1 ? 's' : ''} ago`;
}

function TimeAgo({ date, unix, short }) {
  const d = unix ? dayjs.unix(date).utc() : toUtc(date);
  if (short) return <span>{shortTime(d)}</span>;
  return (
    <span className="time-ago-wrap">
      <span className="time-long">{longTime(d)}</span>
      <span className="time-short">{shortTime(d)}</span>
    </span>
  );
}

export default TimeAgo;
