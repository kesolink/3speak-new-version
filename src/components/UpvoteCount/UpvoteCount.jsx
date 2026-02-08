import { FaHeart } from 'react-icons/fa';
import './UpvoteCount.scss';

function UpvoteCount({ count, voted, onClick, loading, onCountEnter, onCountLeave, size, children }) {
  const iconSize = size ? Math.round(size * 1.08) : undefined;

  return (
    <div className={`upvote-count-badge${voted ? ' voted' : ''}`} style={size ? { fontSize: size } : undefined}>
      {loading ? (
        children
      ) : (
        <FaHeart
          className={`upvote-icon${onClick ? ' clickable' : ''}`}
          size={iconSize || undefined}
          onClick={onClick}
        />
      )}
      <span onMouseEnter={onCountEnter} onMouseLeave={onCountLeave}>
        {count ?? '…'}
      </span>
    </div>
  );
}

export default UpvoteCount;
