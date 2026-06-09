import { useEffect, useState } from "react";
import { FileVideo } from "lucide-react";

 const VideoPreview = ({ file }) => {
  const [objectUrl, setObjectUrl] = useState(null);
  const [previewError, setPreviewError] = useState(false);

  useEffect(() => {
    if (file) {
      setPreviewError(false);
      const url = URL.createObjectURL(file);
      setObjectUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [file]);

  if (!objectUrl) return null;

  // Browsers can't decode some codecs (e.g. HEVC/H.265 from iPhones) for an
  // inline preview, even though the file uploads and is transcoded fine.
  if (previewError) {
    return (
      <div className="video-preview-fallback" style={{ marginTop: "1rem" }}>
        <FileVideo className="video-preview-fallback-icon" />
        <p>
          Your browser can't preview this video — this is common for HEVC/H.265
          clips (e.g. iPhone “High Efficiency” recordings). That's fine: it will
          still upload and be converted so it plays for everyone.
        </p>
      </div>
    );
  }

  return (
    <video
      src={objectUrl}
      controls
      width="100%"
      style={{ marginTop: "1rem", borderRadius: "10px" }}
      onError={() => setPreviewError(true)}
    />
  );
};

export default VideoPreview
