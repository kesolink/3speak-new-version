import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import { getHiveUrl } from '../utils/hiveNode';
import { useNavigate } from 'react-router-dom';
import * as tus from 'tus-js-client';
import { toast } from 'sonner';
import { EMBED_UPLOAD_URL, EMBED_API_URL, EMBED_API_KEY, HIVE_API_URL, EMBED_DEBUG } from '../utils/config';
import { uploadThumbnail } from '../utils/uploadThumbnail';
import { commentWithAioha, broadcastWithAioha, KeyTypes } from '../hive-api/aioha';
import { useAppStore } from '../lib/store';
import axios from 'axios';

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
  const [list, setList] = useState([
    { account: 'threespeakfund', percent: 10, locked: true, minPercent: 10 },
  ]);
  const [remaingPercent, setRemaingPercent] = useState(90);

  // Entry origin (stories → "Share a Short", default → "Share a Video")
  const [fromStories, setFromStories] = useState(false);

  // Original video attribution (for remix/clip)
  const [originalAuthor, setOriginalAuthor] = useState(null);
  const [originalPermlink, setOriginalPermlink] = useState(null);
  const [originalShortPermlink, setOriginalShortPermlink] = useState(null);

  // Reusable flag (allow others to remix/clip this video)
  const [reusable, setReusable] = useState(true);

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
    // Abort any in-progress TUS upload and clear cached fingerprints
    if (tusUploadRef.current) {
      try { tusUploadRef.current.abort(); } catch { }
      tusUploadRef.current = null;
    }
    // Clear TUS fingerprints from localStorage to prevent resume of old uploads
    try {
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('tus::')) localStorage.removeItem(key);
      });
    } catch { }

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
    setFromStories(false);
    setOriginalAuthor(null);
    setOriginalPermlink(null);
    setOriginalShortPermlink(null);
    setReusable(true);
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
    if (!fromStories && !title?.trim()) {
      toast.error('Title is required');
      return;
    }
    if (!description?.trim()) {
      toast.error('Description is required');
      return;
    }
    if (!fromStories && (!tagsPreview || tagsPreview.length === 0)) {
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

      if (EMBED_DEBUG) {
        // Debug mode: simulate upload progress without actually uploading
        addMessage('[DEBUG] Simulating upload...');
        for (let pct = 0; pct <= 100; pct += 5) {
          await new Promise(r => setTimeout(r, 150));
          setUploadProgress(pct);
          setStatusText(`Uploading video... ${pct}%`);
        }
        capturedEmbedUrl = `https://embed.okinoko.io/embed?v=debug/${Date.now()}`;
        addMessage('[DEBUG] Simulated upload complete');
      } else {
        // Clear any stale TUS fingerprints for this endpoint before starting,
        // to avoid "invalid or missing length value" errors from resumed uploads.
        // The embed.3speak.tv server does not return Upload-Length on HEAD,
        // so resuming always fails. We disable resume storage entirely.
        try {
          Object.keys(localStorage).forEach(key => {
            if (key.startsWith('tus::') && key.includes('embed.3speak.tv')) {
              localStorage.removeItem(key);
            }
          });
        } catch { }

        await new Promise((resolve, reject) => {
          const upload = new tus.Upload(videoFile, {
            endpoint: EMBED_UPLOAD_URL,
            chunkSize: 5 * 1024 * 1024,
            retryDelays: [0, 2000, 5000, 10000],
            storeFingerprintForResuming: false,
            removeFingerprintOnSuccess: true,
            headers: {
              ...(EMBED_API_KEY ? { 'X-API-Key': EMBED_API_KEY } : {}),
            },
            metadata: {
              filename: videoFile.name,
              filetype: videoFile.type,
              frontend_app: '3speak-tv',
              owner: user,
              short: fromStories ? 'true' : 'false',
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
      }

      // Fallback: if no X-Embed-URL header, warn but don't use the raw TUS URL
      if (!capturedEmbedUrl) {
        console.warn('No X-Embed-URL header received from embed service');
      }

      if (!capturedEmbedUrl) {
        throw new Error('Upload succeeded but no embed URL was returned');
      }

      setEmbedUrl(capturedEmbedUrl);
      addMessage('Video uploaded successfully');

      // ─── Upload thumbnail if available ───
      let thumbnailUrl = null;
      if (thumbnailFile) {
        try {
          setStatusText('Uploading thumbnail...');
          addMessage('Uploading thumbnail...');
          thumbnailUrl = await uploadThumbnail(thumbnailFile);
          addMessage('Thumbnail uploaded');
        } catch (thumbErr) {
          console.warn('Thumbnail upload failed:', thumbErr);
          addMessage('Warning: Thumbnail upload failed (non-critical)', 'warning');
        }
      }

      if (EMBED_DEBUG) {
        addMessage('[DEBUG] Skipping Hive posting and embed linking');
        setStatusText('[DEBUG] Done — staying on screen');
        setUploadProgress(100);
        // Keep uploading=true so the status screen stays visible
        return;
      }

      setStatusText('Posting to Hive...');
      addMessage('Publishing to Hive blockchain...');

      // ─── Step 2: Post to Hive via aioha ───
      const hivePermlink = `3speak-${Date.now()}`;
      const communityTag = typeof community === 'string' ? community : community?.name || 'hive-181335';

      // Build body: description + embed URL + credit to original author
      let postBody = `${description}\n\n${capturedEmbedUrl}`;
      if (originalAuthor && originalPermlink) {
        // Use shorts link format when remix comes from a short
        const shortPl = originalShortPermlink || originalPermlink;
        const originalLink = fromStories
          ? `${window.location.origin}/shorts?v=${originalAuthor}/${shortPl}`
          : `${window.location.origin}/@${originalAuthor}/${originalPermlink}`;
        postBody += `\n\n---\n*Based on a video by [@${originalAuthor}](${originalLink})*`;
      }

      const jsonMetadata = {
        app: '3speak/embed',
        format: 'markdown',
        tags: ['3speak', 'hive-181335', 'short', ...tagsPreview.filter(t => !['3speak', 'hive-181335', 'short'].includes(t))],
        video: {
          platform: '3speak',
          url: capturedEmbedUrl,
          reusable: (originalAuthor && originalPermlink) ? true : reusable,
          ...(originalAuthor ? { originalAuthor, originalPermlink } : {}),
        },
      };

      // Build comment_options with beneficiaries (threespeakfund + original author + user-added)
      let parsedBeneficiaries = beneficiaries;
      if (typeof parsedBeneficiaries === 'string') {
        try { parsedBeneficiaries = JSON.parse(parsedBeneficiaries); } catch { parsedBeneficiaries = []; }
      }

      // Start with user-set beneficiaries (from the UI list, includes locked items)
      const beneMap = new Map();
      for (const b of (Array.isArray(parsedBeneficiaries) ? parsedBeneficiaries : [])) {
        beneMap.set(b.account, Math.max(beneMap.get(b.account) || 0, b.weight));
      }

      // Ensure threespeakfund at minimum 10% (1000 weight)
      beneMap.set('threespeakfund', Math.max(beneMap.get('threespeakfund') || 0, 1000));

      // Ensure 5% for original author when this is a remix/clip
      if (originalAuthor && originalPermlink) {
        beneMap.set(originalAuthor, Math.max(beneMap.get(originalAuthor) || 0, 500));
      }

      // Convert map to sorted array (sorted by account name — required by Hive protocol)
      const allBeneficiaries = [...beneMap.entries()]
        .map(([account, weight]) => ({ account, weight }))
        .sort((a, b) => a.account.localeCompare(b.account));

      const commentOptions = {
        author: user,
        permlink: hivePermlink,
        max_accepted_payout: declineRewards ? '0.000 HBD' : '1000000.000 HBD',
        percent_hbd: rewardPowerup ? 0 : 10000,
        allow_votes: true,
        allow_curation_rewards: true,
        extensions: [[0, { beneficiaries: allBeneficiaries }]],
      };

      // Determine parent:
      // - Short remix → comment under the original short
      // - New short → reply to @peak.snaps latest container post
      // - Regular video → root post in community
      let parentAuthor = '';
      let parentPermlink = communityTag;

      if (fromStories && originalAuthor && originalPermlink) {
        // Remix of an existing short → post as comment under the original
        parentAuthor = originalAuthor;
        parentPermlink = originalPermlink;
        addMessage(`Replying to @${parentAuthor}/${parentPermlink}`);
      } else if (fromStories) {
        addMessage('Finding snaps container post...');
        try {
          const snapsRes = await axios.post(getHiveUrl(), {
            jsonrpc: '2.0',
            method: 'bridge.get_account_posts',
            params: { sort: 'posts', account: 'peak.snaps', start_author: '', start_permlink: '', limit: 1 },
            id: 1,
          });
          const latestSnap = snapsRes.data?.result?.[0];
          if (latestSnap) {
            parentAuthor = latestSnap.author;
            parentPermlink = latestSnap.permlink;
            addMessage(`Replying to @${parentAuthor}/${parentPermlink}`);
          } else {
            throw new Error('No posts found from @peak.snaps');
          }
        } catch (snapErr) {
          console.error('Failed to fetch snaps container:', snapErr);
          throw new Error('Could not find a snaps container post to reply to');
        }
      }

      let result;

      if (originalAuthor && originalPermlink && !fromStories) {
        // Dual post (non-short remix): video post + comment on original video
        addMessage('Creating post and comment on original video...');

        const mainPostOp = ['comment', {
          parent_author: parentAuthor,
          parent_permlink: parentPermlink,
          author: user,
          permlink: hivePermlink,
          title: title,
          body: postBody,
          json_metadata: JSON.stringify(jsonMetadata),
        }];

        const commentOptionsOp = ['comment_options', commentOptions];

        const replyPermlink = `re-${originalAuthor}-${Date.now()}`;
        const replyBody = `I created a remix/clip from this video!\n\nCheck it out: [${title || 'My remix'}](${window.location.origin}/@${user}/${hivePermlink})`;
        const replyOp = ['comment', {
          parent_author: originalAuthor,
          parent_permlink: originalPermlink,
          author: user,
          permlink: replyPermlink,
          title: '',
          body: replyBody,
          json_metadata: JSON.stringify({ app: '3speak/embed', tags: ['3speak'] }),
        }];

        result = await broadcastWithAioha(
          [mainPostOp, commentOptionsOp, replyOp],
          KeyTypes.Posting
        );
      } else {
        // Single post: shorts (including short remixes) and regular uploads
        result = await commentWithAioha(
          parentAuthor,
          parentPermlink,
          hivePermlink,
          fromStories ? '' : title,
          postBody,
          jsonMetadata,
          commentOptions
        );
      }

      if (!result.success) {
        throw new Error('Failed to post to Hive');
      }

      addMessage('Posted to Hive successfully');
      setStatusText('Linking embed video...');

      // ─── Step 3: Link embed video to Hive post ───
      const vParam = new URL(capturedEmbedUrl).searchParams.get('v');
      const embedPermlink = vParam ? vParam.split('/').pop() : null;

      try {
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
              hive_title: fromStories ? '' : title,
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

      // ─── Step 4: Update thumbnail on embed service ───
      if (thumbnailUrl && embedPermlink && EMBED_API_URL) {
        try {
          await fetch(`${EMBED_API_URL}/video/${embedPermlink}/thumbnail`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(EMBED_API_KEY ? { 'X-API-Key': EMBED_API_KEY } : {}),
            },
            body: JSON.stringify({ thumbnail_url: thumbnailUrl }),
          });
          addMessage('Thumbnail linked to embed video');
        } catch (thumbLinkErr) {
          console.warn('Failed to set embed thumbnail:', thumbLinkErr);
          addMessage('Warning: Could not set embed thumbnail (non-critical)', 'warning');
        }
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
    // Entry origin
    fromStories, setFromStories,
    // Original video attribution
    originalAuthor, setOriginalAuthor,
    originalPermlink, setOriginalPermlink,
    originalShortPermlink, setOriginalShortPermlink,
    // Reusable flag
    reusable, setReusable,
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
