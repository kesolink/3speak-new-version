import { useEffect, useRef, useState } from 'react';
import { Ring2 } from 'ldrs/react';
import 'ldrs/react/Ring2.css';
import { useEmbedUpload } from '../../context/EmbedUploadContext';
import './EmbedUploadProgressBar.scss';

// Compact byte formatter for the diagnostics line — one decimal under 10 units so
// a slow trickle still visibly moves (9.4 MB → 9.6 MB), whole numbers above.
function fmtBytes(n) {
  if (!Number.isFinite(n) || n < 0) return '—';
  if (n < 1024) return `${n} B`;
  const units = ['KB', 'MB', 'GB'];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i += 1; }
  return `${v < 10 ? v.toFixed(1) : Math.round(v)} ${units[i]}`;
}

/**
 * Thin progress bar for the background video upload that starts on the
 * "Add details" step. Sits between the step header and the step content,
 * matched in width to the stepper above it (centered).
 * Hidden once the final publish flow takes over (it has its own status UI),
 * and for prefilled flows (nothing to upload).
 */
export default function EmbedUploadProgressBar() {
  const {
    videoUploadStatus, uploadProgress, uploading, prefilled, selectedEndpoint,
    statusText, uploadDetail,
  } = useEmbedUpload();
  const rootRef = useRef(null);
  const [matchWidth, setMatchWidth] = useState(null);

  // Match the bar's width to the stepper's visible step row (first step's left
  // edge → last step's right edge), so it isn't full-width. Re-measures on layout
  // changes (resize / responsive breakpoint).
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    const container = root.closest('.studio-main-container')?.querySelector('.step-progress__container');
    if (!container) return undefined;
    const measure = () => {
      const steps = container.querySelectorAll('.step-progress__step');
      if (!steps.length) return;
      const first = steps[0].getBoundingClientRect();
      const last = steps[steps.length - 1].getBoundingClientRect();
      const w = Math.round(last.right - first.left);
      if (w > 0) setMatchWidth(w);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(container);
    return () => ro.disconnect();
  }, [videoUploadStatus]);

  if (prefilled || uploading) return null;
  if (videoUploadStatus === 'idle') return null;

  const pct = videoUploadStatus === 'done' ? 100 : Math.max(0, Math.min(100, uploadProgress || 0));

  const label =
    videoUploadStatus === 'done'
      ? 'Video uploaded — finish your details to publish.'
      : videoUploadStatus === 'error'
        ? (statusText || 'Background upload didn’t finish — it will retry when you publish.')
        : `Uploading your video… ${pct}%`;

  // Show just the hostname of the chosen upload server.
  const endpointHost = selectedEndpoint
    ? selectedEndpoint.replace(/^https?:\/\//, '').replace(/\/+$/, '')
    : '';

  // A percentage alone cannot tell "slow" from "wedged" — the exact confusion an
  // upload stuck at 0% causes. This line says which method is in play, which step
  // it is on, and whether bytes are actually moving, so a stall is legible.
  const d = uploadDetail || {};
  const bits = [];
  if (d.method) bits.push(d.method === 'reliable' ? 'Reliable upload' : 'Resumable upload');
  if (d.phase) bits.push(d.phase);
  if (d.attempts > 1 && d.attempt) bits.push(`attempt ${d.attempt}/${d.attempts}`);
  if (Number.isFinite(d.sent) && Number.isFinite(d.total) && d.total > 0) {
    // "sent" is bytes pushed into the socket; "confirmed" is what the server
    // acknowledged. A proxy that swallows uploads makes those two diverge, so
    // show both whenever they disagree.
    bits.push(
      Number.isFinite(d.acked) && d.acked !== d.sent
        ? `${fmtBytes(d.sent)} sent · ${fmtBytes(d.acked)} confirmed of ${fmtBytes(d.total)}`
        : `${fmtBytes(d.sent)} of ${fmtBytes(d.total)}`,
    );
  }
  if (Number.isFinite(d.chunksTotal) && d.chunksTotal > 0) {
    bits.push(`chunk ${d.chunksDone ?? 0}/${d.chunksTotal}`);
  }
  const detailLine = bits.join(' · ');
  const showWaiting = d.waitingOn && videoUploadStatus !== 'done';

  // Spin only while we are ATTEMPTING something with nothing to show for it yet:
  // an outstanding request (waitingOn), or an upload that has not moved a byte.
  // Once bytes flow the bar itself conveys motion, and a spinner next to a
  // climbing percentage is just noise.
  const isWaiting =
    videoUploadStatus !== 'done' &&
    videoUploadStatus !== 'error' &&
    (!!d.waitingOn || pct === 0);

  return (
    <div
      ref={rootRef}
      className={`embed-upload-progress embed-upload-progress--${videoUploadStatus}`}
      style={matchWidth ? { maxWidth: `${matchWidth}px` } : undefined}
    >
      <div className="embed-upload-progress-track">
        <div className="embed-upload-progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="embed-upload-progress-label">{label}</span>
      {(detailLine || isWaiting) && (
        <div className="embed-upload-progress-detailrow">
          <span className="embed-upload-progress-detail">{detailLine}</span>
          {isWaiting && (
            <span className="embed-upload-progress-spinner" aria-hidden="true">
              <Ring2 size="14" stroke="2" strokeLength="0.25" bgOpacity="0.1" speed="0.9" color="currentColor" />
            </span>
          )}
        </div>
      )}
      {showWaiting && (
        <span className="embed-upload-progress-waiting">Waiting on: {d.waitingOn}</span>
      )}
      {endpointHost && (
        <span className="embed-upload-progress-endpoint">Upload server: {endpointHost}</span>
      )}
    </div>
  );
}
