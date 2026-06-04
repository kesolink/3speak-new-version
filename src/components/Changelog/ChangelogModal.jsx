import { useState, useEffect, useRef, useCallback } from 'react';
import { IoClose } from 'react-icons/io5';
import { useAppStore } from '../../lib/store';
import { APP_VERSION } from '../../version';
import { CHANGELOG, changelogSince } from '../../changelog';
import logo from '../../assets/image/3S_logo.svg';
import logoDark from '../../assets/image/3S_logodark.png';
import './ChangelogModal.scss';

// DUMMY MODE: while we design the popup it opens on every load with the latest
// entries so we can iterate on styling. To go live, set DUMMY_MODE = false — then
// it only opens for users who upgraded (store.appUpdatedFrom, set by checkAppVersion).
const DUMMY_MODE = false;

// Short, friendly relative date e.g. "2 weeks ago".
function timeAgo(dateStr) {
  const then = new Date(dateStr).getTime();
  if (isNaN(then)) return '';
  const days = Math.floor((Date.now() - then) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return months === 1 ? '1 month ago' : `${months} months ago`;
  const years = Math.floor(days / 365);
  return years === 1 ? '1 year ago' : `${years} years ago`;
}

export default function ChangelogModal() {
  const appUpdatedFrom = useAppStore((s) => s.appUpdatedFrom);
  const setAppUpdatedFrom = useAppStore((s) => s.setAppUpdatedFrom);
  const theme = useAppStore((s) => s.theme);
  const [open, setOpen] = useState(false);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(true);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (DUMMY_MODE) {
      setOpen(true);
      return;
    }
    if (appUpdatedFrom) setOpen(true);
  }, [appUpdatedFrom]);

  // Lock the page behind the popup so the scroll wheel never scrolls the site.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [open]);

  // Recompute which edge fades should show.
  const updateFades = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 1);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 1);
  }, []);

  // Translate vertical mouse-wheel into horizontal scrolling of the entries row.
  // Native non-passive listener so we can preventDefault (background stays put).
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !open) return;
    updateFades();
    const onWheel = (e) => {
      if (e.deltaY === 0) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [open, updateFades]);

  if (!open) return null;

  const entries = DUMMY_MODE ? CHANGELOG : changelogSince(appUpdatedFrom);
  if (entries.length === 0) return null;

  const close = () => {
    setOpen(false);
    if (!DUMMY_MODE) setAppUpdatedFrom(null);
  };

  return (
    <div className="changelog-overlay" onClick={close}>
      <div className="changelog-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <button className="changelog-close" onClick={close} aria-label="Close">
          <IoClose />
        </button>

        <div className="changelog-header">
          <img className="changelog-logo" src={theme === 'dark' ? logoDark : logo} alt="3Speak" />
          <h2>We shipped an update!</h2>
          <p className="changelog-subtitle">Here&apos;s what&apos;s new in v{APP_VERSION}</p>
        </div>

        <div className={`changelog-scroller${atStart ? ' at-start' : ''}${atEnd ? ' at-end' : ''}`}>
          <div className="changelog-body" ref={scrollRef} onScroll={updateFades}>
            {entries.map((entry) => (
              <div className="changelog-entry" key={entry.version}>
                <div className="changelog-entry-meta">
                  <span className="changelog-entry-version">v{entry.version}</span>
                  {entry.date && <span className="changelog-entry-date">{timeAgo(entry.date)}</span>}
                </div>
                <p className="changelog-entry-summary">{entry.summary}</p>
              </div>
            ))}
          </div>
          <span className="changelog-fade left" aria-hidden="true" />
          <span className="changelog-fade right" aria-hidden="true" />
        </div>

        <button className="changelog-cta" onClick={close}>Got it</button>
      </div>
    </div>
  );
}
