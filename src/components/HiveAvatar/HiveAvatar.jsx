import { forwardRef } from 'react';
import PremiumBadge from '../PremiumBadge/PremiumBadge';
import './HiveAvatar.scss';

/**
 * Hive profile avatar with a 3Speak Pro badge overlaid at the
 * top-right when the user is premium. Wraps the underlying `<img>` in
 * a positioned `<span>` so the badge can be absolutely placed.
 *
 * Props mirror the most common usages of the raw `<img>`:
 *  - username: Hive account (string). Required for the avatar URL +
 *    premium lookup. When empty, renders nothing.
 *  - size: 'small' | 'medium' | 'large'. Default 'small'. Maps to
 *    Hive's avatar size segment.
 *  - className: applied to the WRAPPER span (most existing call sites
 *    style the wrapper, not the img).
 *  - imgClassName: applied to the inner img, in case the caller has
 *    img-specific styles to preserve.
 *  - badgeSize: pixel size of the inline badge SVG.
 *  - alt, onClick, onError, ref: forwarded to the img.
 */
const HiveAvatar = forwardRef(function HiveAvatar(
  {
    username,
    size = 'small',
    className,
    imgClassName,
    badgeSize = 12,
    alt,
    onClick,
    onError,
    style,
  },
  ref,
) {
  if (!username) return null;
  // Honor the "no size segment" form some callers use — Hive returns
  // a medium-ish default for the bare `/avatar` URL.
  const url = size
    ? `https://images.hive.blog/u/${encodeURIComponent(username)}/avatar/${size}`
    : `https://images.hive.blog/u/${encodeURIComponent(username)}/avatar/small`;
  return (
    <span
      className={`hive-avatar${className ? ` ${className}` : ''}`}
      onClick={onClick}
      style={style}
    >
      <img
        ref={ref}
        src={url}
        alt={alt ?? username}
        className={imgClassName}
        onError={onError}
      />
      <PremiumBadge
        username={username}
        size={badgeSize}
        className="hive-avatar__badge"
      />
    </span>
  );
});

export default HiveAvatar;
