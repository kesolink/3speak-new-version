import { createContext, useContext, useRef, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAppStore } from "../lib/store";
import { toast } from 'sonner'
import * as tus from "tus-js-client";
import axios from "axios";
import { UPLOAD_TOKEN, UPLOAD_URL } from "../utils/config";
import { getTusUploadOptions } from "../utils/tusConfig";

const LegacyUploadContext = createContext();

export function LegacyUploadProvider({ children }) {

    const initialState = {
    title: "",
    description: "",
    tagsInputValue: "",
    tagsPreview: [],
    community: "hive-181335",
    beneficiaries: "[]",
    declineRewards: false,
    rewardPowerup: false,
    communitiesData: [],
    prevVideoUrl: null,
    prevVideoFile: null,
    uploadURL: "",
    videoId: "",
    permlink: "",
    videoFile: null,
    videoDuration: 0,
    thumbnailFile: null,
    generatedThumbnail: [],
    loading: false,
    BeneficiaryList: 2,
    list: [],
    remaingPercent: 89,
    step: 1,
    selectedIndex: null,
    isOpenAuth: false,
    isOpen: false,
    uploadId: null,
    benficaryOpen: false,
    selectedThumbnail: "",
    uploadVideoProgress: 0,
    uploadThumbnailProgress: 0,
    uploadStatus: false,
    hasBackgroundJob: false,
    error: "",
    // NEW AUTO-SUBMIT STATES
    userWantsToSubmit: false,
    isSubmitting: false,

    // SCHEDULING STATES
    isScheduled: false,
    scheduleDateTime: '',

    // State for VideoUploadStatus
      uploading: false,
      completed: false,
      statusText: "Preparing…",
      statusMessages: [],

      encodingIntervalRef: null,

      isUploadLocked: false,



  };
  const { updateProcessing, user, authenticated } = useAppStore();
  const studioEndPoint = "https://studio.3speak.tv";
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tagsInputValue, setTagsInputValue] = useState("");
  const [tagsPreview, setTagsPreview] = useState([]);
  const [community, setCommunity] = useState("hive-181335");
  const [beneficiaries, setBeneficiaries] = useState("[]");
  const [declineRewards, SetDeclineRewards] = useState(false);
  const [rewardPowerup, setRewardPowerup] = useState(false);
  const [communitiesData, setCommunitiesData] = useState([]);
  const [prevVideoUrl, setPrevVideoUrl] = useState(null);
  const [prevVideoFile, setPrevVideoFile] = useState(null);
  const [permlink, setPermlink] = useState("")
  const [uploadURL, setUploadURL] = useState("");
  const [videoId, setVideoId] = useState("");
  const [videoFile, setVideoFile] = useState(null);
  const [videoDuration, setVideoDuration] = useState(0);
  const username = localStorage.getItem("user_id");
  const accessToken = localStorage.getItem("access_token");
  const [thumbnailFile, setThumbnailFile] = useState(null);
  const [generatedThumbnail, setGeneratedThumbnail] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [BeneficiaryList, setBeneficiaryList] = useState(2);
  const [list, setList] = useState([]);
  const [remaingPercent, setRemaingPercent] = useState(89);
  const [step, setStep] = useState(1);
  const [isOpenAuth, setIsOpenAuth] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [uploadId, setUploadId] = useState(null)
  const [benficaryOpen, setBeneficiaryOpen] = useState(false);
  const [selectedThumbnail, setSelectedThumbnail] = useState("");
  const [uploadVideoProgress, setUploadVideoProgress] = useState(0);
  const [uploadThumbnailProgress, setUploadThumbnailProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [error, setError] = useState("");
  const [isUploadLocked, setIsUploadLocked] = useState(false)
  const [hasBackgroundJob, setHasBackgroundJob] = useState(false);



  const [uploading, setUploading] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [statusText, setStatusText] = useState("Preparing…");
  const [statusMessages, setStatusMessages] = useState([]);

  // Polling ref
  const encodingIntervalRef = useRef(null);
  const uploadURLRef = useRef("");
  const uploadStatusRef = useRef(uploadStatus);

  // ============================================
  // NEW: AUTO-SUBMIT STATES
  // ============================================
  const [userWantsToSubmit, setUserWantsToSubmit] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const autoCheckIntervalRef = useRef(null);

  // ============================================
  // SCHEDULING STATES
  // ============================================
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduleDateTime, setScheduleDateTime] = useState('');


  // Keep ref updated on every uploadStatus change
  useEffect(() => {
    uploadStatusRef.current = uploadStatus;
  }, [uploadStatus]);

    const addMessage = (msg, type = "info") => {
    setStatusMessages((prev) => [
      ...prev,
      {
        time: new Date().toLocaleTimeString(),
        message: msg,
        type,
      },
    ]);
  };

  // Helper to clear error messages from the status log
  const clearErrorMessages = () => {
    setStatusMessages(prev => prev.filter(msg => msg.type !== 'error'));
  };

  const startEncodingPolling = (vid) => {
  setStatusText("Processing video…");
  addMessage("Waiting for encoding to start…");

  let lastEncodingProgress = 0; // Track last progress to avoid duplicate messages
  let hasStartedEncoding = false; // Track if encoding has started
  let consecutiveErrors = 0; // Track consecutive polling failures
  const MAX_CONSECUTIVE_ERRORS = 3; // Only show error after 3 consecutive failures
  let hasShownError = false; // Track if we've shown an error to the user

  encodingIntervalRef.current = setInterval(async () => {
    try {
      const statusResp = await axios.get(
        `${UPLOAD_URL}/api/upload/video/${vid}/status`,
        {
          headers: { Authorization: `Bearer ${UPLOAD_TOKEN}` },
          timeout: 10000, // 10 second timeout
        }
      );

      const data = statusResp.data.data.video;

      console.log(data)

      // Reset error counter on successful poll
      if (consecutiveErrors > 0) {
        console.log(`✅ Polling recovered after ${consecutiveErrors} error(s)`);
        consecutiveErrors = 0;
        
        // If we previously showed an error, show recovery message and clear errors
        if (hasShownError) {
          clearErrorMessages();
          addMessage("✅ Connection restored", "success");
          hasShownError = false;
        }
      }

      // ENCODING
      if (data.status === "encoding") {
        const encodingPct = data.encodingProgress || 0;
        
        // Show message when encoding starts
        if (!hasStartedEncoding) {
          addMessage("🎬 Video encoding has started!", "info");
          hasStartedEncoding = true;
        }
        
        // Update progress only if it changed by at least 5% (to avoid spam)
        if (encodingPct - lastEncodingProgress >= 5) {
          addMessage(`⚙️ Encoding progress: ${encodingPct}%`, "info");
          lastEncodingProgress = encodingPct;
        }
        
        setStatusText(`Encoding video… (${encodingPct}%)`);
      }

      // PUBLISHING
      if (data.status === "publishing") {
        if (hasStartedEncoding) {
          addMessage("✅ Encoding completed (100%)", "success");
          hasStartedEncoding = false; // Reset for next stage
        }
        setStatusText("Publishing to blockchain…");
        addMessage("📡 Publishing video to blockchain…", "info");

      }

      // PUBLISHED
      if (data.status === "published") {
        clearInterval(encodingIntervalRef.current);
        setStatusText("Completed");
        resetUploadState();
        // setCompleted(true);
        // setUploading(false);
        setIsSubmitting(false); // NEW: Mark as no longer submitting
        addMessage("🎉 Video successfully published!", "success");
      }

      // FAILED
      if (data.status === "failed") {
        clearInterval(encodingIntervalRef.current);
        setUploading(false);
        setIsSubmitting(false); // NEW: Mark as no longer submitting
        addMessage("❌ Video processing failed", "error");
        toast.error("Video processing failed");
      }
    } catch (err) {
      consecutiveErrors++;
      console.warn(`Polling error (attempt ${consecutiveErrors}/${MAX_CONSECUTIVE_ERRORS}):`, err.message);
      
      // Only show error to user after multiple consecutive failures
      if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS && !hasShownError) {
        addMessage("⚠️ Connection unstable - still trying…", "warning");
        setStatusText("Connection issue - retrying…");
        hasShownError = true;
      }
      
      // Don't stop polling - let it keep trying
      // The video is likely still processing fine on the backend
    }
  }, 5000); // Poll every 5 seconds
};

  // ============================================
  // UPLOAD VIDEO TO 3SPEAK (MOVED FROM PREVIEW)
  // ============================================
  const uploadVideoTo3Speak = async () => {
    if (!title || !description || !tagsPreview) {
      toast.error("Please fill in all fields: Title, Description and Tags!");
      return;
    }

    // Stop auto-check interval (if running)
    stopAutoCheck();

    // Mark as submitting
    setIsSubmitting(true);
    setHasBackgroundJob(true)

    try {
      let parsedBeneficiaries = beneficiaries;
      if (typeof beneficiaries === 'string') {
        try {
          parsedBeneficiaries = JSON.parse(beneficiaries);
        } catch (e) {
          parsedBeneficiaries = [];
        }
      }

      const raw = {
        upload_id: uploadId,
        owner: username,
        title: title,
        description,
        tags: tagsPreview,
        size: videoFile.size,
        duration: videoDuration,
        originalFilename: videoFile.name,
        community,
        declineRewards,
        rewardPowerup,
        beneficiaries: parsedBeneficiaries,
      }
      
      console.log('Finalizing upload with:', raw);

      const res = await axios.post(
        `${UPLOAD_URL}/api/upload/finalize`,
        raw,
        {
          headers: {
            Authorization: `Bearer ${UPLOAD_TOKEN}`,
            "Content-Type": "application/json",
          },
        }
      );

      const result = res.data;

      if (!result.success) {
        throw new Error(result.error || "Finalize upload failed");
      }

      const vid = result.data.video_id;
      const perm = result.data.permlink;

      setVideoId(vid);
      setPermlink(perm);

      console.log('✔ Upload finalized successfully');

      // Upload thumbnail if exists
      if (thumbnailFile) {
        try {
          const formDataObj = new FormData();
          formDataObj.append("thumbnail", thumbnailFile);

          await axios.post(
            `${UPLOAD_URL}/api/upload/thumbnail/${vid}`,
            formDataObj,
            {
              headers: {
                Authorization: `Bearer ${UPLOAD_TOKEN}`,
              },
            }
          );
          console.log('✔ Thumbnail uploaded successfully');
        } catch (err) {
          console.warn("Thumbnail upload failed:", err);
        }
      }




      startEncodingPolling (vid)
      // resetUploadState();



      // toast.success("Video posted successfully!");
      
      // // Navigate to preview to show encoding status
      // navigate('/studio/preview');

    } catch (err) {
      console.error("Upload error:", err);
      toast.error("Upload failed: " + err.message);
      setIsSubmitting(false);
    }
  };

  // ============================================
  // AUTO-CHECK FUNCTION (checks every 5 seconds)
  // ============================================
  const startAutoCheck = () => {
    // Clear existing interval
    if (autoCheckIntervalRef.current) {
      clearInterval(autoCheckIntervalRef.current);
    }

    console.log("⏰ Starting auto-check interval (every 5 seconds)...");

    autoCheckIntervalRef.current = setInterval(() => {
      const latestStatus = uploadStatusRef.current;

      console.log("🔍 Auto-checking upload status...", {
        uploadStatus: latestStatus,
        userWantsToSubmit,
        uploadId,
      });

      // Detect upload completion
      if (latestStatus === true) {
        console.log("✅ Upload complete! Calling uploadVideoTo3Speak directly...");
        stopAutoCheck();
        uploadVideoTo3Speak();
      }
    }, 5000);
  };


  const stopAutoCheck = () => {
    if (autoCheckIntervalRef.current) {
      clearInterval(autoCheckIntervalRef.current);
      autoCheckIntervalRef.current = null;
      console.log('⏸️ Auto-check stopped');
    }
  };

  // ============================================
  // SAVE BUTTON HANDLER
  // ============================================
  const onSaveClicked = () => {
    if (!uploadId) {
      console.error('No upload in progress');
      return;
    }

    console.log('💾 User clicked Save!');
    setUserWantsToSubmit(true);

    // If upload already complete, call uploadVideoTo3Speak immediately
    if (uploadStatus) {
      console.log('✅ Upload already complete - posting immediately');
      uploadVideoTo3Speak();
    } else {
      console.log('⏳ Upload not complete - starting auto-check');
      startAutoCheck();
    }
  };

  // ============================================
  // GET SAVE BUTTON TEXT
  // ============================================
  const getSaveButtonText = () => {
    if (!uploadId) return 'Select a video first';
    if (isSubmitting) return 'Posting...';
    if (userWantsToSubmit && !uploadStatus) {
      return `Waiting for upload... ${Math.round(uploadVideoProgress)}%`;
    }
    if (uploadStatus) return 'Proceed';
    return 'Save';
  };

  // ============================================
  // CAN USER SAVE?
  // ============================================
  const canSave = uploadId !== null && !isSubmitting;

  // ============================================
  // IS WAITING FOR UPLOAD?
  // ============================================
  const isWaitingForUpload = userWantsToSubmit && !uploadStatus;


  // Inside LegacyUploadProvider
const startTusUpload = async (file) => {
  if (!file) return;

  try {
    setLoading(true);

    // 1️⃣ Calculate duration
    const duration = await new Promise((resolve) => {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.onloadedmetadata = () => {
        window.URL.revokeObjectURL(video.src);
        resolve(video.duration);
      };
      video.src = URL.createObjectURL(file);
    });
    setVideoDuration(duration);

    // 2️⃣ Init upload
    const initRes = await fetch(`${UPLOAD_URL}/api/upload/init`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${UPLOAD_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        owner: username,
        originalFilename: file.name,
        size: file.size,
        duration: Math.round(duration),
      }),
    });

    const result = await initRes.json();
    if (!result.success) throw new Error(result.error || "Upload init failed");

    const upload_id = result.data.upload_id;
    let tus_endpoint = result.data.tus_endpoint;

    // If UPLOAD_URL is a proxy path (starts with /), rewrite the absolute TUS
    // endpoint to go through the same proxy to avoid CORS issues.
    if (UPLOAD_URL.startsWith('/') && tus_endpoint.startsWith('http')) {
      try {
        const parsed = new URL(tus_endpoint);
        tus_endpoint = UPLOAD_URL + parsed.pathname;
      } catch { /* keep original if URL parsing fails */ }
    }

    setUploadId(upload_id);

    // 3️⃣ Start TUS upload with optimized settings for high-bandwidth server
    const upload = new tus.Upload(file, {
      endpoint: tus_endpoint,
      ...getTusUploadOptions(),
      metadata: {
        upload_id,
        owner: username,
        filename: file.name,
        filetype: file.type,
      },
      onError: (err) => {
        console.error("TUS upload error:", err);
        setError(err.message);
        toast.error("Upload failed!");
      },
      onProgress: (bytesUploaded, bytesTotal) => {
        const percent = ((bytesUploaded / bytesTotal) * 100).toFixed(2);
        setUploadVideoProgress(Number(percent));
      },
      onSuccess: async () => {
        console.log("✅ Upload complete!");
        toast.success("Video upload completed!");
        setUploadStatus(true);
      },
    });

    upload.start();

    // Keep the upload object in state so it survives navigation
    setVideoFile(file);
    setPrevVideoFile(file);

    return upload; // optional: for pause/resume later

  } catch (err) {
    console.error(err);
    setError(err.message);
    toast.error(err.message || "Upload failed");
  } finally {
    setLoading(false);
  }
};


  // ============================================
  // CLEANUP ON UNMOUNT
  // ============================================
  useEffect(() => {
    return () => {
      stopAutoCheck();
    };
  }, []);

   // 🔑 Reset all fields
  const resetUploadState = () => {
    // Stop auto-check
    stopAutoCheck();

    // Reset all states
    setTitle(initialState.title);
    setDescription(initialState.description);
    setTagsInputValue(initialState.tagsInputValue);
    setTagsPreview(initialState.tagsPreview);
    setCommunity(initialState.community);
    setBeneficiaries(initialState.beneficiaries);
    SetDeclineRewards(initialState.declineRewards);
    setRewardPowerup(initialState.rewardPowerup);
    setCommunitiesData(initialState.communitiesData);
    setPrevVideoUrl(initialState.prevVideoUrl);
    setPrevVideoFile(initialState.prevVideoFile);
    setUploadURL(initialState.uploadURL);
    setVideoId(initialState.videoId);
    setVideoFile(initialState.videoFile);
    setPermlink(initialState.permlink)
    setVideoDuration(initialState.videoDuration);
    setThumbnailFile(initialState.thumbnailFile);
    setGeneratedThumbnail(initialState.generatedThumbnail);
    setLoading(initialState.loading);
    setBeneficiaryList(initialState.BeneficiaryList);
    setList(initialState.list);
    setRemaingPercent(initialState.remaingPercent);
    setStep(initialState.step);
    setHasBackgroundJob(initialState.hasBackgroundJob);
    setIsOpenAuth(initialState.isOpenAuth);
    setIsOpen(initialState.isOpen);
    setUploadId(initialState.uploadId)
    setBeneficiaryOpen(initialState.benficaryOpen);
    setSelectedThumbnail(initialState.selectedThumbnail)
    setUploadVideoProgress(initialState.uploadVideoProgress);
    setUploadThumbnailProgress(initialState.uploadThumbnailProgress);
    setUploadStatus(initialState.uploadStatus);
    setSelectedIndex(initialState.selectedIndex);
    setError(initialState.error);

    // Reset auto-submit states
    setUserWantsToSubmit(initialState.userWantsToSubmit);
    setIsSubmitting(initialState.isSubmitting);


    setCompleted(initialState.completed);
    setStatusText(initialState.statusText);
    setStatusMessages(initialState.statusMessages);

    // FIX: reset the ref correctly
    encodingIntervalRef.current = initialState.encodingIntervalRef; // or null

    setIsUploadLocked(initialState.isUploadLocked)

  };
 

  return <LegacyUploadContext.Provider value={{
        // store
        updateProcessing,
        user,
        authenticated,
        studioEndPoint,
        username,
        accessToken,

        // video info
        title, setTitle,
        description, setDescription,
        tagsInputValue, setTagsInputValue,
        tagsPreview, setTagsPreview,
        community, setCommunity,
        beneficiaries, setBeneficiaries,
        declineRewards, SetDeclineRewards,
        rewardPowerup, setRewardPowerup,
        communitiesData, setCommunitiesData,


        // video files
        prevVideoUrl, setPrevVideoUrl,
        prevVideoFile, setPrevVideoFile,
        uploadURL, setUploadURL,
        videoId, setVideoId,
        videoFile, setVideoFile,
        uploadId, setUploadId,
        permlink, setPermlink,
        videoDuration, setVideoDuration,
        thumbnailFile, setThumbnailFile,
        generatedThumbnail, setGeneratedThumbnail,
        selectedThumbnail, setSelectedThumbnail,
        selectedIndex, setSelectedIndex,

        // states
        loading, setLoading,
        hasBackgroundJob, setHasBackgroundJob,
        navigate,
        BeneficiaryList, setBeneficiaryList,
        list, setList,
        remaingPercent, setRemaingPercent,
        step, setStep,
        isOpenAuth, setIsOpenAuth,
        isOpen, setIsOpen,
        benficaryOpen, setBeneficiaryOpen,
        uploadVideoProgress, setUploadVideoProgress,
        uploadThumbnailProgress, setUploadThumbnailProgress,
        uploadStatus, setUploadStatus,
        error, setError,
        uploadURLRef,
        resetUploadState,

        // NEW: Auto-submit functions
        userWantsToSubmit,
        setUserWantsToSubmit,
        isSubmitting,
        setIsSubmitting,
        onSaveClicked,
        getSaveButtonText,
        canSave,
        isWaitingForUpload,
        startAutoCheck,
        stopAutoCheck,

        // Scheduling states
        isScheduled, setIsScheduled,
        scheduleDateTime, setScheduleDateTime,

        startTusUpload,
        uploadVideoTo3Speak,


        // State for ===> VideoUploadStatus
        uploading, setUploading,
        completed, setCompleted,
        statusText, setStatusText,
        statusMessages, setStatusMessages,
        encodingIntervalRef,

        isUploadLocked, setIsUploadLocked
       
      }}>
         {children}
       </LegacyUploadContext.Provider>;
}

// export default LegacyUploadContext;
export const useLegacyUpload = () => useContext(LegacyUploadContext);