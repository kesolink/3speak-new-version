import React, { useEffect, useRef } from "react";
import { getHiveUrl } from '../../utils/hiveNode';
import "../legacy-studio/StudioPage.scss";
import { StepProgress } from "../legacy-studio/StepProgress";
import EmbedVideoUploadStep1 from "./EmbedVideoUploadStep1";
import Auth_modal from "../modal/Auth_modal";
import VerifyAuthModal from "../modal/VerifyAuthModal";
import axios from "axios";
import { has3SpeakPostAuth } from "../../utils/hiveUtils";
import 'ldrs/react/LineSpinner.css'
import { useEmbedUpload } from "../../context/EmbedUploadContext";
import { HIVE_API_URL } from "../../utils/config";
import { useNavigate, useLocation } from "react-router-dom";
import { useState } from "react";
import { generateVideoThumbnails } from "../../utils/videoThumbnails";

function EmbedStudioPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isVerifying, setIsVerifying] = useState(false);
  const [isOpenAuth, setIsOpenAuth] = useState(false);

  const {
    user,
    setCommunitiesData,
    step, setStep,
    fromStories, setFromStories,
    completed,
    resetUploadState,
    setVideoFile,
    setPrevVideoFile,
    setVideoDuration,
    setGeneratedThumbnail,
    setPrefilledFromQuery,
  } = useEmbedUpload();

  // Detect stories origin from URL param
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const from = params.get("from");
    setFromStories(from === "stories" || from === "shorts");
  }, [location.search, setFromStories]);

  // Prefilled flow: an external uploader (e.g. Hangouts server-side recording)
  // has already pushed a video to the embed service. Skip Step 1 and land the
  // user on the thumbnail step so they can finish title/description/tags.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("prefilled") !== "true") return;
    const permlink = params.get("permlink");
    const owner = params.get("owner");
    const embedUrl = params.get("embedUrl");
    if (!permlink || !embedUrl) return;
    setPrefilledFromQuery({ permlink, owner: owner || "", embedUrl });
    navigate("/embed-studio/thumbnail", { replace: true });
  }, [location.search, setPrefilledFromQuery, navigate]);

  const checkPostAuth = async (username) => {
    if (!username) return;
    const hasAuth = await has3SpeakPostAuth(username);
    if (!hasAuth) {
      setIsOpenAuth(true);
    }
  };

  // Reset all upload state when arriving fresh (previous upload completed)
  useEffect(() => {
    if (completed) {
      resetUploadState();
    } else {
      setStep(1);
    }
  }, []);

  // Pick up file shared from StudioPage (vertical short redirect) or PWA file_handlers
  const sharedFileHandled = useRef(false);
  useEffect(() => {
    if (sharedFileHandled.current) return;

    const processFile = async (file) => {
      if (!file || !file.type.startsWith('video/')) return;
      sharedFileHandled.current = true;

      const video = document.createElement('video');
      video.preload = 'metadata';
      const duration = await new Promise((resolve) => {
        video.onloadedmetadata = () => {
          URL.revokeObjectURL(video.src);
          resolve(video.duration);
        };
        video.src = URL.createObjectURL(file);
      });

      const thumbs = await generateVideoThumbnails(file, 2, 'url');
      setGeneratedThumbnail(thumbs);
      setVideoFile(file);
      setPrevVideoFile(file);
      setVideoDuration(duration);
    };

    // Check for file passed from StudioPage redirect (vertical short)
    if (window.__pwaSharedFile) {
      const file = window.__pwaSharedFile;
      delete window.__pwaSharedFile;
      processFile(file);
      return;
    }

    // Handle PWA file_handlers (editor "Open with" action)
    if ('launchQueue' in window) {
      window.launchQueue.setConsumer(async (launchParams) => {
        if (!launchParams.files?.length) return;
        const handle = launchParams.files[0];
        const file = await handle.getFile();
        processFile(file);
      });
    }
  }, []);

  useEffect(() => {
    const fetchCommunities = async () => {
      try {
        const response = await axios.post(getHiveUrl(), {
          jsonrpc: "2.0",
          method: "bridge.list_communities",
          params: { last: "", limit: 100 },
          id: 1,
        });
        setCommunitiesData(response.data.result || []);
      } catch (error) {
        console.error("Error fetching communities:", error);
      }
    };
    fetchCommunities();
  }, []);

  const handleAuthSuccess = () => {
    setIsOpenAuth(false);
  };

  const toggleUploadModalAuth = async () => {
    setIsOpenAuth(false);
    setIsVerifying(true);
    setTimeout(async () => {
      try {
        const hasAuth = await has3SpeakPostAuth(user);
        setIsVerifying(false);
        if (!hasAuth) {
          navigate('/new');
        }
      } catch (error) {
        console.error('Error checking auth:', error);
        setIsVerifying(false);
        navigate('/new');
      }
    }, 4000);
  };

  return (
    <>
      <div className="studio-main-container">
        <div className="studio-page-header">
          <h1>{fromStories ? "Share a Short" : "Share a Video"}</h1>
        </div>
        <StepProgress step={step} />
        <div className="studio-page-content">
          <EmbedVideoUploadStep1 />
        </div>
      </div>
      <VerifyAuthModal isOpen={isVerifying} />
    </>
  );
}

export default EmbedStudioPage;
