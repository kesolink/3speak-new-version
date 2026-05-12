import { usePremiumStatus } from '../../hooks/usePremiumStatus';
import './PremiumBadge.scss';

/**
 * Tiny "3Speak Pro" indicator. Renders a stylised crown that picks up
 * `currentColor` so it blends with whatever container it's dropped into.
 * Returns null when the user has no premium flag — safe to drop next to
 * any avatar without per-call gating.
 *
 * Props:
 *   username — Hive account to check. When unset, renders nothing.
 *   size     — pixel size of the inline SVG (default 14).
 *   title    — tooltip shown on hover.
 *   className — extra class for layout tweaks at the callsite.
 */
export default function PremiumBadge({ username, size = 14, title = '3Speak Pro', className }) {
  const status = usePremiumStatus(username);
  if (!status?.premium) return null;

  return (
    <span
      className={`hh-premium-badge${className ? ` ${className}` : ''}`}
      // `data-tooltip` powers the custom CSS hover tooltip (fast +
      // branded). aria-label keeps screen readers covered. No `title`
      // attribute — it'd double up with the native OS tooltip and
      // flash 500ms after ours appears.
      data-tooltip={title}
      aria-label={title}
      role="img"
      tabIndex={0}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {/* Rocket (Heroicons solid) — diagonal silhouette that still reads
            at 10–12px sizes once we drop it onto avatar corners. */}
        <path d="M9.315 7.584C12.195 3.883 16.695 1.5 21.75 1.5a.75.75 0 0 1 .75.75c0 5.056-2.383 9.555-6.084 12.436A6.75 6.75 0 0 1 9.75 22.5a.75.75 0 0 1-.75-.75v-4.131A15.838 15.838 0 0 1 6.382 15H2.25a.75.75 0 0 1-.75-.75 6.75 6.75 0 0 1 7.815-6.666ZM15 6.75a2.25 2.25 0 1 0 0 4.5 2.25 2.25 0 0 0 0-4.5Z" />
      </svg>
    </span>
  );
}
