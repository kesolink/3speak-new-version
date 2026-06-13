import { useEffect, useRef, useState } from 'react';
import { useEmbedUpload } from '../../context/EmbedUploadContext';
import './EmbedUploadProgressBar.scss';

/**
 * Thin progress bar for the background video upload that starts on the
 * "Add details" step. Sits between the step header and the step content,
 * matched in width to the stepper above it (centered).
 * Hidden once the final publish flow takes over (it has its own status UI),
 * and for prefilled flows (nothing to upload).
 */
export default function EmbedUploadProgressBar() {
  const { videoUploadStatus, uploadProgress, uploading, prefilled, selectedEndpoint } = useEmbedUpload();
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
        ? 'Background upload didn’t finish — it will retry when you publish.'
        : `Uploading your video… ${pct}%`;

  // Show just the hostname of the chosen upload server.
  const endpointHost = selectedEndpoint
    ? selectedEndpoint.replace(/^https?:\/\//, '').replace(/\/+$/, '')
    : '';

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
      {endpointHost && (
        <span className="embed-upload-progress-endpoint">Upload server: {endpointHost}</span>
      )}
    </div>
  );
}
