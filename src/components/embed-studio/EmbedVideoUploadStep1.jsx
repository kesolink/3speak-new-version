import React, { useRef, useState } from 'react'
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
  } = useEmbedUpload()

  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const videoInputRef = useRef(null);

  const calculateVideoDuration = (file) => {
    return new Promise((resolve) => {
      const video = document.createElement("video");
      video.preload = "metadata";

      video.onloadedmetadata = () => {
        window.URL.revokeObjectURL(video.src);
        resolve(video.duration);
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

    setLoading(true);

    try {
      // Calculate duration
      const duration = await calculateVideoDuration(file);

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
                  <h3 className="title">Choose a video file</h3>
                  <p className="formats">
                    Supports: MP4, AVI, MOV, WMV (Max size: 5GB)
                  </p>
                </div>
              )}

              {videoFile && (
                <div className='isselected-wrap'>
                  <span>Video Selected. Proceed to upload thumbnail</span>
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
                  Browse Files
                </label>
              ) : (
                <label onClick={uploadVideo} className="button">
                  Proceed to Thumbnails
                </label>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

export default EmbedVideoUploadStep1;
