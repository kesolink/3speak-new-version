import React, { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { StepProgress } from '../legacy-studio/StepProgress';
import { IoIosArrowDropdownCircle } from 'react-icons/io';
import { MdPeopleAlt } from 'react-icons/md';
import CommunityModal from "../modal/Community_modal";
import Beneficiary_modal from '../modal/Beneficiary_modal';
import { Navigate } from 'react-router-dom';
import { useEmbedUpload } from '../../context/EmbedUploadContext';
import MarkdownComposer from '../studio/MarkdownComposer';
import { getMinMaxDates } from '../../utils/schedulingHelpers';
import EmbedUploadProgressBar from './EmbedUploadProgressBar';
import { usePremiumStatus } from '../../hooks/usePremiumStatus';
// This route renders on its own, so it imports the studio stylesheet rather
// than relying on EmbedStudioPage having mounted first and pulled it in.
// ScheduledPostEditor already does the same for the same reason; Vite dedupes.
import '../legacy-studio/StudioPage.scss';
import SettingInfo from './SettingInfo';
import './EmbedDetails.scss';

function EmbedDetails() {
  const {
    title, setTitle,
    description, setDescription,
    tagsInputValue, setTagsInputValue,
    tagsPreview, setTagsPreview,
    community, setCommunity, setBeneficiaries,
    SetDeclineRewards,
    setRewardPowerup,
    communitiesData,
    navigate,
    BeneficiaryList, setBeneficiaryList,
    list, setList,
    remaingPercent, setRemaingPercent,
    step, setStep,
    isOpen, setIsOpen,
    benficaryOpen, setBeneficiaryOpen,
    selectedThumbnail,
    isScheduled, setIsScheduled,
    scheduleDateTime, setScheduleDateTime,
    fromStories,
    reusable, setReusable,
    isNsfw, setIsNsfw,
    gated, setGated,
    gatedAllowlist, setGatedAllowlist,
    user,
    isChannelTrailer, setIsChannelTrailer,
    originalAuthor, originalPermlink,
    startEarlyUpload,
  } = useEmbedUpload();

  // 🔐 Pro status decides whether the supporters-only control is offered. The
  // hook returns null while loading, so the toggle stays hidden until we have a
  // definite yes rather than flashing in and out.
  const premiumStatus = usePremiumStatus(user);
  const isPro = premiumStatus?.premium === true;

  // Never leave a stale gated intent behind: if Pro lapses mid-session, or the
  // user switches to a short, the flag must not survive into the token request.
  useEffect(() => {
    if (gated && (!isPro || fromStories)) setGated(false);
  }, [gated, isPro, fromStories, setGated]);

  // Turning the paywall off drops the guest list with it, so a list cannot be
  // silently attached to an ungated upload.
  useEffect(() => {
    if (!gated && gatedAllowlist.length) setGatedAllowlist([]);
  }, [gated, gatedAllowlist, setGatedAllowlist]);

  const [allowlistDraft, setAllowlistDraft] = useState('');
  const addAllowlistNames = () => {
    const names = allowlistDraft
      .split(/[\s,]+/)
      .map((n) => n.trim().toLowerCase().replace(/^@/, ''))
      .filter(Boolean);
    const valid = names.filter((n) => /^[a-z][a-z0-9.-]{2,15}$/.test(n));
    const rejected = names.filter((n) => !valid.includes(n));
    if (rejected.length) toast.error(`Not valid Hive accounts: ${rejected.join(', ')}`);
    if (valid.length) {
      setGatedAllowlist([...new Set([...gatedAllowlist, ...valid])]);
      setAllowlistDraft('');
    }
  };

  const isRemix = !!(originalAuthor && originalPermlink);
  const descLimitToastRef = useRef(null);

  // Start uploading the video in the background as soon as the user reaches this
  // "Add details" step, so it's usually done by the time they hit publish.
  // startEarlyUpload is idempotent (only runs once per selected video).
  useEffect(() => {
    startEarlyUpload();
  }, [startEarlyUpload]);

  const handleDescriptionChange = (val) => {
    if (fromStories) {
      if (val.length > 240) {
        // Only fire a toast if one isn't already showing (3-second throttle)
        if (!descLimitToastRef.current) {
          descLimitToastRef.current = toast.error(
            'Maximum 240 characters reached for short descriptions.',
            { duration: 3000 }
          );
          setTimeout(() => { descLimitToastRef.current = null; }, 3000);
        }
        return; // block the update
      }
    }
    setDescription(val);
  };

  useEffect(() => {
    setStep(3)
  }, [])

  // 🔧 TEMPORARY DEV HACK — remove with the other ?devstep handling.
  // /embed-studio/details?devstep=3 renders the form with no upload behind it,
  // purely so the layout can be worked on. Publishing from here will not work.
  const devStep = typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).get('devstep');

  if (!selectedThumbnail && !devStep) {
    return <Navigate to="/embed-studio" replace />;
  }

  const closeCommunityModal = () => {
    setIsOpen(false);
  };

  const toggleBeneficiaryModal = () => {
    setBeneficiaryOpen((prev) => !prev)
  }
  const openCommunityModal = () => {
    setIsOpen(true);
  };

  const handleSelect = (e) => {
    const value = e.target.value;
    if (value === "powerup") {
      setRewardPowerup(true)
      SetDeclineRewards(false)
    } else if (value === "decline") {
      SetDeclineRewards(true)
      setRewardPowerup(false)
    } else {
      SetDeclineRewards(false)
      setRewardPowerup(false)
    }
  }

  const process = () => {
    if (!fromStories && !title?.trim()) {
      toast.error("Title is required");
      return;
    }

    if (!description?.trim()) {
      toast.error("Description is required");
      return;
    }

    if (!fromStories && (!tagsPreview || tagsPreview.length === 0)) {
      toast.error("Please add at least one tag");
      return;
    }

    navigate("/embed-studio/preview");
    setStep(4);
  };


  // Auto taxonomy tags that we add + show in the list and count toward the
  // 10-tag limit. Only the community tag is added automatically — no '3speak',
  // no 'short' (shorts are identified by the embed-video `short` DB field).
  // The community tag counts so the total can't exceed 10.
  const communityTag = typeof community === 'string'
    ? (community || 'hive-181335')
    : (community?.name || 'hive-181335');
  const autoTags = fromStories ? ['hive-181335'] : [communityTag];
  const maxUserTags = Math.max(0, 10 - autoTags.length);
  const allTags = [...autoTags, ...tagsPreview.filter((t) => !autoTags.includes(t))];

  const handleTagChange = (e) => {
    const value = e.target.value.toLowerCase();

    const tags = value
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    const uniqueTags = [...new Set(tags)].filter((t) => !autoTags.includes(t));

    if (uniqueTags.length > maxUserTags) {
      toast.error(`You can add up to ${maxUserTags} tags — the community tag is added automatically.`);
      return;
    }

    setTagsInputValue(value);
    setTagsPreview(uniqueTags);
  };

  return (
    <>
      <div className="studio-main-container">
        <div className="studio-page-header">
          <h1>{fromStories ? "Share a Short" : "Share a Video"}</h1>
        </div>
        <StepProgress step={step} />
        <EmbedUploadProgressBar />
        <div className="studio-page-content">

          <div className="video-detail-wrap">
            <div className="video-items">
              {!fromStories && (
                <div className="input-group">
                  <label htmlFor="">Title</label>
                  <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} />
                </div>
              )}
              <div className="input-group">
                <label htmlFor="">Description</label>
                <div className={`wrap-dec${fromStories ? ' wrap-dec--short' : ''}`}>
                  <MarkdownComposer
                    value={description}
                    onChange={handleDescriptionChange}
                    placeholder={fromStories ? "Describe your short..." : "Write your video description here... Supports markdown formatting!"}
                  />
                </div>
                {fromStories && (
                  <div
                    className="char-counter"
                    style={{
                      textAlign: 'right',
                      fontSize: '0.78rem',
                      marginTop: '4px',
                      color: description.length >= 240 ? '#e05252' : description.length >= 200 ? '#e0a852' : 'var(--text-muted, #888)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {description.length} / 240
                  </div>
                )}
              </div>

              <div className="input-group">
                <label htmlFor="">
                  Tag
                  <span
                    className="tag-count"
                    style={{ marginLeft: 8, fontSize: 12, color: allTags.length >= 10 ? '#e0a852' : 'var(--text-muted, #888)' }}
                  >
                    {allTags.length}/10 tags{!fromStories ? ' · at least 1 required' : ''}
                  </span>
                </label>
                <input type="text" value={tagsInputValue} onChange={handleTagChange} />

                <div className="wrap">
                  <span>Separate multiple tags with </span> <span>Space</span>
                </div>
                {/* The community (and 'short' for shorts) is added automatically —
                    shown here as a pinned tag and counted toward the 10-tag limit. */}
                <div className="preview-tags">
                  <span>{allTags.map((item, index) => (
                    <span
                      className={`item${index < autoTags.length ? ' item--auto' : ''}`}
                      key={index}
                      style={index < autoTags.length ? { opacity: 0.75, fontStyle: 'italic' } : undefined}
                      title={index < autoTags.length ? 'Added automatically' : undefined}
                    >
                      {item}
                    </span>
                  ))}</span>
                </div>
              </div>
              <div className="advance-option">
                {!fromStories && (
                  <div className="beneficiary-wrap community-tile">
                    <div className="wrap">
                      <span>Community<SettingInfo title="Community">Which Hive community this video is posted to. It becomes the post&apos;s category, so community feeds and moderation follow it.</SettingInfo></span>
                      <span>Where this video is posted.</span>
                    </div>
                    <div className="community-wrap" onClick={openCommunityModal}>
                      {community ? <span>{community === "hive-181335" ? <div className="wrap"><img src={`https://images.hive.blog/u/hive-181335/avatar/small`} alt="" /><span></span>Threespeak</div> : <div className="wrap"><img src={`https://images.hive.blog/u/${community.name}/avatar/small`} alt="" /><span></span>{community.title}</div>}</span> : <span> Select Community </span>}
                      <IoIosArrowDropdownCircle size={16} />
                    </div>
                  </div>
                )}
                <div className="beneficiary-wrap mb">
                  <div className="wrap">
                    <span>Rewards Distribution<SettingInfo title="Rewards Distribution">Optional &quot;Hive Reward Pool&quot; distribution method. Choose the default 50/50 split, power up 100% of the payout, or decline rewards entirely.</SettingInfo></span>
                      <span>How rewards are paid out.</span>
                  </div>
                  <div className="select-wrap">
                    <select name="" id="" onChange={handleSelect}>
                      <option value="default"> Default 50% 50% </option>
                      <option value="powerup">Power up 100%</option>
                      <option value="decline">Decline Payout</option>
                    </select>
                  </div>
                </div>
                <div className="beneficiary-wrap">
                  <div className="wrap">
                    <span>Beneficiaries<SettingInfo title="Beneficiaries">Other accounts that should get a percentage of this post's rewards. Useful for co-creators, editors, or the original author of a clip.</SettingInfo></span>
                      <span>Share rewards with others.</span>
                  </div>
                  <div className="bene-btn-wrap" onClick={toggleBeneficiaryModal}>
                    {list.length > 0 && <spa>{list.length}</spa>}
                    <span> BENEFICIARIES</span>
                    <MdPeopleAlt />
                  </div>
                </div>
                <div className="beneficiary-wrap">
                  <div className="wrap">
                    <span>Allow Remix/Clip<SettingInfo title="Allow Remix/Clip">Allow others to create remixes and clips from this video. You will be credited as original author and receive a minimum of 5% in beneficiaries.</SettingInfo></span>
                      <span>Let others remix this.</span>
                  </div>
                  <label className={`toggle-switch${isRemix ? ' disabled' : ''}`}>
                    <input
                      type="checkbox"
                      checked={isRemix ? true : reusable}
                      disabled={isRemix}
                      onChange={(e) => setReusable(e.target.checked)}
                    />
                    <span className="toggle-track"><span className="toggle-thumb" /></span>
                  </label>
                </div>
                <div className="beneficiary-wrap">
                  <div className="wrap">
                    <span>Mark as adult / NSFW<SettingInfo title="Mark as adult / NSFW">Flags this video as adult content. It will be hidden from feeds and search for viewers who have not enabled NSFW, and tagged <code>nsfw</code> across Hive.</SettingInfo></span>
                      <span>Adult content.</span>
                  </div>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={!!isNsfw}
                      onChange={(e) => setIsNsfw(e.target.checked)}
                    />
                    <span className="toggle-track"><span className="toggle-thumb" /></span>
                  </label>
                </div>
                {/* 🔐 Supporters-only. Pro-gated in the UI, but the backend
                    re-checks Pro status when it mints the upload token, so
                    hiding this control is presentation, not enforcement. Not
                    offered for shorts: a paywalled short is a worse product
                    than a free one, and the preview would be most of the clip. */}
                {!fromStories && isPro && (
                  <div className="beneficiary-wrap">
                    <div className="wrap">
                      <span>Supporters only<SettingInfo title="Supporters only">
                          Encrypts this video so only 3Speak Pro subscribers can play it.
                          A short unencrypted preview is published alongside it, so the post
                          still shows a trailer everywhere on Hive.
                          {' '}<strong>This cannot be changed after upload.</strong>
                        </SettingInfo></span>
                      <span>Pro subscribers only.</span>
                    </div>
                    <label className="toggle-switch">
                      <input
                        type="checkbox"
                        checked={!!gated}
                        onChange={(e) => setGated(e.target.checked)}
                      />
                      <span className="toggle-track"><span className="toggle-thumb" /></span>
                    </label>
                  </div>
                )}
                {/* 🔐 Guest list. Named accounts watch without needing Pro, which
                    is what makes this usable for sending a video to specific
                    people. Stored on our servers only — never in the Hive post,
                    so the recipient list is not published on-chain. */}
                {!fromStories && isPro && gated && (
                  <div className="beneficiary-wrap gated-guests">
                    <div className="wrap">
                      <span>Also allow specific accounts<SettingInfo title="Also allow specific accounts">
                          These Hive accounts can watch without 3Speak Pro. The list is kept
                          private on our servers and is never published to your post, so
                          nobody can see who you shared it with.
                        </SettingInfo></span>
                      <span>Specific accounts that can watch.</span>
                    </div>
                    <div className="gated-guests__editor">
                      <div className="gated-guests__input-row">
                        <input
                          type="text"
                          value={allowlistDraft}
                          placeholder="username, another.user"
                          onChange={(e) => setAllowlistDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') { e.preventDefault(); addAllowlistNames(); }
                          }}
                        />
                        <button type="button" onClick={addAllowlistNames}>Add</button>
                      </div>
                      {gatedAllowlist.length > 0 && (
                        <div className="gated-guests__chips">
                          {gatedAllowlist.map((name) => (
                            <span className="gated-guests__chip" key={name}>
                              @{name}
                              <button
                                type="button"
                                aria-label={`Remove ${name}`}
                                onClick={() => setGatedAllowlist(gatedAllowlist.filter((n) => n !== name))}
                              >×</button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {/* Not offered for shorts: the Overview trailer frame is 16:9. */}
                {!fromStories && (
                  <div className="beneficiary-wrap">
                    <div className="wrap">
                      <span>Mark as channel trailer<SettingInfo title="Mark as channel trailer">Plays automatically at the top of your profile&apos;s <strong>Overview</strong> tab, replacing any trailer you set before.</SettingInfo></span>
                      <span>Autoplays on your profile.</span>
                    </div>
                    <label className="toggle-switch">
                      <input
                        type="checkbox"
                        checked={!!isChannelTrailer}
                        onChange={(e) => setIsChannelTrailer(e.target.checked)}
                      />
                      <span className="toggle-track"><span className="toggle-thumb" /></span>
                    </label>
                  </div>
                )}
              </div>

              {/* Schedule section — only for regular videos (not shorts). When toggled on,
                  the post is queued on our checker backend and auto-broadcast at the chosen
                  time by the @threespeak account (requires the user to grant threespeak as
                  a posting account_auth on first schedule). */}
              {!fromStories && (
                <div className="schedule-box-wrap">
                  <div className="schedule-wrap toggle-row" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>Schedule this post</span>
                    <label className="toggle-switch">
                      <input
                        type="checkbox"
                        checked={isScheduled}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setIsScheduled(checked);
                          if (checked && !scheduleDateTime) {
                            // Prefill with min (now + 1h) so the input isn't empty.
                            const { minFormatted, minDate } = getMinMaxDates();
                            setScheduleDateTime(minFormatted || minDate?.toISOString().slice(0, 16));
                          }
                        }}
                      />
                      <span className="toggle-track"><span className="toggle-thumb" /></span>
                    </label>
                  </div>
                  {isScheduled && (() => {
                    const { minFormatted, maxFormatted } = getMinMaxDates();
                    return (
                      <div style={{ marginTop: '8px' }}>
                        <input
                          type="datetime-local"
                          value={scheduleDateTime}
                          min={minFormatted}
                          max={maxFormatted}
                          onChange={(e) => setScheduleDateTime(e.target.value)}
                        />
                        <div style={{ fontSize: '0.85em', opacity: 0.7, marginTop: '4px' }}>
                          Range: at least 15 minutes from now, up to 90 days. Posted automatically by @threespeak on your behalf — you'll be asked to authorize this once.
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              <div className="submit-btn-wrap">
                <button
                  onClick={() => {
                    process();
                  }}
                >
                  Proceed
                </button>
              </div>

            </div>

          </div>


        </div>
      </div>
      {isOpen && <CommunityModal isOpen={isOpen} data={communitiesData} close={closeCommunityModal} setCommunity={setCommunity} selected={community} />}
      {benficaryOpen && <Beneficiary_modal
        close={toggleBeneficiaryModal}
        isOpen={benficaryOpen}
        setBeneficiaries={setBeneficiaries}
        setBeneficiaryList={setBeneficiaryList}
        setList={setList}
        list={list}
        setRemaingPercent={setRemaingPercent}
        remaingPercent={remaingPercent}
        variant="embed"
      />}

    </>
  )
}

export default EmbedDetails
