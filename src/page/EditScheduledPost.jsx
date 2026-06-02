import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { MdPeopleAlt } from 'react-icons/md';
import { useAppStore } from '../lib/store';
import { signMessageWithAioha, KeyTypes } from '../hive-api/aioha';
import { getMinMaxDates, formatDateTimeLocal } from '../utils/schedulingHelpers';
import { uploadThumbnail } from '../utils/uploadThumbnail';
import MarkdownComposer from '../components/studio/MarkdownComposer';
import Beneficiary_modal from '../components/modal/Beneficiary_modal';
// Bring in the legacy studio's stylesheet so .studio-main-container, .input-group,
// .preview-tags, .advance-option, .bene-btn-wrap, .submit-btn-wrap, etc. all look
// exactly like the embed-studio uploader.
import '../components/legacy-studio/StudioPage.scss';
import './EditScheduledPost.scss';

const CHECKER_BASE =
  import.meta.env.VITE_SCHEDULED_POSTS_API_URL || 'https://prod-checker.okinoko.io';

function tagsToText(tags) {
  return Array.isArray(tags) ? tags.join(' ') : '';
}
function tagsFromText(text) {
  return String(text || '')
    .split(/[\s,]+/)
    .map(t => t.trim().toLowerCase())
    .filter(Boolean)
    .filter((t, i, a) => a.indexOf(t) === i);
}

// Convert stored beneficiaries (weight in basis points, 10000 = 100%) → modal
// list shape (percent, 0–100). The modal is shared with the embed-studio composer.
// Mirrors the studio's default: @threespeakfund is always present at >=10%,
// flagged `locked` so the modal renders it without a delete control and only
// allows raising — never reducing or removing — its share.
const TS_FUND_ACCOUNT = 'threespeakfund';
const TS_FUND_MIN_PERCENT = 10;

function benesToList(bs) {
  const items = Array.isArray(bs) ? bs : [];
  let tsFundFound = false;
  const mapped = items.map((b) => {
    if (b.account === TS_FUND_ACCOUNT) {
      tsFundFound = true;
      const pct = Math.max(TS_FUND_MIN_PERCENT, (Number(b.weight) || 0) / 100);
      return { account: TS_FUND_ACCOUNT, percent: pct, locked: true, minPercent: TS_FUND_MIN_PERCENT };
    }
    return { account: b.account, percent: (Number(b.weight) || 0) / 100 };
  });
  if (!tsFundFound) {
    mapped.unshift({
      account: TS_FUND_ACCOUNT,
      percent: TS_FUND_MIN_PERCENT,
      locked: true,
      minPercent: TS_FUND_MIN_PERCENT,
    });
  }
  return mapped;
}
// And back — what we POST to the checker's /update endpoint.
function listToBenes(list) {
  return (Array.isArray(list) ? list : [])
    .map((b) => ({
      account: String(b.account || '').trim().toLowerCase(),
      weight: Math.max(0, Math.min(10000, Math.round((Number(b.percent) || 0) * 100))),
    }))
    .filter((b) => b.account && b.weight > 0)
    .sort((a, b) => a.account.localeCompare(b.account));
}

export default function EditScheduledPost() {
  const { permlink } = useParams();
  const { user } = useAppStore();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [post, setPost] = useState(null);
  const [error, setError] = useState(null);

  // Edit fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tagsInputValue, setTagsInputValue] = useState('');
  const [tagsPreview, setTagsPreview] = useState([]);
  const [thumbnail, setThumbnail] = useState(null);
  const [thumbnailUploading, setThumbnailUploading] = useState(false);
  const [payoutOptions, setPayoutOptions] = useState('default');
  const [scheduleDateTime, setScheduleDateTime] = useState('');

  // Beneficiary modal state — same contract as EmbedUploadContext.
  const [isBeneficiaryModalOpen, setIsBeneficiaryModalOpen] = useState(false);
  const [list, setList] = useState([]);            // [{account, percent}]
  const [, setBeneficiaries] = useState('');        // modal writes a string here (unused by us)
  const [, setBeneficiaryList] = useState([]);      // modal side-effect counter (unused by us)
  const [remaingPercent, setRemaingPercent] = useState(100);

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user || !permlink) return;
    setLoading(true);
    axios
      .get(`${CHECKER_BASE.replace(/\/$/, '')}/scheduled-posts/${encodeURIComponent(user)}`, {
        params: { status: 'scheduled', limit: 100 },
      })
      .then((res) => {
        const found = (res.data?.scheduled_posts || []).find((p) => p.permlink === permlink);
        if (!found) {
          setError('Scheduled post not found (it may have already been published or cancelled).');
          return;
        }
        setPost(found);
        setTitle(found.title || '');
        setDescription(found.description || '');
        const t = Array.isArray(found.tags) ? found.tags : [];
        setTagsPreview(t);
        setTagsInputValue(tagsToText(t));
        setThumbnail(found.thumbnail || null);
        setPayoutOptions(found.payoutOptions || 'default');
        setScheduleDateTime(
          found.scheduledOn ? formatDateTimeLocal(new Date(found.scheduledOn)) : '',
        );
        const benList = benesToList(found.beneficiaries);
        setList(benList);
        const used = benList.reduce((s, b) => s + (b.percent || 0), 0);
        setRemaingPercent(Math.max(0, 100 - used));
      })
      .catch((err) => setError(err?.message || 'Failed to load scheduled post'))
      .finally(() => setLoading(false));
  }, [user, permlink]);

  // Tags input — same parsing flow as EmbedDetails: type in the box, preview chips below.
  function handleTagChange(e) {
    const value = e.target.value;
    setTagsInputValue(value);
    setTagsPreview(tagsFromText(value));
  }

  async function onPickThumbnail(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setThumbnailUploading(true);
    try {
      const url = await uploadThumbnail(file, user);
      setThumbnail(url);
      toast.success('Thumbnail uploaded');
    } catch (err) {
      console.error('thumbnail upload:', err);
      toast.error(err?.message || 'Thumbnail upload failed');
    } finally {
      setThumbnailUploading(false);
    }
  }

  function toggleBeneficiaryModal() {
    setIsBeneficiaryModalOpen((v) => !v);
  }

  async function handleSave() {
    if (!post) return;
    setSaving(true);
    try {
      const cleanedBenes = listToBenes(list);
      const totalWeight = cleanedBenes.reduce((s, b) => s + b.weight, 0);
      if (totalWeight > 10000) {
        throw new Error(`Beneficiaries total ${totalWeight / 100}% exceeds 100%`);
      }
      const scheduledOnIso = new Date(scheduleDateTime).toISOString();
      const timestamp = Date.now();
      const message = ['scheduled-post', 'update', user, permlink, String(timestamp)].join('|');
      const { result: signature } = await signMessageWithAioha(
        message,
        KeyTypes.Posting,
        'Sign to save changes to this scheduled post',
      );
      const url = `${CHECKER_BASE.replace(/\/$/, '')}/scheduled-posts/update`;
      const resp = await axios.post(url, {
        owner: user,
        permlink,
        updates: {
          title,
          description,
          scheduledOn: scheduledOnIso,
          thumbnail,
          tags: tagsPreview,
          payoutOptions,
          beneficiaries: cleanedBenes,
        },
        timestamp,
        signature,
      });
      if (!resp.data?.success) throw new Error(resp.data?.error || 'Update failed');
      toast.success('Scheduled post updated');
      navigate('/draft');
    } catch (err) {
      console.error('update scheduled post:', err);
      toast.error(err?.response?.data?.error || err?.message || 'Update failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleCancel() {
    if (!post) return;
    if (!window.confirm('Cancel this scheduled post? It will not be broadcast.')) return;
    setSaving(true);
    try {
      const timestamp = Date.now();
      const message = ['scheduled-post', 'cancel', user, permlink, String(timestamp)].join('|');
      const { result: signature } = await signMessageWithAioha(
        message,
        KeyTypes.Posting,
        'Sign to cancel this scheduled post',
      );
      const url = `${CHECKER_BASE.replace(/\/$/, '')}/scheduled-posts/cancel`;
      await axios.post(url, { owner: user, permlink, timestamp, signature });
      toast.success('Scheduled post cancelled');
      navigate('/draft');
    } catch (err) {
      console.error('cancel scheduled post:', err);
      toast.error(err?.response?.data?.error || err?.message || 'Cancel failed');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="studio-main-container"><p style={{ padding: 20 }}>Loading…</p></div>;
  if (error) {
    return (
      <div className="studio-main-container">
        <div className="studio-page-header"><h1>Edit scheduled post</h1></div>
        <div className="studio-page-content"><p style={{ padding: '0 20px' }}>{error}</p></div>
      </div>
    );
  }
  if (!post) return null;

  const { minFormatted, maxFormatted } = getMinMaxDates();

  return (
    <>
      <div className="studio-main-container edit-scheduled-page">
        <div className="studio-page-header">
          <h1>Edit scheduled post</h1>
          <p className="permlink-line">
            Permlink: <code>{permlink}</code>
          </p>
        </div>

        <div className="studio-page-content">
          <div className="video-detail-wrap">
            <div className="video-items">

              <div className="input-group">
                <label>Title</label>
                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>

              <div className="input-group">
                <label>Description</label>
                <div className="wrap-dec">
                  <MarkdownComposer
                    value={description}
                    onChange={setDescription}
                    placeholder="Write your video description here... Supports markdown formatting!"
                  />
                </div>
              </div>

              <div className="input-group">
                <label>Thumbnail</label>
                <div className="thumbnail-edit-row">
                  {thumbnail ? (
                    <img className="thumbnail-edit-preview" src={thumbnail} alt="thumbnail" />
                  ) : (
                    <div className="thumbnail-edit-preview thumbnail-edit-preview--placeholder">
                      No thumbnail
                    </div>
                  )}
                  <div className="thumbnail-edit-controls">
                    <label className="thumbnail-edit-btn">
                      {thumbnailUploading ? 'Uploading…' : (thumbnail ? 'Replace' : 'Upload')}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={onPickThumbnail}
                        disabled={thumbnailUploading}
                      />
                    </label>
                    {thumbnail && (
                      <button
                        type="button"
                        className="thumbnail-edit-btn thumbnail-edit-btn--ghost"
                        onClick={() => setThumbnail(null)}
                        disabled={thumbnailUploading}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="input-group">
                <label>Tag</label>
                <input type="text" value={tagsInputValue} onChange={handleTagChange} />
                <div className="wrap">
                  <span>Separate multiple tags with </span> <span>Space</span>
                </div>
                <div className="preview-tags">
                  <span>
                    {tagsPreview.map((item, index) => (
                      <span className="item" key={index} style={{ marginRight: '8px' }}>{item}</span>
                    ))}
                  </span>
                </div>
              </div>

              <div className="advance-option">
                <div className="beneficiary-wrap mb">
                  <div className="wrap">
                    <span>Rewards Distribution</span>
                    <span>Optional "Hive Reward Pool" distribution method.</span>
                  </div>
                  <div className="select-wrap">
                    <select value={payoutOptions} onChange={(e) => setPayoutOptions(e.target.value)}>
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
                    {list.length > 0 && <span>{list.length}</span>}
                    <span> BENEFICIARIES</span>
                    <MdPeopleAlt />
                  </div>
                </div>
              </div>

              <div className="schedule-box-wrap" style={{ marginTop: '12px' }}>
                <div className="input-group">
                  <label>Scheduled for</label>
                  <input
                    type="datetime-local"
                    value={scheduleDateTime}
                    min={minFormatted}
                    max={maxFormatted}
                    onChange={(e) => setScheduleDateTime(e.target.value)}
                  />
                  <div className="wrap">
                    <span>Range: at least 15 minutes from now, up to 90 days.</span>
                  </div>
                </div>
              </div>

              <div className="submit-btn-wrap">
                <button onClick={handleSave} disabled={saving || thumbnailUploading}>
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
                <button
                  type="button"
                  className="es-btn-secondary"
                  onClick={() => navigate('/draft')}
                  disabled={saving}
                >
                  Back
                </button>
                <button
                  type="button"
                  className="es-btn-danger"
                  onClick={handleCancel}
                  disabled={saving}
                >
                  Cancel scheduled post
                </button>
              </div>

            </div>
          </div>
        </div>
      </div>

      {/* Conditional render — the modal's base CSS is fullscreen-fixed with no
          display:none fallback, so it appears as soon as it's mounted regardless
          of the `isOpen` prop. EmbedDetails uses the same pattern. */}
      {isBeneficiaryModalOpen && (
        <Beneficiary_modal
          isOpen={isBeneficiaryModalOpen}
          close={toggleBeneficiaryModal}
          setBeneficiaries={setBeneficiaries}
          setBeneficiaryList={setBeneficiaryList}
          setList={setList}
          list={list}
          setRemaingPercent={setRemaingPercent}
          remaingPercent={remaingPercent}
        />
      )}
    </>
  );
}
