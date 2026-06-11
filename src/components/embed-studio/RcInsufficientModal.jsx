import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { IoClose } from 'react-icons/io5';
import { BsLightningChargeFill } from 'react-icons/bs';
import { formatDuration } from '../../utils/rcCheck';
import './RcInsufficientModal.scss';

/**
 * Shown before an upload when the user doesn't have enough Resource Credits (RC)
 * to publish a post on Hive. Explains what RC is and — when waiting will help —
 * a live estimate of when their RC will have regenerated enough.
 *
 * Props:
 *   isOpen       boolean
 *   onClose      () => void
 *   status       result of checkPostingRc(): { percentage, secondsUntilEnough, canEverAfford, ... }
 *   onRecheck    () => void   re-run the RC check (RC regenerates over time)
 *   rechecking   boolean
 */
export default function RcInsufficientModal({ isOpen, onClose, status, onRecheck, rechecking }) {
  // Live countdown so the "ready in ~X" estimate ticks down while the modal is open.
  const [remaining, setRemaining] = useState(status?.secondsUntilEnough ?? 0);

  useEffect(() => {
    setRemaining(status?.secondsUntilEnough ?? 0);
  }, [status?.secondsUntilEnough]);

  useEffect(() => {
    if (!isOpen || !Number.isFinite(remaining) || remaining <= 0) return;
    const id = setInterval(() => {
      setRemaining((r) => (Number.isFinite(r) && r > 0 ? r - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, [isOpen, remaining]);

  if (!isOpen || !status) return null;

  const pct = Math.max(0, Math.min(100, status.percentage ?? 0));
  const canEverAfford = status.canEverAfford !== false;

  return createPortal(
    <div className="rc-modal-overlay" onClick={onClose}>
      <div className="rc-modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="rc-close-btn" onClick={onClose} aria-label="Close">
          <IoClose size={22} />
        </button>

        <div className="rc-modal-icon">
          <BsLightningChargeFill />
        </div>

        <h3 className="rc-modal-title">Not enough Resource Credits</h3>

        <p className="rc-modal-text">
          Every post on the Hive blockchain costs a small amount of{' '}
          <strong>Resource Credits (RC)</strong> — a free allowance that refills
          on its own over time. Right now your account doesn&apos;t have enough RC
          to publish this video, so the upload can&apos;t be finished yet.
        </p>

        <div className="rc-meter" aria-label={`Resource credits ${pct.toFixed(0)} percent`}>
          <div className="rc-meter-bar">
            <div className="rc-meter-fill" style={{ width: `${pct}%` }} />
          </div>
          <span className="rc-meter-label">{pct.toFixed(0)}% RC available</span>
        </div>

        {canEverAfford ? (
          <div className="rc-eta">
            <span className="rc-eta-label">Estimated ready in</span>
            <span className="rc-eta-value">{formatDuration(remaining)}</span>
            <span className="rc-eta-hint">
              Your RC refills automatically — just check back later, or come back
              when it&apos;s topped up.
            </span>
          </div>
        ) : (
          <div className="rc-eta rc-eta--blocked">
            <span className="rc-eta-hint">
              Even at a full bar your account doesn&apos;t have enough RC for a
              post yet. This usually means very little Hive Power. Powering up a
              little HP — or receiving an RC delegation — will fix it. New to
              Hive? Reach out on the{' '}
              <a href="https://discord.gg/3speak" target="_blank" rel="noopener noreferrer">
                3Speak Discord
              </a>{' '}
              and we&apos;ll help you get started.
            </span>
          </div>
        )}

        <div className="rc-modal-actions">
          {canEverAfford && (
            <button
              type="button"
              className="rc-btn rc-btn--primary"
              onClick={onRecheck}
              disabled={rechecking}
            >
              {rechecking ? 'Checking…' : 'Re-check now'}
            </button>
          )}
          <button type="button" className="rc-btn rc-btn--ghost" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
