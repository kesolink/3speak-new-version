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
      title={title}
      aria-label={title}
      role="img"
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {/* Crown silhouette: three peaks + a base bar. Single path keeps
            the markup compact and currentColor-themable. */}
        <path d="M3 17a1 1 0 0 1-.99-1.15l1.4-8.4a1 1 0 0 1 1.7-.55l3.32 3.32 3.04-5.07a1 1 0 0 1 1.72 0l3.04 5.07 3.32-3.32a1 1 0 0 1 1.7.55l1.4 8.4A1 1 0 0 1 21 17H3zm0 2h18a1 1 0 0 1 0 2H3a1 1 0 0 1 0-2z" />
      </svg>
    </span>
  );
}
