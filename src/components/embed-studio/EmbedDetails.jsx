import React, { useEffect, useRef } from 'react'
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
    originalAuthor, originalPermlink,
    startEarlyUpload,
  } = useEmbedUpload();

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

  if (!selectedThumbnail) {
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
              {!fromStories && (
                <div className="community-box-wrap">
                  <div className="community-wrap" onClick={openCommunityModal}>
                    {community ? <span>{community === "hive-181335" ? <div className="wrap"><img src={`https://images.hive.blog/u/hive-181335/avatar`} alt="" /><span></span>Threespeak</div> : <div className="wrap"><img src={`https://images.hive.blog/u/${community.name}/avatar`} alt="" /><span></span>{community.title}</div>}</span> : <span> Select Community </span>}
                    <IoIosArrowDropdownCircle size={16} />
                  </div>
                  <span>Select Community </span>
                </div>
              )}

              <div className="advance-option">
                <div className="beneficiary-wrap mb">
                  <div className="wrap">
                    <span>Rewards Distribution</span>
                    <span>Optional "Hive Reward Pool" distribution method.</span>
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
                    <span>Beneficiaries</span>
                    <span>Other accounts that should get a % of the post rewards.</span>
                  </div>
                  <div className="bene-btn-wrap" onClick={toggleBeneficiaryModal}>
                    {list.length > 0 && <spa>{list.length}</spa>}
                    <span> BENEFICIARIES</span>
                    <MdPeopleAlt />
                  </div>
                </div>
                <div className="beneficiary-wrap" style={{ marginTop: '12px' }}>
                  <div className="wrap">
                    <span>Allow Remix/Clip</span>
                    <span>Allow others to create remixes and clips from this video. You will be credited as original author and receive a minimum of 5% in beneficiaries.</span>
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
                <div className="beneficiary-wrap" style={{ marginTop: '12px' }}>
                  <div className="wrap">
                    <span>Mark as adult / NSFW</span>
                    <span>Flags this video as adult content. It will be hidden from feeds and search for viewers who haven't enabled NSFW, and tagged <code>nsfw</code> across Hive.</span>
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
              </div>

              {/* Schedule section — only for regular videos (not shorts). When toggled on,
                  the post is queued on our checker backend and auto-broadcast at the chosen
                  time by the @threespeak account (requires the user to grant threespeak as
                  a posting account_auth on first schedule). */}
              {!fromStories && (
                <div className="schedule-box-wrap" style={{ marginTop: '12px' }}>
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
