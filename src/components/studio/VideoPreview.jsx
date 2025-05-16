import { useEffect, useState } from "react";

 const VideoPreview = ({ file }) => {
  const [objectUrl, setObjectUrl] = useState(null);

  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file);
      setObjectUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [file]);

  if (!objectUrl) return null;

  return (
    <video
      src={objectUrl}
      controls
      width="100%"
      style={{ marginTop: "1rem", borderRadius: "10px" }}
    />
  );
};

export default VideoPreview