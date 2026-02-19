import React from "react";
import "../legacy-studio/Preview.scss";
import { Navigate, useNavigate } from "react-router-dom";
import { CheckCircle } from "lucide-react";
import VideoPreview from "../studio/VideoPreview";
import { StepProgress } from "../legacy-studio/StepProgress";
import { useEmbedUpload } from "../../context/EmbedUploadContext";
import VideoUploadStatus from "../legacy-studio/VideoUploadStatus";
import EditorPreview from "../Editor/EditorPreview";

function EmbedPreview() {
  const {
    step,
    title,
    description,
    tagsPreview,
    videoFile,
    prevVideoFile,
    selectedThumbnail,
    uploading, setUploading,
    completed,
    uploadProgress,
    statusText,
    statusMessages,
    embedUrl,
    publishToEmbed,
    resetUploadState,
    user,
  } = useEmbedUpload();

  const navigate = useNavigate();

  if (!description || !title) {
    return <Navigate to="/embed-studio" replace />;
  }

  const handlePostVideo = () => {
    publishToEmbed();
  };

  return (
    <>
      {/* PREVIEW & PUBLISH BUTTON */}
      {!uploading && !completed && (
        <div className="studio-main-container">
          <div className="studio-page-header">
            <h1>Upload Video</h1>
            <p>Follow the steps below to upload and publish your video</p>
          </div>

          <StepProgress step={step} />

          <div className="studio-page-content">
            <div className="preview-container">
              <div className="preview">
                <h3>Preview</h3>

                {title && (
                  <div className="preview-section">
                    <label className="preview-label">Title</label>
                    <div className="preview-title">{title}</div>
                  </div>
                )}

                <div className="preview-section">
                  <label className="preview-label">Description</label>
                  <EditorPreview content={description} />
                </div>

                {prevVideoFile && (
                  <div className="preview-section">
                    <label className="preview-label">Video Preview</label>
                    <div className="preview-video">
                      <VideoPreview file={prevVideoFile} />
                    </div>
                  </div>
                )}

                {selectedThumbnail && (
                  <div className="preview-section">
                    <label className="preview-label">Thumbnail</label>
                    <img
                      className="preview-thumbnail"
                      src={selectedThumbnail}
                      alt="Thumbnail"
                    />
                  </div>
                )}

                {tagsPreview && (
                  <div className="preview-section">
                    <label className="preview-label">Tags</label>
                    <div className="preview-tags">
                      {tagsPreview.map((tag, index) => (
                        <span className="tag-item" key={index}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="submit-btn-wrap">
                <button
                  className="edit-btn"
                  onClick={() => navigate('/embed-studio/details')}
                >
                  Edit Post
                </button>
                <button onClick={handlePostVideo}>
                  Post Video
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STATUS CONTAINER — during upload & Hive posting */}
      {uploading && (
        <div className="status-container">
          <VideoUploadStatus
            statusMessages={statusMessages}
            statusText={statusText}
          />
          {uploadProgress > 0 && uploadProgress < 100 && (
            <div className="studio-main-container" style={{ marginTop: '1rem' }}>
              <div className="progressbar-container">
                <div className="content-wrap">
                  <div className="wrap">
                    <div className="wrap-top"><h3>Uploading Video</h3> <div>{uploadProgress}%</div></div>
                    <div className="progress-bars">
                      <div className="progress-bar-fill" style={{ width: `${uploadProgress}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* COMPLETED */}
      {completed && (
        <div className="success-container">
          <div className="success-box">
            <div className="success-icon">
              <CheckCircle size={34} strokeWidth={2} />
            </div>
            <h3>Upload Finished!</h3>
            <p>Your video has been published on 3Speak.</p>
            {embedUrl && (
              <p style={{ fontSize: '0.85rem', color: '#666', wordBreak: 'break-all', marginTop: '0.5rem' }}>
                Embed URL: {embedUrl}
              </p>
            )}
            <button
              onClick={() => {
                navigate("/profile");
                setTimeout(() => {
                  resetUploadState();
                }, 50);
              }}
              className="profile-btn"
            >
              Go To My Profile →
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default EmbedPreview;
