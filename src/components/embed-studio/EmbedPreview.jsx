import React from "react";
import "../legacy-studio/Preview.scss";
import "./EmbedPreview.scss";
import { Navigate, useNavigate } from "react-router-dom";
import { CheckCircle, Upload, FileText, Info, Users, Coins, Gift, Repeat2, Tag, ShieldAlert } from "lucide-react";
import { StepProgress } from "../legacy-studio/StepProgress";
import EmbedUploadProgressBar from "./EmbedUploadProgressBar";
import { useEmbedUpload } from "../../context/EmbedUploadContext";
import "../legacy-studio/VideoUploadStatus.scss";
import BlogContent from "../playVideo/BlogContent";
import EmbedPreviewPlayer from "./EmbedPreviewPlayer";
import PromoteModal from "../Promote/PromoteModal";
import { Rocket } from "lucide-react";

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
    community,
    beneficiaries,
    declineRewards,
    rewardPowerup,
    reusable,
    originalAuthor,
    originalPermlink,
    isNsfw,
    publishedPermlink,
  } = useEmbedUpload();

  const navigate = useNavigate();
  const [promoteOpen, setPromoteOpen] = React.useState(false);

  if (!description || (!fromStories && !title)) {
    return <Navigate to="/embed-studio" replace />;
  }

  // --- Derived display values for the publish-settings panel ---
  const isDefaultCommunity = !community || community === "hive-181335";
  const communityDisplay = isDefaultCommunity
    ? { name: "hive-181335", title: "Threespeak" }
    : { name: community.name, title: community.title || community.name };

  const payoutLabel = declineRewards
    ? "Declined (rewards burned)"
    : rewardPowerup
      ? "100% Hive Power"
      : "50% HBD / 50% HP";

  const isRemix = !!(originalAuthor && originalPermlink);
  const remixLabel = isRemix ? "On (this is a remix)" : reusable ? "Allowed" : "Not allowed";

  // The body the viewer will actually read = description (+ remix credit). The
  // published body also prepends the embed URL and appends a "Watch on 3Speak"
  // footer, but BlogContent strips both on render — so rendering this through the
  // same BlogContent the watch page uses gives a faithful preview. The player is
  // shown separately above, standing in for that leading embed URL.
  const previewBody = isRemix
    ? `${description}\n\n---\n*Based on a video by [@${originalAuthor}](${
        fromStories
          ? `${window.location.origin}/shorts?v=${originalAuthor}/${originalPermlink}`
          : `${window.location.origin}/@${originalAuthor}/${originalPermlink}`
      })*`
    : description;

  // `beneficiaries` is an array initially but the beneficiary modal stores it as
  // a JSON string — normalise both shapes before rendering.
  let beneList = [];
  try {
    beneList = Array.isArray(beneficiaries)
      ? beneficiaries
      : beneficiaries
        ? JSON.parse(beneficiaries)
        : [];
  } catch (_) {
    beneList = [];
  }
  const userBeneficiaries = beneList.filter((b) => b && b.account);

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
          <EmbedUploadProgressBar />

          <div className="studio-page-content">
            <div className="ep-review">
              {/* POST PREVIEW — rendered like the final post: player (standing in
                  for the leading embed URL) → title → description body. */}
              <div className="ep-post">
                {title && <h2 className="ep-title">{title}</h2>}

                {/* One card wrapping the player + description so the video reads
                    as part of the post body, not a detached element. */}
                <div className="ep-post-card">
                  <EmbedPreviewPlayer
                    file={prevVideoFile}
                    poster={selectedThumbnail}
                    portrait={fromStories}
                  />

                  <div className="ep-body">
                    <BlogContent description={previewBody} alwaysExpanded />
                  </div>
                </div>
              </div>

              {/* Everything that isn't the post body, shown below it. */}
              <div className="ep-settings">
                <div className="ep-settings__head">Publish settings</div>

                <div className="ep-setting">
                  <span className="ep-setting__icon"><Users size={18} /></span>
                  <span className="ep-setting__label">Community</span>
                  <span className="ep-setting__value ep-setting__value--community">
                    <img src={`https://images.hive.blog/u/${communityDisplay.name}/avatar`} alt="" />
                    {communityDisplay.title}
                  </span>
                </div>

                <div className="ep-setting">
                  <span className="ep-setting__icon"><Coins size={18} /></span>
                  <span className="ep-setting__label">Payout</span>
                  <span className="ep-setting__value">{payoutLabel}</span>
                </div>

                <div className="ep-setting ep-setting--top">
                  <span className="ep-setting__icon"><Gift size={18} /></span>
                  <span className="ep-setting__label">Beneficiaries</span>
                  <span className="ep-setting__value">
                    {userBeneficiaries.length === 0 ? (
                      <span className="ep-muted">None</span>
                    ) : (
                      <span className="ep-benes">
                        {userBeneficiaries.map((b, i) => (
                          <span className="ep-bene" key={i}>@{b.account} · {(Number(b.weight) / 100).toFixed(0)}%</span>
                        ))}
                      </span>
                    )}
                  </span>
                </div>

                <div className="ep-setting ep-setting--top">
                  <span className="ep-setting__icon"><Tag size={18} /></span>
                  <span className="ep-setting__label">Tags</span>
                  <span className="ep-setting__value">
                    {tagsPreview && tagsPreview.length > 0 ? (
                      <span className="ep-tags">
                        {tagsPreview.map((tag, index) => (
                          <span className="ep-tag" key={index}>{tag}</span>
                        ))}
                      </span>
                    ) : <span className="ep-muted">None</span>}
                  </span>
                </div>

                <div className="ep-setting">
                  <span className="ep-setting__icon"><Repeat2 size={18} /></span>
                  <span className="ep-setting__label">Remix / clip</span>
                  <span className="ep-setting__value">{remixLabel}</span>
                </div>

                <div className="ep-setting">
                  <span className="ep-setting__icon"><ShieldAlert size={18} /></span>
                  <span className="ep-setting__label">Adult / NSFW</span>
                  <span className="ep-setting__value">
                    {isNsfw ? <span className="ep-nsfw-on">Yes</span> : <span className="ep-muted">No</span>}
                  </span>
                </div>
              </div>

              <div className="ep-actions">
                <button
                  type="button"
                  className="ep-btn ep-btn--secondary"
                  onClick={() => navigate('/embed-studio/details')}
                >
                  Edit Post
                </button>
                <button
                  type="button"
                  className="ep-btn ep-btn--primary"
                  onClick={handlePostVideo}
                >
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
            {!fromStories && publishedPermlink && (
              <button className="promote-success-btn" onClick={() => setPromoteOpen(true)}>
                <Rocket size={18} /> Promote this video
              </button>
            )}
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

      <PromoteModal
        open={promoteOpen}
        onClose={() => setPromoteOpen(false)}
        author={user}
        permlink={publishedPermlink}
        promotedUntil={null}
      />
    </>
  );
}

export default EmbedPreview;
