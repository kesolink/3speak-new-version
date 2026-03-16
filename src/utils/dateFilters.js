export const DATE_FILTERS = [
  { key: 'all', label: 'All Time' },
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
];

export function getSinceTimestamp(filterKey) {
  if (filterKey === 'all') return 0;
  const now = new Date();
  if (filterKey === 'today') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.floor(start.getTime() / 1000);
  }
  if (filterKey === 'week') {
    const day = now.getDay();
    const diff = day === 0 ? 6 : day - 1; // Monday as start of week
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff);
    return Math.floor(start.getTime() / 1000);
  }
  if (filterKey === 'month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return Math.floor(start.getTime() / 1000);
  }
  return 0;
}

export function formatRelativeDate(timestamp) {
  if (!timestamp) return '';
  const date = new Date(typeof timestamp === 'number' && timestamp < 1e12 ? timestamp * 1000 : timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
