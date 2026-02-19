import React, { createContext, useContext, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import * as tus from 'tus-js-client';
import { toast } from 'sonner';
import { EMBED_UPLOAD_URL, EMBED_API_URL, EMBED_API_KEY } from '../utils/config';
import { commentWithAioha } from '../hive-api/aioha';
import { useAppStore } from '../lib/store';

const EmbedUploadContext = createContext(null);

export function useEmbedUpload() {
  const ctx = useContext(EmbedUploadContext);
  if (!ctx) throw new Error('useEmbedUpload must be used within EmbedUploadProvider');
  return ctx;
}

export function EmbedUploadProvider({ children }) {
  const { user } = useAppStore();
  const navigate = useNavigate();

  // Step tracking
  const [step, setStep] = useState(1);

  // Video file state
  const [videoFile, setVideoFile] = useState(null);
  const [prevVideoFile, setPrevVideoFile] = useState(null);
  const [videoDuration, setVideoDuration] = useState(0);

  // Thumbnail state
  const [generatedThumbnail, setGeneratedThumbnail] = useState([]);
  const [selectedThumbnail, setSelectedThumbnail] = useState(null);
  const [thumbnailFile, setThumbnailFile] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(null);

  // Details state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tagsInputValue, setTagsInputValue] = useState('');
  const [tagsPreview, setTagsPreview] = useState([]);
  const [community, setCommunity] = useState('hive-181335');
  const [beneficiaries, setBeneficiaries] = useState([]);
  const [declineRewards, SetDeclineRewards] = useState(false);
  const [rewardPowerup, setRewardPowerup] = useState(false);
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduleDateTime, setScheduleDateTime] = useState('');

  // Community data
  const [communitiesData, setCommunitiesData] = useState([]);

  // Modal state
  const [isOpen, setIsOpen] = useState(false);
  const [benficaryOpen, setBeneficiaryOpen] = useState(false);
  const [BeneficiaryList, setBeneficiaryList] = useState([]);
  const [list, setList] = useState([]);
  const [remaingPercent, setRemaingPercent] = useState(100);

  // Original video attribution (for remix/clip)
  const [originalAuthor, setOriginalAuthor] = useState(null);
  const [originalPermlink, setOriginalPermlink] = useState(null);

  // Publish state
  const [uploading, setUploading] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [statusMessages, setStatusMessages] = useState([]);
  const [embedUrl, setEmbedUrl] = useState('');

  const tusUploadRef = useRef(null);

  const addMessage = (msg, type = 'info') => {
    setStatusMessages(prev => [...prev, {
      time: new Date().toLocaleTimeString(),
      message: msg,
      type,
    }]);
  };

  const resetUploadState = () => {
    setStep(1);
    setVideoFile(null);
    setPrevVideoFile(null);
    setVideoDuration(0);
    setGeneratedThumbnail([]);
    setSelectedThumbnail(null);
    setThumbnailFile(null);
    setSelectedIndex(null);
    setTitle('');
    setDescription('');
    setTagsInputValue('');
    setTagsPreview([]);
    setCommunity('hive-181335');
    setBeneficiaries([]);
    SetDeclineRewards(false);
    setRewardPowerup(false);
    setIsScheduled(false);
    setScheduleDateTime('');
    setOriginalAuthor(null);
    setOriginalPermlink(null);
    setUploading(false);
    setCompleted(false);
    setUploadProgress(0);
    setStatusText('');
    setStatusMessages([]);
    setEmbedUrl('');
    setBeneficiaryList([]);
    setList([]);
    setRemaingPercent(100);
  };

  /**
   * publishToEmbed — the 3-step publish:
   * 1. TUS upload to embed service
   * 2. Post to Hive via aioha
   * 3. Link embed video to Hive post
   */
  const publishToEmbed = async () => {
    if (!videoFile || !user) {
      toast.error('No video file or user not logged in');
      return;
    }
    if (!title?.trim()) {
      toast.error('Title is required');
      return;
    }
    if (!description?.trim()) {
      toast.error('Description is required');
      return;
    }
    if (!tagsPreview || tagsPreview.length === 0) {
      toast.error('Please add at least one tag');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setStatusText('Uploading video...');
    addMessage('Starting video upload...');

    try {
      // ─── Step 1: TUS upload to embed service ───
      let capturedEmbedUrl = '';

      await new Promise((resolve, reject) => {
        const upload = new tus.Upload(videoFile, {
          endpoint: EMBED_UPLOAD_URL,
          chunkSize: 5 * 1024 * 1024,
          retryDelays: [0, 2000, 5000, 10000],
          headers: {
            ...(EMBED_API_KEY ? { 'X-API-Key': EMBED_API_KEY } : {}),
          },
          metadata: {
            filename: videoFile.name,
            filetype: videoFile.type,
            frontend_app: '3speak-tv',
            owner: user,
            short: 'false',
            duration: String(Math.round(videoDuration)),
          },
          onError: (err) => {
            console.error('TUS upload error:', err);
            reject(err);
          },
          onProgress: (bytesUploaded, bytesTotal) => {
            const pct = Math.round((bytesUploaded / bytesTotal) * 100);
            setUploadProgress(pct);
            setStatusText(`Uploading video... ${pct}%`);
          },
          onSuccess: () => {
            resolve();
          },
          onAfterResponse: (req, res) => {
            const header = res.getHeader('X-Embed-URL') || res.getHeader('x-embed-url');
            if (header) capturedEmbedUrl = header;
          },
        });
        tusUploadRef.current = upload;
        upload.start();
      });

      // Fallback: if no X-Embed-URL header, warn but don't use the raw TUS URL
      if (!capturedEmbedUrl) {
        console.warn('No X-Embed-URL header received from embed service');
      }

      if (!capturedEmbedUrl) {
        throw new Error('Upload succeeded but no embed URL was returned');
      }

      setEmbedUrl(capturedEmbedUrl);
      addMessage('Video uploaded successfully');
      setStatusText('Posting to Hive...');
      addMessage('Publishing to Hive blockchain...');

      // ─── Step 2: Post to Hive via aioha ───
      const hivePermlink = `3speak-${Date.now()}`;
      const communityTag = typeof community === 'string' ? community : community?.name || 'hive-181335';

      // Build body: description + embed URL + credit to original author
      let postBody = `${description}\n\n${capturedEmbedUrl}`;
      if (originalAuthor && originalPermlink) {
        postBody += `\n\n---\n*Based on a video by [@${originalAuthor}](${window.location.origin}/@${originalAuthor}/${originalPermlink})*`;
      }

      const jsonMetadata = {
        app: '3speak/embed',
        format: 'markdown',
        tags: ['3speak', ...tagsPreview],
        video: {
          platform: '3speak',
          url: capturedEmbedUrl,
          ...(originalAuthor ? { originalAuthor, originalPermlink } : {}),
        },
      };

      // Build comment_options with 10% beneficiary to threespeakfund + any user-added beneficiaries
      let parsedBeneficiaries = beneficiaries;
      if (typeof parsedBeneficiaries === 'string') {
        try { parsedBeneficiaries = JSON.parse(parsedBeneficiaries); } catch { parsedBeneficiaries = []; }
      }

      // Always include threespeakfund at 10% (1000 = 10%)
      const allBeneficiaries = [
        { account: 'threespeakfund', weight: 1000 },
        ...(Array.isArray(parsedBeneficiaries) ? parsedBeneficiaries : [])
      ];

      // Sort by account name (required by Hive protocol)
      allBeneficiaries.sort((a, b) => a.account.localeCompare(b.account));

      const commentOptions = {
        author: user,
        permlink: hivePermlink,
        max_accepted_payout: '1000000.000 HBD',
        percent_hbd: 10000,
        allow_votes: true,
        allow_curation_rewards: true,
        extensions: [[0, { beneficiaries: allBeneficiaries }]],
      };

      // For a root post: parentAuthor='', parentPermlink=community
      const result = await commentWithAioha(
        '',              // parentAuthor (empty = root post)
        communityTag,    // parentPermlink (community)
        hivePermlink,    // permlink
        title,           // title
        postBody,        // body
        jsonMetadata,    // json_metadata
        commentOptions   // comment_options with beneficiaries
      );

      if (!result.success) {
        throw new Error('Failed to post to Hive');
      }

      addMessage('Posted to Hive successfully');
      setStatusText('Linking embed video...');

      // ─── Step 3: Link embed video to Hive post ───
      try {
        const vParam = new URL(capturedEmbedUrl).searchParams.get('v');
        const embedPermlink = vParam ? vParam.split('/').pop() : null;

        if (embedPermlink && EMBED_API_URL) {
          await fetch(`${EMBED_API_URL}/video/${embedPermlink}/hive`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(EMBED_API_KEY ? { 'X-API-Key': EMBED_API_KEY } : {}),
            },
            body: JSON.stringify({
              hive_author: user,
              hive_permlink: hivePermlink,
              hive_title: title,
              hive_body: postBody,
              hive_tags: ['3speak', ...tagsPreview],
            }),
          });
          addMessage('Embed video linked to Hive post');
        }
      } catch (linkErr) {
        console.warn('Failed to link embed video to Hive post:', linkErr);
        addMessage('Warning: Could not link embed video (non-critical)', 'warning');
      }

      // ─── Done ───
      setStatusText('Completed');
      setCompleted(true);
      setUploading(false);
      addMessage('Video successfully published!', 'success');
      toast.success('Video published successfully!');

    } catch (err) {
      console.error('Publish error:', err);
      addMessage('Upload failed: ' + err.message, 'error');
      toast.error('Upload failed: ' + err.message);
      setUploading(false);
      setStatusText('');
    }
  };

  const value = {
    // Step
    step, setStep,
    // Video
    videoFile, setVideoFile,
    prevVideoFile, setPrevVideoFile,
    videoDuration, setVideoDuration,
    // Thumbnail
    generatedThumbnail, setGeneratedThumbnail,
    selectedThumbnail, setSelectedThumbnail,
    thumbnailFile, setThumbnailFile,
    selectedIndex, setSelectedIndex,
    // Details
    title, setTitle,
    description, setDescription,
    tagsInputValue, setTagsInputValue,
    tagsPreview, setTagsPreview,
    community, setCommunity,
    beneficiaries, setBeneficiaries,
    declineRewards, SetDeclineRewards,
    rewardPowerup, setRewardPowerup,
    isScheduled, setIsScheduled,
    scheduleDateTime, setScheduleDateTime,
    // Community data
    communitiesData, setCommunitiesData,
    // Modals
    isOpen, setIsOpen,
    benficaryOpen, setBeneficiaryOpen,
    BeneficiaryList, setBeneficiaryList,
    list, setList,
    remaingPercent, setRemaingPercent,
    // Publish state
    uploading, setUploading,
    completed, setCompleted,
    uploadProgress, setUploadProgress,
    statusText, setStatusText,
    statusMessages, setStatusMessages,
    embedUrl, setEmbedUrl,
    // Original video attribution
    originalAuthor, setOriginalAuthor,
    originalPermlink, setOriginalPermlink,
    // User
    user,
    navigate,
    // Functions
    publishToEmbed,
    resetUploadState,
  };

  return (
    <EmbedUploadContext.Provider value={value}>
      {children}
    </EmbedUploadContext.Provider>
  );
}
