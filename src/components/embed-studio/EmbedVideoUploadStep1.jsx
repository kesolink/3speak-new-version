import React, { useRef, useState, useEffect, useMemo } from 'react'
import { Upload } from "lucide-react";
import "../legacy-studio/VideoUploadStep1.scss"
import { generateVideoThumbnails } from "@rajesh896/video-thumbnails-generator";
import { toast } from 'sonner'
import Arrow from "./../../../public/images/arrow.png"
import { useEmbedUpload } from '../../context/EmbedUploadContext';
import { useNavigate } from 'react-router-dom';
import { TailChase } from 'ldrs/react'
import 'ldrs/react/TailChase.css'

function EmbedVideoUploadStep1() {
  const {
    setVideoDuration,
    videoFile,
    setVideoFile,
    setPrevVideoFile,
    setGeneratedThumbnail,
    fromStories,
  } = useEmbedUpload()

  const [loading, setLoading] = useState(false)
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 767px)').matches)
  const navigate = useNavigate()

  useEffect(() => {
    const mql = window.matchMedia('(max-width: 767px)');
    const onChange = (e) => setIsMobile(e.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  const videoInputRef = useRef(null);
  const videoPreviewUrl = useMemo(() => videoFile ? URL.createObjectURL(videoFile) : null, [videoFile]);

  const getVideoMetadata = (file) => {
    return new Promise((resolve) => {
      const video = document.createElement("video");
      video.preload = "metadata";

      video.onloadedmetadata = () => {
        const meta = {
          duration: video.duration,
          width: video.videoWidth,
          height: video.videoHeight,
        };
        window.URL.revokeObjectURL(video.src);
        resolve(meta);
      };

      video.src = URL.createObjectURL(file);
    });
  };

  const handleVideoSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("video/")) {
      toast.error("Please select a valid video file");
      return;
    }

    // Embed uploads are capped at 5GB (enforced server-side too).
    const MAX_FILE_SIZE = 5 * 1024 * 1024 * 1024; // 5GB
    if (file.size > MAX_FILE_SIZE) {
      toast.error("Video is too large. Maximum allowed size is 5GB.");
      return;
    }

    setLoading(true);

    try {
      const { duration, width, height } = await getVideoMetadata(file);

      // Shorts: enforce max 60 seconds
      if (fromStories && duration > 60) {
        toast.error("Shorts must be 60 seconds or less. Your video is " + Math.round(duration) + "s.");
        setLoading(false);
        return;
      }

      // Shorts: reject horizontal video
      if (fromStories && width > height) {
        toast.error("Shorts must be recorded in vertical (portrait) format. Your video appears to be horizontal.");
        setLoading(false);
        return;
      }

      // Generate Thumbnails
      const thumbs = await generateVideoThumbnails(file, 2, "url");
      setGeneratedThumbnail(thumbs);

      // Store video for next step
      setVideoFile(file);
      setPrevVideoFile(file);
      setVideoDuration(duration);

    } catch (err) {
      console.error(err);
      toast.error(err.message || "Failed to process video.");
    }

    setLoading(false);
  };

  const uploadVideo = () => {
    if (!videoFile) {
      toast.error("Please select a video file first.");
      return;
    }

    navigate("/embed-studio/thumbnail");
  };

  return (
    <div>
      <div className="upload-step">

        <div className="content">
          <div className="file-upload">
            <div className="content">
              <div
                className="icon"
                onClick={() => videoInputRef.current?.click()}
                style={{ cursor: 'pointer' }}
                title="Click to select a video file"
              >
                <Upload className="w-8 h-8" />
              </div>

              {!videoFile && (
                <div className="text">
                  <h3 className="title">{isMobile ? "Pick or Record a Video" : "Choose a video file"}</h3>
                  <p className="formats">
                    Supports: MP4, AVI, MOV, WMV (Max size: 5GB)
                  </p>
                  {fromStories && (
                    <p className="formats short-hint">
                      Shorts must be under 60 seconds and recorded vertically.
                    </p>
                  )}
                </div>
              )}

              {videoFile && (
                <div className='isselected-wrap'>
                  <span>Video Selected. Proceed to upload thumbnail</span>
                  <div className="upload-info-note">
                    Info: Your video will get uploaded after finalizing the last step.
                  </div>
                  <img className="arrow-in" src={Arrow} alt="" />
                </div>
              )}

              <input
                type="file"
                accept="video/mp4, video/x-m4v, video/*, .mkv, .flv, .mov, .avi, .wmv"
                ref={videoInputRef}
                onChange={handleVideoSelect}
                className="input"
                id="embed-video-upload"
              />

              {loading ? (
                <TailChase size="30" speed="1.75" color="red" />
              ) : !videoFile ? (
                <label htmlFor="embed-video-upload" className="button">
                  {isMobile ? "Select a Video" : "Browse Files"}
                </label>
              ) : (
                <div className="button-group">
                  <label onClick={uploadVideo} className="button">
                    Proceed to Thumbnails
                  </label>
                  <label htmlFor="embed-video-upload" className="button button--outline">
                    Replace Video
                  </label>
                </div>
              )}
            </div>
          </div>
        </div>

        {videoFile && videoPreviewUrl && (
          <div className="video-preview-container">
            <video
              src={videoPreviewUrl}
              controls
              muted
              playsInline
              className="video-preview"
            />
            <p className="video-preview-name">{videoFile.name}</p>
          </div>
        )}

      </div>
    </div>
  );
}

export default EmbedVideoUploadStep1;
