import React from "react";
import "../legacy-studio/Preview.scss";
import { Navigate, useNavigate } from "react-router-dom";
import { CheckCircle, Upload, FileText, Info } from "lucide-react";
import VideoPreview from "../studio/VideoPreview";
import { StepProgress } from "../legacy-studio/StepProgress";
import { useEmbedUpload } from "../../context/EmbedUploadContext";
import "../legacy-studio/VideoUploadStatus.scss";
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
    fromStories,
  } = useEmbedUpload();

  const navigate = useNavigate();

  if (!description || (!fromStories && !title)) {
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
            <h1>{fromStories ? "Share a Short" : "Share a Video"}</h1>
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
                      className={`preview-thumbnail${fromStories ? ' preview-thumbnail--portrait' : ''}`}
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
                  {fromStories ? 'Post Short' : 'Post Video'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STATUS CONTAINER — during upload & Hive posting */}
      {uploading && (
        <div className="status-container">
          <div className="upload-status-container embed-status">
            <div className="upload-icon">
              <Upload size={30} strokeWidth={1.5} />
            </div>

            <h2 className="upload-title">
              {fromStories ? 'Publishing Short' : 'Publishing Video'}
            </h2>
            <p className="upload-subtitle">Please wait while we process your content...</p>

            <div className="progress-section">
              <div className="progress-bar-container">
                <div className="progress-bar">
                  <div
                    className="progress-fill embed-fill"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
              <div className="progress-header">
                <span className="progress-label">{statusText || 'Starting...'}</span>
                <span className="progress-percentage">{uploadProgress}%</span>
              </div>
            </div>

            <div className="caution-wrap">
              Please stay on this page until publishing is finished.
            </div>

            <div className="activity-log">
              <div className="activity-log-header">
                <div className="wrapin">
                  <FileText size={18} />
                  <span>Activity Log</span>
                </div>
                <div className="discord">
                  For Support reach out to us on{" "}
                  <a href="https://discord.gg/NSFS2VGj83" target="_blank" rel="noopener noreferrer" className="discord-link">Discord</a>
                </div>
              </div>
              <div className="activity-log-content">
                {statusMessages.map((msg, i) => (
                  <div key={i} className={`activity-item ${msg.type === 'error' ? 'error' : msg.type === 'success' ? 'success' : 'info'}`}>
                    <div className="activity-icon">
                      {msg.type === 'success' ? <CheckCircle size={20} /> : <Info size={20} />}
                    </div>
                    <div className="activity-details">
                      <p className="activity-message">{msg.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
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
            <p>{fromStories ? 'Your short has been published on 3Speak.' : 'Your video has been published on 3Speak.'}</p>
            {fromStories && <p style={{ color: '#e53935' }}>It will take around 5 minutes for it to show up on your profile.</p>}
            {embedUrl && (
              <p style={{ fontSize: '0.85rem', wordBreak: 'break-all', marginTop: '0.5rem' }}>
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
