import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getFollowers } from '../../hive-api/api';
import './AuthorBadge.scss';

function AuthorBadge({ author, onClick, followersCount, fetchFollowers, showFollow, isFollowing, onFollow, noLink, compact, reputation }) {
  const navigate = useNavigate();
  const [localFollowers, setLocalFollowers] = useState(null);

  useEffect(() => {
    if (!fetchFollowers || followersCount != null || !author) return;
    let cancelled = false;
    getFollowers(author).then((data) => {
      if (!cancelled && data?.follower_count != null) {
        setLocalFollowers(data.follower_count);
      }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [author, fetchFollowers, followersCount]);

  const displayFollowers = followersCount ?? localFollowers;

  const handleClick = (e) => {
    e.stopPropagation();
    if (onClick) {
      e.preventDefault();
      onClick(author);
    }
    if (noLink) {
      e.preventDefault();
      navigate(`/p/${author}`);
    }
  };

  const handleFollow = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (onFollow) onFollow(author);
  };

  const inner = (
    <>
      <img src={`https://images.hive.blog/u/${author}/avatar/small`} alt="" />
      <div className="author-text">
        <span className="author-name">@{author}{reputation != null ? ` (${Math.round(reputation)})` : ''}</span>
        {displayFollowers != null && (
          <span className="followers-count">{displayFollowers} Followers</span>
        )}
      </div>
    </>
  );

  return (
    <div className={`author-badge${compact ? ' compact' : ''}`}>
      {noLink ? (
        <span className="author-badge-link" onClick={handleClick}>
          {inner}
        </span>
      ) : (
        <Link to={`/p/${author}`} className="author-badge-link" onClick={handleClick}>
          {inner}
        </Link>
      )}
      {showFollow && (
        <button
          className={`follow-btn ${isFollowing ? 'following' : ''}`}
          onClick={handleFollow}
        >
          {isFollowing ? 'Following' : 'Follow'}
        </button>
      )}
    </div>
  );
}

export default AuthorBadge;
