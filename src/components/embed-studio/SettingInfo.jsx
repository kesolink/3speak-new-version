import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import './SettingInfo.scss';

/**
 * The (i) beside a setting's short description, holding the long explanation.
 *
 * Tiles only have room for a line or two, but several of these settings have
 * real consequences (NSFW hides a video from feeds, supporters-only cannot be
 * undone after upload), so the full wording has to stay reachable rather than
 * being cut.
 *
 * Rendered through a portal: the tiles sit inside a bordered panel with its own
 * stacking context, so an inline popover would be clipped by it. On phones it
 * comes up as a bottom sheet, matching the rest of the app's dialogs.
 */

/**
 * The portal + overlay + sheet on its own, so any setting that needs a dialog
 * (the schedule picker, for one) gets the same behaviour as the info popup:
 * centred on desktop, a bottom sheet on phones, Escape to close, background
 * locked while open.
 */
export function SettingSheet({ title, open, onClose, children }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="setting-info__overlay" onClick={onClose}>
      <div
        className="setting-info__sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="setting-info__head">
          <strong>{title}</strong>
          <button type="button" aria-label="Close" onClick={onClose}>×</button>
        </div>
        <div className="setting-info__body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

export default function SettingInfo({ title, children }) {
  const [open, setOpen] = useState(false);

  // Escape closes it, and the background must not scroll underneath a sheet.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="setting-info__trigger"
        aria-label={`More about ${title}`}
        title={`More about ${title}`}
        onClick={(e) => {
          // The tile itself is not clickable today, but stop this anyway so the
          // (i) never doubles as a toggle if that changes.
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
      >
        i
      </button>

      {open && createPortal(
        <div className="setting-info__overlay" onClick={() => setOpen(false)}>
          <div
            className="setting-info__sheet"
            role="dialog"
            aria-modal="true"
            aria-label={title}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="setting-info__head">
              <strong>{title}</strong>
              <button type="button" aria-label="Close" onClick={() => setOpen(false)}>×</button>
            </div>
            <div className="setting-info__body">{children}</div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
