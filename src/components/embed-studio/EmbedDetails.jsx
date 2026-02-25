import React, { useEffect } from 'react'
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
        originalAuthor, originalPermlink,
      } = useEmbedUpload();

  const isRemix = !!(originalAuthor && originalPermlink);


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


const handleTagChange = (e) => {
  const value = e.target.value.toLowerCase();

  const tags = value
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  const uniqueTags = [...new Set(tags)];

  if (uniqueTags.length > 10) {
    toast.error("You can add a maximum of 10 tags");
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
          <MarkdownComposer value={description} onChange={setDescription} placeholder={fromStories ? "Describe your short..." : "Write your video description here... Supports markdown formatting!"} />
          </div>
        </div>

        {!fromStories && (
        <div className="input-group">
          <label htmlFor="">Tag</label>
          <input type="text" value={tagsInputValue} onChange={handleTagChange}  />

          <div className="wrap">
          <span>Separate multiple tags with </span> <span>Space</span>
          </div>
          {/* Show the tags */}
        <div className="preview-tags">
        {tagsPreview &&<span> {tagsPreview.map((item, index) => (
      <span className="item" key={index} style={{ marginRight: '8px' }}>
        {item}
      </span>
    ))}</span>}
        </div>
        </div>
        )}
        {!fromStories && (
        <div className="community-box-wrap">
        <div className="community-wrap" onClick={openCommunityModal}>
            {community ? <span>{community === "hive-181335" ? <div className="wrap"><img src={`https://images.hive.blog/u/hive-181335/avatar`} alt="" /><span></span>Threespeak</div> : <div className="wrap"><img src={`https://images.hive.blog/u/${community.name}/avatar`} alt="" /><span></span>{community.title}</div> }</span> : <span> Select Community </span> }
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
           <span>Allow others to create remixes and clips from this video.</span>
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
        </div>

        {/* Schedule section hidden for now */}

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
          {isOpen && <CommunityModal isOpen={isOpen} data={communitiesData} close={closeCommunityModal} setCommunity={setCommunity} />}
          {benficaryOpen && <Beneficiary_modal
              close={toggleBeneficiaryModal}
              isOpen={benficaryOpen}
              setBeneficiaries={setBeneficiaries}
              setBeneficiaryList={setBeneficiaryList}
              setList={setList}
              list={list}
              setRemaingPercent={setRemaingPercent}
              remaingPercent={remaingPercent}
          />}

      </>
  )
}

export default EmbedDetails
