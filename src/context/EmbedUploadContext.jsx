import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import { getHiveUrl } from '../utils/hiveNode';
import { getCreatorSettings, isUploadBlocked } from '../utils/creatorSettings';
import { useSupportBlock } from '../lib/supportBlockStore';
import { useNavigate } from 'react-router-dom';
import * as tus from 'tus-js-client';
import { toast } from 'sonner';
import { EMBED_UPLOAD_URL, EMBED_API_URL, EMBED_API_KEY, HIVE_API_URL, EMBED_DEBUG, CHECKER_API_KEY } from '../utils/config';
import { uploadThumbnail } from '../utils/uploadThumbnail';
import { pickEmbedEndpoint } from '../utils/embedEndpoints';
import { reloadIfStale } from '../utils/checkLatestVersion';
import { commentWithAioha, broadcastWithAioha, signMessageWithAioha, isLoggedIn, getCurrentProvider, Providers, broadcastViaThreespeak, KeyTypes } from '../hive-api/aioha';
import { hasThreespeakPostingAuth, addThreespeakToPostingAuth } from '../utils/postingAuthority';
import { useAppStore } from '../lib/store';
import { usePremiumStatus } from '../hooks/usePremiumStatus';
import { enforceLockedBeneficiaries, chargesEncoder, LOCKED_FUND_ACCOUNT, LOCKED_ENCODER_ACCOUNT } from '../utils/beneficiaries';
import axios from 'axios';

// Hosts that support TUS resume (tusd-backed). The legacy embed.3speak.tv origin
// does NOT — a leftover fingerprint there fails with "invalid or missing length
// value" — so cross-session resume must stay OFF for it.
const NON_RESUMABLE_UPLOAD_RX = /(^|\/\/)embed\.3speak\.tv\b/i;
function endpointSupportsResume(endpoint) {
  return !NON_RESUMABLE_UPLOAD_RX.test(endpoint || '');
}

// Browser connection hint. On a thin/flaky/metered uplink we shrink to small
// SEQUENTIAL chunks: big parallel chunks contend for bandwidth and trip tusd's
// ~60s body-read timeout (the ERR_READ_TIMEOUT / ERR_UPLOAD_INTERRUPTED cascade
// that loses uploads on bad connections).
function getConnectionProfile() {
  const c = (typeof navigator !== 'undefined' &&
    (navigator.connection || navigator.mozConnection || navigator.webkitConnection)) || null;
  // No Network Information API (Firefox/Safari) → we can't measure the link, so
  // be conservative and treat it as weak. Parallel multi-part uploads strand at
  // 0% on slow/flaky mobile links, and we'd rather a reliable sequential upload
  // than an aggressive one that never gets a byte through.
  if (!c) return { weak: true, effectiveType: 'unknown' };
  const et = String(c.effectiveType || '');
  const dl = Number(c.downlink);        // Mbps (optimistic estimate)
  const rtt = Number(c.rtt);            // ms
  // downlink/effectiveType read optimistically on mobile (a flaky 4G still says
  // "4g"), so lean toward "weak": anything below 4g, < 3 Mbps, high latency, or
  // Data Saver on.
  const weak =
    /(slow-2g|2g|3g)/i.test(et) ||
    (Number.isFinite(dl) && dl > 0 && dl < 3) ||
    (Number.isFinite(rtt) && rtt > 400) ||
    !!c.saveData;
  return { weak, effectiveType: et, downlink: dl, rtt, saveData: !!c.saveData };
}

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
  const [isNsfw, setIsNsfw] = useState(false);
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduleDateTime, setScheduleDateTime] = useState('');

  // Community data
  const [communitiesData, setCommunitiesData] = useState([]);

  // Modal state
  const [isOpen, setIsOpen] = useState(false);
  const [benficaryOpen, setBeneficiaryOpen] = useState(false);
  const [BeneficiaryList, setBeneficiaryList] = useState([]);
  // Initial UI list — show the locked threespeakfund (10%) + encoder.pay (1%)
  // splits only for non-premium users. Both are locked: the modal renders
  // them without a delete control and won't let them drop below minPercent.
  // Premium users (or remix flows) get an updated list pushed in by the
  // relevant pre-fill code paths.
  const [list, setList] = useState([
    { account: LOCKED_FUND_ACCOUNT, percent: 10, locked: true, minPercent: 10 },
    { account: LOCKED_ENCODER_ACCOUNT, percent: 1, locked: true, minPercent: 1 },
  ]);
  const [remaingPercent, setRemaingPercent] = useState(89);

  // Premium status lands asynchronously (1 network call). When it flips
  // to true we drop the locked threespeakfund row (and the encoder.pay row,
  // UNLESS this Pro holder is grandfathered into still paying it) from the
  // UI so it matches what the publish path actually broadcasts. Guarded by a
  // ref so it prunes exactly once even if the effect re-runs. Non-Pro stays.
  const prunedLockedRef = useRef(false);
  useEffect(() => {
    if (!isPremium || prunedLockedRef.current) return;
    prunedLockedRef.current = true;
    const keepEncoder = chargesEncoder({ isPremium, username: user, includeEncoder: true });
    setList((prev) => prev.filter(
      (b) => b.account !== LOCKED_FUND_ACCOUNT
        && (keepEncoder || b.account !== LOCKED_ENCODER_ACCOUNT),
    ));
    // Always reclaim the 10% fund; reclaim the 1% encoder only when dropped.
    setRemaingPercent((prev) => Math.min(100, prev + (keepEncoder ? 10 : 11)));
  }, [isPremium, user]);

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
  // Hive permlink of the just-published post — used by the success screen to
  // offer promotion of the new video.
  const [publishedPermlink, setPublishedPermlink] = useState('');

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

  // Early/background video upload — the TUS upload starts while the user is still
  // on the "Add details" step (instead of only at final publish), so by the time
  // they finish the video is usually already up. State drives the progress bar;
  // refs hold the captured URL + in-flight promise so publishToEmbed can reuse
  // (and await) it without stale-closure issues.
  // videoUploadStatus: 'idle' | 'uploading' | 'done' | 'error'
  const [videoUploadStatus, setVideoUploadStatus] = useState('idle');
  // The embed host chosen for the current upload (reactive copy of
  // chosenEmbedBaseRef, for display under the progress bar).
  const [selectedEndpoint, setSelectedEndpoint] = useState('');
  const earlyEmbedUrlRef = useRef('');
  const earlyUploadPromiseRef = useRef(null);
  const earlyUploadStartedRef = useRef(false);
  const earlyUploadedFileRef = useRef(null); // which file the background upload used
  // The embed server chosen for this upload. Sticky for the whole lifecycle so
  // the post-upload /video/*/hive + /thumbnail writes hit the same host as the
  // bytes (works whether or not the servers share a MongoDB).
  const chosenEmbedBaseRef = useRef('');

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
    resetEarlyUpload();
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
    setIsNsfw(false);
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
    setPublishedPermlink('');
    setBeneficiaryList([]);
    setList([]);
    setRemaingPercent(100);
    setPrefilled(false);
    setPrefilledPermlink('');
    setPrefilledOwner('');
    setPrefilledEmbedUrl('');
    resetEarlyUpload();
  };

  // Forget any background upload so a newly-selected/replaced video re-uploads.
  // This is an EXPLICIT user reset (Replace Video / pick another), so it must
  // also discard any resumable state — terminate the partial on the server and
  // clear stored TUS fingerprints — otherwise re-picking the same file would
  // silently resume when the user wanted a clean start. (A crash/reload, by
  // contrast, leaves the fingerprint in place so resume still works there.)
  const resetEarlyUpload = useCallback(() => {
    if (tusUploadRef.current) {
      // abort(true) sends a DELETE to terminate the upload + drops its fingerprint.
      try { Promise.resolve(tusUploadRef.current.abort(true)).catch(() => {}); } catch { /* ignore */ }
      tusUploadRef.current = null;
    }
    // Belt-and-suspenders: clear any leftover TUS fingerprints synchronously so
    // the next selection can't resume a stale partial (only one upload at a time).
    try {
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith('tus::')) localStorage.removeItem(key);
      });
    } catch { /* ignore */ }
    earlyEmbedUrlRef.current = '';
    earlyUploadPromiseRef.current = null;
    earlyUploadStartedRef.current = false;
    earlyUploadedFileRef.current = null;
    chosenEmbedBaseRef.current = '';
    setSelectedEndpoint('');
    setVideoUploadStatus('idle');
  }, []);

  // The raw TUS upload of `videoFile` to the embed service. Shared by the
  // background (early) upload and the publish fallback. `uploadEndpoint` is the
  // chosen server's /uploads URL (defaults to the single configured host).
  // Returns the embed URL.
  const runTusUpload = useCallback(async (generatedPermlink, uploadEndpoint = EMBED_UPLOAD_URL) => {
    // Clear stale TUS fingerprints — embed.3speak.tv can't resume, so a leftover
    // fingerprint causes "invalid or missing length value" errors.
    try {
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith('tus::') && key.includes('embed.3speak.tv')) {
          localStorage.removeItem(key);
        }
      });
    } catch { /* ignore */ }

    const MB = 1024 * 1024;
    const sizeBytes = videoFile.size || 0;
    const conn = getConnectionProfile();
    let chunkSize, parallelUploads;
    if (conn.weak) {
      // Thin/flaky/metered uplink: small SEQUENTIAL chunks. Each PATCH finishes
      // well inside the server read-timeout, a drop loses little, and we avoid the
      // multi-stream contention that caused the read-timeout/interrupt cascade.
      chunkSize = 4 * MB; parallelUploads = 1;
    }
    // Parallel multi-part uploads split the uplink N ways and each part is a
    // separate upload that can strand — great on a fat pipe, fragile otherwise.
    // Cap at 2 and keep chunks modest so a stall costs little and resumes fast.
    else if (sizeBytes > 500 * MB) { chunkSize = 16 * MB; parallelUploads = 2; }
    else if (sizeBytes > 50 * MB) { chunkSize = 8 * MB; parallelUploads = 2; }
    else { chunkSize = 5 * MB; parallelUploads = 1; }

    // Cross-session resume only on tusd-backed hosts (see endpointSupportsResume).
    const resumable = endpointSupportsResume(uploadEndpoint);

    let capturedEmbedUrl = '';
    let resolveDone, rejectDone;
    const done = new Promise((resolve, reject) => { resolveDone = resolve; rejectDone = reject; });
    const upload = new tus.Upload(videoFile, {
      endpoint: uploadEndpoint,
      chunkSize,
      parallelUploads,
      // ~2 min of backoff so transient drops recover instead of hard-failing.
      // Each retry HEADs the upload and continues from the server's offset.
      retryDelays: [0, 3000, 5000, 10000, 20000, 30000, 60000],
      storeFingerprintForResuming: resumable,
      removeFingerprintOnSuccess: true,
      // Retry network drops + the transient 5xx tusd returns for stalled/
      // interrupted bodies (ERR_READ_TIMEOUT / EOF / lock); never retry auth/4xx.
      onShouldRetry: (err) => {
        const status = err?.originalResponse?.getStatus?.() ?? 0;
        const willRetry = status === 0 || status === 409 || status === 423 ||
          status === 429 || status >= 500;
        if (willRetry) setStatusText('Connection unstable — retrying…');
        return willRetry;
      },
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
        rejectDone(err);
      },
      onProgress: (bytesUploaded, bytesTotal) => {
        const pct = Math.round((bytesUploaded / bytesTotal) * 100);
        setUploadProgress(pct);
        setStatusText(`Uploading video... ${pct}%`);
      },
      onSuccess: () => resolveDone(),
      onAfterResponse: (req, res) => {
        const header = res.getHeader('X-Embed-URL') || res.getHeader('x-embed-url');
        if (header) capturedEmbedUrl = header;
      },
    });
    tusUploadRef.current = upload;
    // Resume an interrupted upload from a previous session if one exists for this
    // file on a resumable host — picks up where the dropped connection left off
    // instead of restarting at 0%.
    if (resumable) {
      try {
        const prev = await upload.findPreviousUploads();
        if (prev && prev.length) upload.resumeFromPreviousUpload(prev[0]);
      } catch { /* no resumable upload — start fresh */ }
    }
    upload.start();
    await done;
    return capturedEmbedUrl;
  }, [videoFile, user, fromStories, videoDuration]);

  // Kick off the background upload (called when the user reaches "Add details").
  // Idempotent: only starts once per selected video. The embed asset gets its own
  // permlink here — the Hive post keeps its title-derived permlink and the two are
  // bridged at publish by the /video/{embedPermlink}/hive link step.
  const startEarlyUpload = useCallback(() => {
    if (prefilled || EMBED_DEBUG) return;            // nothing to upload in these flows
    if (!videoFile) return;
    // A different file is now selected (e.g. "Replace Video") → start fresh.
    if (earlyUploadStartedRef.current && earlyUploadedFileRef.current !== videoFile) {
      resetEarlyUpload();
    }
    if (earlyUploadStartedRef.current) return;       // already started/done for this file
    earlyUploadStartedRef.current = true;
    earlyUploadedFileRef.current = videoFile;
    setVideoUploadStatus('uploading');
    setUploadProgress(0);
    setStatusText('Uploading video in the background…');
    const p = (async () => {
      try {
        // Stale-client guard: if a newer build is deployed, force-reload onto it
        // BEFORE any upload starts, so nobody uploads on cached/retired code.
        if (await reloadIfStale()) return '';   // page is reloading — bail out
        // Pick the least-busy embed server (sticky for the rest of this upload).
        const { base, uploadUrl } = await pickEmbedEndpoint();
        chosenEmbedBaseRef.current = base;
        setSelectedEndpoint(base);
        const url = await runTusUpload('', uploadUrl);
        if (!url) throw new Error('No embed URL returned');
        earlyEmbedUrlRef.current = url;
        setEmbedUrl(url);
        setUploadProgress(100);
        setVideoUploadStatus('done');
        setStatusText('');
        return url;
      } catch (err) {
        console.error('Background video upload failed:', err);
        // Allow the publish step to retry the upload inline.
        earlyUploadStartedRef.current = false;
        earlyUploadPromiseRef.current = null;
        setVideoUploadStatus('error');
        return '';
      }
    })();
    earlyUploadPromiseRef.current = p;
  }, [prefilled, videoFile, runTusUpload, resetEarlyUpload]);

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

    // Backstop upload gate: blocks "Post Video/Short" for creators with
    // canUpload === false, even if they reached /embed-studio directly (bypassing
    // the upload-button gate). Fails open if the check errors.
    if (isUploadBlocked(await getCreatorSettings(user))) {
      useSupportBlock.getState().showSupportBlock('upload');
      return;
    }

    // If the background upload (started on the "Add details" step) is running or
    // done, reuse it instead of uploading again. Wait for an in-flight one.
    let earlyUrl = earlyEmbedUrlRef.current;
    if (!prefilled && !earlyUrl && earlyUploadPromiseRef.current) {
      setUploading(true);
      setStatusText('Finishing video upload…');
      try { earlyUrl = await earlyUploadPromiseRef.current; } catch { earlyUrl = ''; }
    }
    const alreadyUploaded = !prefilled && !!earlyUrl;

    setUploading(true);
    setUploadProgress(alreadyUploaded ? 100 : 0);
    setStatusText(prefilled ? 'Preparing publish...' : (alreadyUploaded ? 'Finalizing…' : 'Uploading video...'));
    addMessage(prefilled ? 'Using pre-uploaded video' : (alreadyUploaded ? 'Video already uploaded' : 'Starting video upload...'));

    try {
      // For prefilled flows, the permlink was decided by whoever uploaded the
      // file (e.g. the Hangouts server). Reuse it so the Hive post permlink
      // matches the embed permlink — that's what the existing /video/{p}/hive
      // link endpoint expects.
      // Permlink slug source: longform videos use the title; shorts have no
      // title, so they keep using the first words of the description (caption).
      const slugSource = ((fromStories ? description : title) || description || '').trim();
      const slug = slugSource
        ? slugSource.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 27).replace(/-+$/, '')
        : '';
      const generatedPermlink = prefilled && prefilledPermlink
        ? prefilledPermlink
        : (slug ? `${slug}-${Date.now() % 1000}` : '');

      // ─── Step 1: TUS upload to embed service ───
      // Skipped when prefilled OR when the background upload already finished it.
      let capturedEmbedUrl = prefilled ? prefilledEmbedUrl : (alreadyUploaded ? earlyUrl : '');

      if (prefilled) {
        // Nothing to upload — the file was already pushed to embed.3speak.tv
        // by an external uploader. Skip straight to thumbnail + Hive linking.
        setUploadProgress(100);
        addMessage('Pre-uploaded video ready');
      } else if (alreadyUploaded) {
        // Background upload (from the details step) already produced the embed URL.
        setUploadProgress(100);
        addMessage('Video uploaded in the background');
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
        // No background upload available (it failed, or the user reached publish
        // before "Add details" started one) → upload inline now, choosing a server.
        const { base, uploadUrl } = await pickEmbedEndpoint();
        chosenEmbedBaseRef.current = base;
        setSelectedEndpoint(base);
        capturedEmbedUrl = await runTusUpload(generatedPermlink, uploadUrl);
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

      // "Watch on 3Speak" link at the bottom, pointing at the right page for the
      // content type: shorts → /shorts, regular videos → /watch. Always points at
      // the main instance (3speak.tv), never preview, regardless of where posted.
      const watchPath = fromStories
        ? `/shorts?v=${user}/${hivePermlink}`
        : `/watch?v=${user}/${hivePermlink}`;
      postBody += `\n\n---\n▶ [Watch on 3speak.tv](https://3speak.tv${watchPath})`;

      // Only the community tag is added automatically (no '3speak', no 'short').
      // Shorts are identified by the embed-video `short` DB field, not a Hive tag.
      // The community tag is surfaced in the uploader's tag list and counts toward
      // the 10-tag limit, so the total never exceeds 10.
      const baseTags = fromStories
        ? ['hive-181335']
        : [communityTag];
      // When marked adult, append the canonical Hive `nsfw` tag so the whole Hive
      // ecosystem (and our hive_tags filter) treats it as NSFW.
      const userTags = [
        ...tagsPreview.filter(t => !baseTags.includes(t)),
        ...(isNsfw ? ['nsfw'] : []),
      ].filter((t, i, a) => a.indexOf(t) === i);
      const jsonMetadata = {
        app: '3speak/embed',
        format: 'markdown',
        tags: [...baseTags, ...userTags],
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

      // Apply locked beneficiaries: 10% threespeakfund + 1% encoder.pay for
      // non-Pro users (both skipped for Pro subscribers) + 5% to the original
      // creator on remix/clip (kept for both tiers). encoder.pay rides on
      // embed uploads specifically because they go through 3Speak's encoder.
      enforceLockedBeneficiaries(beneMap, {
        isPremium,
        username: user,
        includeEncoder: true,
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
      // Target the SAME server the bytes went to (the returned embed URL is the
      // shared player host, not the upload server, so we can't derive it).
      const embedApiBase = chosenEmbedBaseRef.current || EMBED_API_URL;

      try {
        if (embedPermlink && embedApiBase) {
          await fetch(`${embedApiBase}/video/${embedPermlink}/hive`, {
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
      if (thumbnailUrl && embedPermlink && embedApiBase) {
        try {
          await fetch(`${embedApiBase}/video/${embedPermlink}/thumbnail`, {
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
      setPublishedPermlink(hivePermlink);
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
    isNsfw, setIsNsfw,
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
    publishedPermlink,
    // Background ('early') video upload that starts on the details step
    videoUploadStatus,
    selectedEndpoint,
    startEarlyUpload,
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
