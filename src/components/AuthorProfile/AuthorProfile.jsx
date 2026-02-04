import { Link } from "react-router-dom";
import PropTypes from "prop-types";
import "./AuthorProfile.scss";

/**
 * Reusable component for displaying author avatar and username with link
 * @param {string} author - The author's username
 * @param {string} className - Additional CSS classes
 * @param {boolean} showAvatar - Whether to show the avatar image (default: true)
 * @param {boolean} noLink - Whether to render without a link (useful when nested inside another link)
 */
function AuthorProfile({ author, className = "", showAvatar = true, noLink = false }) {
  if (!author) return null;

  const content = (
    <>
      {showAvatar && (
        <img
          className="author-avatar"
          src={`https://images.hive.blog/u/${author}/avatar`}
          alt={author}
        />
      )}
      <span className="author-name">{author}</span>
    </>
  );

  if (noLink) {
    return (
      <span className={`author-profile ${className}`}>
        {content}
      </span>
    );
  }

  return (
    <Link
      to={`/p/${author}`}
      className={`author-profile ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      {content}
    </Link>
  );
}

AuthorProfile.propTypes = {
  author: PropTypes.string.isRequired,
  className: PropTypes.string,
  showAvatar: PropTypes.bool,
  noLink: PropTypes.bool,
};

export default AuthorProfile;
