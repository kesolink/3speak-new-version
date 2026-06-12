import { useEmbedUpload } from '../../context/EmbedUploadContext';
import './EmbedUploadProgressBar.scss';

/**
 * Thin progress bar for the background video upload that starts on the
 * "Add details" step. Sits between the step header and the step content.
 * Hidden once the final publish flow takes over (it has its own status UI),
 * and for prefilled flows (nothing to upload).
 */
export default function EmbedUploadProgressBar() {
  const { videoUploadStatus, uploadProgress, uploading, prefilled } = useEmbedUpload();

  if (prefilled || uploading) return null;
  if (videoUploadStatus === 'idle') return null;

  const pct = videoUploadStatus === 'done' ? 100 : Math.max(0, Math.min(100, uploadProgress || 0));

  const label =
    videoUploadStatus === 'done'
      ? 'Video uploaded — finish your details to publish.'
      : videoUploadStatus === 'error'
        ? 'Background upload didn’t finish — it will retry when you publish.'
        : `Uploading your video… ${pct}%`;

  return (
    <div className={`embed-upload-progress embed-upload-progress--${videoUploadStatus}`}>
      <div className="embed-upload-progress-track">
        <div className="embed-upload-progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="embed-upload-progress-label">{label}</span>
    </div>
  );
}
