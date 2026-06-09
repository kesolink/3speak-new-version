import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import { getHiveUrl } from '../utils/hiveNode';
import { useNavigate } from 'react-router-dom';
import * as tus from 'tus-js-client';
import { toast } from 'sonner';
import { EMBED_UPLOAD_URL, EMBED_API_URL, EMBED_API_KEY, HIVE_API_URL, EMBED_DEBUG, CHECKER_API_KEY } from '../utils/config';
import { uploadThumbnail } from '../utils/uploadThumbnail';
import { commentWithAioha, broadcastWithAioha, signMessageWithAioha, isLoggedIn, getCurrentProvider, Providers, broadcastViaThreespeak, KeyTypes } from '../hive-api/aioha';
import { hasThreespeakPostingAuth, addThreespeakToPostingAuth } from '../utils/postingAuthority';
import { useAppStore } from '../lib/store';
import { usePremiumStatus } from '../hooks/usePremiumStatus';
import { enforceLockedBeneficiaries, LOCKED_FUND_ACCOUNT } from '../utils/beneficiaries';
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
  // Pro subscribers skip the threespeakfund 10% — their sub fee
  // covers what that split normally funds. Remix attribution to the
  // original creator stays for both tiers (handled in the publish path).
  const premiumStatus = usePremiumStatus(user);
  const isPremium = !!premiumStatus?.premium;

  // Step tracking
  const [step, setStep] = useState(1);

  // Video file state
  const [videoFile, setVideoFile] = useState(null);
  const [prevVideoFile, setPrevVideoFile] = useState(null);
  const [videoDuration, setVideoDuration] = useState(0);
  // Which studio mode the currently-selected video was picked under: 'shorts' | 'longform' | null.
  // Used to clear a stale selection when the studio is reopened in the other mode.
  const [videoMode, setVideoMode] = useState(null);

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
  // Initial UI list — show the locked threespeakfund only for non-premium
  // users. Premium users (or remix flows) get an updated list pushed in
  // by the relevant pre-fill code paths.
  const [list, setList] = useState([
    { account: LOCKED_FUND_ACCOUNT, percent: 10, locked: true, minPercent: 10 },
  ]);
  const [remaingPercent, setRemaingPercent] = useState(90);

  // Premium status lands asynchronously (1 network call). When it flips
  // to true we drop the locked threespeakfund row from the UI so the
  // user doesn't see "10% to threespeakfund (locked)" while the publish
  // path silently omits it. Non-Pro stays as-is.
  useEffect(() => {
    if (!isPremium) return;
    setList((prev) => {
      const next = prev.filter((b) => b.account !== LOCKED_FUND_ACCOUNT);
      if (next.length === prev.length) return prev; // no change
      return next;
    });
    setRemaingPercent((prev) => Math.min(100, prev + 10));
  }, [isPremium]);

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

  // Prefilled state — set when arriving from an external upload (e.g. Hangouts
  // server-side recording) that already pushed a video to the embed service.
  // When prefilled, the publish flow skips the TUS upload and goes straight to
  // thumbnail + Hive post + link, using the captured embed URL.
  const [prefilled, setPrefilled] = useState(false);
  const [prefilledPermlink, setPrefilledPermlink] = useState('');
  const [prefilledOwner, setPrefilledOwner] = useState('');
  const [prefilledEmbedUrl, setPrefilledEmbedUrl] = useState('');

  const setPrefilledFromQuery = ({ permlink, owner, embedUrl: url }) => {
    setPrefilled(true);
    setPrefilledPermlink(permlink || '');
    setPrefilledOwner(owner || '');
    setPrefilledEmbedUrl(url || '');
    setEmbedUrl(url || '');
  };

  const tusUploadRef = useRef(null);

  const addMessage = (msg, type = 'info') => {
    setStatusMessages(prev => [...prev, {
      time: new Date().toLocaleTimeString(),
      message: msg,
      type,
    }]);
  };

  // Clear only the selected video + its derived thumbnails (not the whole form).
  // Used when the studio is reopened in a different mode than the video was picked in.
  const clearVideoSelection = () => {
    setVideoFile(null);
    setPrevVideoFile(null);
    setVideoDuration(0);
    setGeneratedThumbnail([]);
    setSelectedThumbnail(null);
    setThumbnailFile(null);
    setSelectedIndex(null);
    setVideoMode(null);
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
    setVideoMode(null);
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
    setPrefilled(false);
    setPrefilledPermlink('');
    setPrefilledOwner('');
    setPrefilledEmbedUrl('');
  };

  /**
   * publishToEmbed — the 3-step publish:
   * 1. TUS upload to embed service
   * 2. Post to Hive via aioha
   * 3. Link embed video to Hive post
   */
  const publishToEmbed = async () => {
    if (!user) {
      toast.error('User not logged in');
      return;
    }
    // Fail fast on a stale/expired wallet session (e.g. an expired HiveSigner
    // token): `user` can be a leftover localStorage value while aioha has no
    // live session. Without this, the whole video + thumbnail upload runs and
    // only the final Hive broadcast fails with "Not logged in". isLoggedIn()
    // is true for an aioha session OR a ManteAuth/ButrAuth login.
    if (!isLoggedIn()) {
      toast.error('Your session expired — please log in again before uploading');
      return;
    }
    // For non-prefilled flows we need a local file. Prefilled flows already
    // have the embed URL handed over from an external uploader.
    if (!prefilled && !videoFile) {
      toast.error('No video file');
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
    setStatusText(prefilled ? 'Preparing publish...' : 'Uploading video...');
    addMessage(prefilled ? 'Using pre-uploaded video' : 'Starting video upload...');

    try {
      // For prefilled flows, the permlink was decided by whoever uploaded the
      // file (e.g. the Hangouts server). Reuse it so the Hive post permlink
      // matches the embed permlink — that's what the existing /video/{p}/hive
      // link endpoint expects.
      const trimmedDesc = (description || '').trim();
      const slug = trimmedDesc
        ? trimmedDesc.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 27).replace(/-+$/, '')
        : '';
      const generatedPermlink = prefilled && prefilledPermlink
        ? prefilledPermlink
        : (slug ? `${slug}-${Date.now() % 1000}` : '');

      // ─── Step 1: TUS upload to embed service (skipped when prefilled) ───
      let capturedEmbedUrl = prefilled ? prefilledEmbedUrl : '';

      if (prefilled) {
        // Nothing to upload — the file was already pushed to embed.3speak.tv
        // by an external uploader. Skip straight to thumbnail + Hive linking.
        setUploadProgress(100);
        addMessage('Pre-uploaded video ready');
      } else if (EMBED_DEBUG) {
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

        // Adaptive chunk/parallel sizing (tusd Concatenation extension). Larger files
        // get bigger chunks and 3 parallel slots for throughput; small files stay light.
        const MB = 1024 * 1024;
        const sizeBytes = videoFile.size || 0;
        let chunkSize, parallelUploads;
        if (sizeBytes > 500 * MB) {
          chunkSize = 20 * MB; parallelUploads = 3;
        } else if (sizeBytes > 50 * MB) {
          chunkSize = 10 * MB; parallelUploads = 3;
        } else {
          chunkSize = 5 * MB; parallelUploads = 2;
        }

        await new Promise((resolve, reject) => {
          const upload = new tus.Upload(videoFile, {
            endpoint: EMBED_UPLOAD_URL,
            chunkSize,
            parallelUploads,
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
              ...(generatedPermlink ? { permlink: generatedPermlink } : {}),
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
          // Embed posts are broadcast by @threespeak, so the thumbnail goes
          // straight to the 3Speak image server (static key) — no user signature.
          thumbnailUrl = await uploadThumbnail(thumbnailFile, user, { preferStatic: true });
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
      const hivePermlink = generatedPermlink;
      const communityTag = typeof community === 'string' ? community : community?.name || 'hive-181335';

      // Build body: embed URL (video first) + description + credit to original author
      let postBody = `${capturedEmbedUrl}\n\n${description}`;
      if (originalAuthor && originalPermlink) {
        // Use shorts link format when remix comes from a short
        const shortPl = originalShortPermlink || originalPermlink;
        const originalLink = fromStories
          ? `${window.location.origin}/shorts?v=${originalAuthor}/${shortPl}`
          : `${window.location.origin}/@${originalAuthor}/${originalPermlink}`;
        postBody += `\n\n---\n*Based on a video by [@${originalAuthor}](${originalLink})*`;
      }

      // Tag taxonomy differs by upload type:
      //   - shorts: forced ['3speak', 'hive-181335', 'short', ...userTags]
      //   - regular video: ['3speak', communityTag, ...userTags] — uses the actually-
      //     selected community, no 'short' tag.
      const baseTags = fromStories
        ? ['3speak', 'hive-181335', 'short']
        : ['3speak', communityTag];
      const jsonMetadata = {
        app: '3speak/embed',
        format: 'markdown',
        tags: [...baseTags, ...tagsPreview.filter(t => !baseTags.includes(t))],
        // Top-level `image: [url]` is the Hive-wide convention frontends read to
        // pick a post's cover (peakd, ecency, hive.blog, …). Only add it when we
        // actually have a thumbnail — otherwise we'd post `image: [null]` which
        // some renderers choke on. The same field is duplicated inside `video`
        // for legacy 3Speak readers that look for it there.
        ...(thumbnailUrl ? { image: [thumbnailUrl] } : {}),
        video: {
          platform: '3speak',
          url: capturedEmbedUrl,
          reusable: (originalAuthor && originalPermlink) ? true : reusable,
          ...(thumbnailUrl ? { thumbnail: thumbnailUrl } : {}),
          ...(originalAuthor ? { originalAuthor, originalPermlink } : {}),
        },
      };

      // Build comment_options. When the author is declining payout, skip
      // beneficiaries entirely — declaring beneficiaries against a 0 HBD
      // payout reads weird on-chain and an empty beneficiaries extension
      // would be rejected by Hive.
      let allBeneficiaries = [];
      if (!declineRewards) {
        let parsedBeneficiaries = beneficiaries;
        if (typeof parsedBeneficiaries === 'string') {
          try { parsedBeneficiaries = JSON.parse(parsedBeneficiaries); } catch { parsedBeneficiaries = []; }
        }

        // Start with user-set beneficiaries (from the UI list, includes locked items)
        const beneMap = new Map();
        for (const b of (Array.isArray(parsedBeneficiaries) ? parsedBeneficiaries : [])) {
          beneMap.set(b.account, Math.max(beneMap.get(b.account) || 0, b.weight));
        }

      // Apply locked beneficiaries: 10% threespeakfund for non-Pro users
      // (skipped for Pro subscribers) + 5% to the original creator on
      // remix/clip (kept for both tiers).
      enforceLockedBeneficiaries(beneMap, {
        isPremium,
        originalAuthor: originalAuthor && originalPermlink ? originalAuthor : null,
      });

        // Convert map to sorted array (sorted by account name — required by Hive protocol)
        allBeneficiaries = [...beneMap.entries()]
          .map(([account, weight]) => ({ account, weight }))
          .sort((a, b) => a.account.localeCompare(b.account));
      }

      const commentOptions = {
        author: user,
        permlink: hivePermlink,
        max_accepted_payout: declineRewards ? '0.000 HBD' : '1000000.000 HBD',
        percent_hbd: rewardPowerup ? 0 : 10000,
        allow_votes: true,
        allow_curation_rewards: true,
        // Hive rejects an empty beneficiaries extension ("Must specify at least one
        // beneficiary") — Premium users with no beneficiaries have an empty list —
        // but the broadcaster's serializer needs `extensions` to be an array. So use
        // an empty array (not a missing field, and not an empty-beneficiaries entry).
        extensions: allBeneficiaries.length > 0 ? [[0, { beneficiaries: allBeneficiaries }]] : [],
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

      // ─── Scheduled-post branch ─────────────────────────────────────
      // If the user toggled "schedule this post", we don't broadcast now.
      // Instead we ensure @threespeak is in their posting account_auths (asks
      // for an account_update2 signature on the first scheduled post ever),
      // then POST the fully-built post to the checker, which has a 5-minute
      // cron that broadcasts due posts as @threespeak on the user's behalf.
      if (isScheduled && scheduleDateTime && !fromStories) {
        try {
          setStatusText('Checking @threespeak posting authority...');
          addMessage('Checking @threespeak posting authority...');
          const hasAuth = await hasThreespeakPostingAuth(user);
          if (!hasAuth) {
            setStatusText('Authorizing @threespeak (sign with active key)...');
            addMessage('Authorizing @threespeak to post on your behalf...');
            await addThreespeakToPostingAuth(user);
            addMessage('@threespeak authorized');
          }

          // The HTML datetime-local string is local-tz; convert to a real ISO UTC.
          const scheduledOnIso = new Date(scheduleDateTime).toISOString();

          // Auth: the checker create endpoint uses the app-key method (same as the
          // embed /video/* writes), not a client Hive signature — because HiveSigner
          // and ManteAuth can't sign arbitrary messages client-side. The checker
          // trusts the app key + verifies on-chain that the user granted @threespeak
          // posting authority (which we just ensured above and the cron relies on).
          const payoutOptions = declineRewards ? 'decline' : (rewardPowerup ? 'powerup' : 'default');
          const checkerBase =
            import.meta.env.VITE_SCHEDULED_POSTS_API_URL || 'https://prod-checker.okinoko.io';
          const url = `${checkerBase.replace(/\/$/, '')}/scheduled-posts/create`;

          // The embedvideos service indexes uploads by their own permlink. We extract
          // it from the capturedEmbedUrl (format: ?v=<owner>/<embedPermlink>) so the
          // cron can later link the broadcast Hive post back to the embed-video record.
          let embedPermlink = null;
          try {
            const v = new URL(capturedEmbedUrl).searchParams.get('v');
            if (v) embedPermlink = v.split('/').pop() || null;
          } catch { /* leave null — link step in cron is best-effort */ }

          setStatusText('Saving scheduled post...');
          addMessage('Saving scheduled post...');
          const resp = await axios.post(url, {
            owner: user,
            permlink: hivePermlink,
            scheduledOn: scheduledOnIso,
            title,
            description,
            body: postBody,
            tags: jsonMetadata.tags,
            jsonMetadata,
            beneficiaries: allBeneficiaries,
            payoutOptions,
            thumbnail: thumbnailUrl,
            parentAuthor,
            parentPermlink,
            embedPermlink,
          }, {
            headers: CHECKER_API_KEY ? { Authorization: `Bearer ${CHECKER_API_KEY}` } : {},
          });

          if (resp.status !== 201 || !resp.data?.success) {
            throw new Error(resp.data?.error || 'Failed to save scheduled post');
          }

          // We deliberately SKIP the regular Hive broadcast and the embed-link
          // step here — the cron does both at publish time.
          setStatusText(`Scheduled for ${new Date(scheduledOnIso).toLocaleString()}`);
          addMessage(`Scheduled for ${new Date(scheduledOnIso).toLocaleString()}`, 'success');
          toast.success('Post scheduled!');
          setCompleted(true);
          setUploading(false);
          setUploadProgress(100);
          return;
        } catch (schedErr) {
          console.error('Scheduled-post error:', schedErr);
          const msg = schedErr?.response?.data?.error || schedErr?.message || 'Could not schedule post';
          addMessage(`Schedule failed: ${msg}`, 'error');
          toast.error(`Schedule failed: ${msg}`);
          throw schedErr;
        }
      }

      // Policy: video posts in the embed route are broadcast by @threespeak, not
      // signed by the user. Every aioha login (Keychain/HiveAuth/PeakVault/Ledger
      // /HiveSigner) routes its post through our server, which signs+broadcasts as
      // @threespeak on the user's behalf (they granted @threespeak posting
      // authority via the pre-upload gate). ButrAuth (getCurrentProvider() ===
      // null) keeps its own cookie-authenticated server path via commentWithAioha.
      const useThreespeakProxy = !!getCurrentProvider();
      if (useThreespeakProxy) {
        addMessage('Posting via @threespeak (delegated posting authority)');
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

        const remixOps = [mainPostOp, commentOptionsOp, replyOp];
        result = useThreespeakProxy
          ? await broadcastViaThreespeak(remixOps)
          : await broadcastWithAioha(remixOps, KeyTypes.Posting);
      } else {
        // Single post: shorts (including short remixes) and regular uploads
        if (useThreespeakProxy) {
          // Build the raw ops commentWithAioha would have built, and post them
          // server-side as @threespeak.
          const ops = [
            ['comment', {
              parent_author: parentAuthor,
              parent_permlink: parentPermlink,
              author: user,
              permlink: hivePermlink,
              title: fromStories ? '' : title,
              body: postBody,
              json_metadata: JSON.stringify(jsonMetadata),
            }],
            ['comment_options', commentOptions],
          ];
          result = await broadcastViaThreespeak(ops);
        } else {
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
    videoMode, setVideoMode,
    clearVideoSelection,
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
    // Prefilled flow (e.g. Hangouts server-side recording)
    prefilled,
    prefilledPermlink,
    prefilledOwner,
    prefilledEmbedUrl,
    setPrefilledFromQuery,
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
