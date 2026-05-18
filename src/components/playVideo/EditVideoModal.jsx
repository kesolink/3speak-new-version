import { useState, useEffect, useMemo, useRef } from 'react';
import { getHiveClient } from '../../utils/hiveNode';
import { createPortal } from 'react-dom';
import { IoClose } from 'react-icons/io5';
import { MdImage, MdUpload } from 'react-icons/md';
import { toast } from 'sonner';
import { Client } from '@hiveio/dhive';
import { HIVE_API_NODES } from '../../utils/config';
import { commentWithAioha } from '../../hive-api/aioha';
import { uploadThumbnail } from '../../utils/uploadThumbnail';
import './EditVideoModal.scss';

const hiveClient = getHiveClient();

const TITLE_MIN = 5;
const TITLE_MAX = 250;
const MAX_TAGS = 10;

/**
 * Split a 3Speak post body into three parts:
 *   header  — thumbnail image link + "▶️ Watch on 3Speak" + separator
 *   middle  — the user's actual description (what we let them edit)
 *   footer  — trailing separator + "▶️ [3Speak]" link
 *
 * If the body doesn't match the expected shape, we treat the whole thing as
 * editable middle with empty header/footer — editing then preserves everything.
 */
function splitPostBody(body) {
  if (typeof body !== 'string' || !body) {
    return { header: '', middle: '', footer: '' };
  }

  const src = body.replace(/\r\n/g, '\n');

  // Header pattern:
  //   [![](thumbUrl)](watchUrl)\n\n
  //   ▶️ [Watch on 3Speak](watchUrl)\n\n
  //   ---\n
  // We match leniently: any whitespace between the three pieces, "▶️" optional
  // variants, optional surrounding whitespace.
  const headerRe = new RegExp(
    '^\\s*' +
    // thumbnail image link: [![alt](thumb)](watch)
    '(?:\\[\\s*!\\[[^\\]]*\\]\\([^)]*\\)\\s*\\]\\([^)]*\\)\\s*\\n+)?' +
    // "Watch on 3Speak" line
    '(?:(?:▶️|â–¶ï¸|▶)?\\s*\\[\\s*Watch on 3Speak\\s*\\]\\([^)]*\\)\\s*\\n+)?' +
    // horizontal rule
    '(?:-{3,}\\s*\\n+)?',
    ''
  );

  // Footer pattern (at end of body):
  //   \n---\n\n▶️ [3Speak](watchUrl)\n
  const footerRe = new RegExp(
    '(?:\\n+-{3,}\\s*)?' +
    '\\n+(?:▶️|â–¶ï¸|▶)?\\s*\\[\\s*3Speak\\s*\\]\\([^)]*\\)\\s*$',
    ''
  );

  const headerMatch = src.match(headerRe);
  const header = headerMatch ? headerMatch[0] : '';
  const afterHeader = src.slice(header.length);

  const footerMatch = afterHeader.match(footerRe);
  const footer = footerMatch ? footerMatch[0] : '';
  const middle = footerMatch
    ? afterHeader.slice(0, afterHeader.length - footer.length)
    : afterHeader;

  // If neither header nor footer matched, expose the full body so the author
  // doesn't lose anything on save.
  if (!header && !footer) {
    return { header: '', middle: src, footer: '' };
  }

  return { header, middle: middle.trim(), footer };
}

function recombinePostBody(header, middle, footer) {
  const parts = [];
  if (header) parts.push(header.replace(/\s+$/, ''));
  parts.push((middle ?? '').trim());
  if (footer) parts.push(footer.replace(/^\s+/, ''));
  return parts.filter(Boolean).join('\n\n') + '\n';
}

/**
 * Modal for editing a video post on Hive.
 * Broadcasts a `comment` operation with the same author/permlink to replace
 * on-chain title, body and json_metadata. Video file itself is never touched.
 *
 * @param {boolean} isOpen
 * @param {() => void} onClose
 * @param {string} author          - video author (must equal logged-in user)
 * @param {string} permlink
 * @param {(changes: { title, body, tags, thumbnail }) => void} onSaved
 */
export default function EditVideoModal({ isOpen, onClose, author, permlink, onSaved }) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState(null);

  // Original on-chain post — source of truth for round-trip fidelity.
  const [original, setOriginal] = useState(null);

  // Editable fields
  const [title, setTitle] = useState('');
  const [body, setBody] = useState(''); // middle section only — what the user edits
  const [bodyHeader, setBodyHeader] = useState(''); // 3Speak thumb+link header, rewrite thumb on save
  const [bodyFooter, setBodyFooter] = useState(''); // trailing 3Speak link
  const [tagsInput, setTagsInput] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [thumbUploading, setThumbUploading] = useState(false);
  const thumbInputRef = useRef(null);

  // Fetch original post when modal opens
  useEffect(() => {
    if (!isOpen || !author || !permlink) return;

    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    (async () => {
      try {
        const post = await hiveClient.call('condenser_api', 'get_content', [author, permlink]);
        if (cancelled) return;
        if (!post || !post.author) {
          setLoadError('Could not find this post on Hive.');
          setLoading(false);
          return;
        }

        let meta = {};
        try { meta = JSON.parse(post.json_metadata || '{}'); } catch (_) {}

        // Extract current thumbnail
        let currentThumb = '';
        const sourceMap = meta.video?.info?.sourceMap;
        if (Array.isArray(sourceMap)) {
          const thumbEntry = sourceMap.find((s) => s.type === 'thumbnail');
          if (thumbEntry?.url) currentThumb = thumbEntry.url;
        }
        if (!currentThumb && Array.isArray(meta.image) && meta.image[0]) {
          currentThumb = meta.image[0];
        }

        // Tags: prefer json_metadata.tags (that's what publishers use),
        // fall back to post.category + json_metadata.tags merge minus duplicates
        const metaTags = Array.isArray(meta.tags) ? meta.tags : [];

        const { header, middle, footer } = splitPostBody(post.body || '');

        setOriginal({ post, meta });
        setTitle(post.title || '');
        setBody(middle);
        setBodyHeader(header);
        setBodyFooter(footer);
        setTagsInput(metaTags.join(' '));
        setThumbnailUrl(currentThumb);
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        console.error('Failed to load post for edit:', err);
        setLoadError('Failed to load post from Hive. Please try again.');
        setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [isOpen, author, permlink]);

  // Reset local state when the modal closes
  useEffect(() => {
    if (isOpen) return;
    setOriginal(null);
    setTitle('');
    setBody('');
    setBodyHeader('');
    setBodyFooter('');
    setTagsInput('');
    setThumbnailUrl('');
    setLoadError(null);
    setSaving(false);
  }, [isOpen]);

  // Parse tags input (space/comma separated, lowercased, deduplicated)
  const parsedTags = useMemo(() => {
    if (!tagsInput) return [];
    const raw = tagsInput
      .toLowerCase()
      .split(/[\s,]+/)
      .map((t) => t.trim())
      .filter(Boolean);
    return [...new Set(raw)];
  }, [tagsInput]);

  // Validation
  const titleLen = title.trim().length;
  const titleValid = titleLen >= TITLE_MIN && titleLen <= TITLE_MAX;
  const tagsValid = parsedTags.length > 0 && parsedTags.length <= MAX_TAGS;
  const bodyValid = body.trim().length > 0;
  const canSave = titleValid && tagsValid && bodyValid && !!original && !saving;

  // Has anything actually changed?
  const isDirty = useMemo(() => {
    if (!original) return false;
    const origTags = Array.isArray(original.meta.tags) ? original.meta.tags : [];
    const origThumb = (() => {
      const sm = original.meta.video?.info?.sourceMap;
      if (Array.isArray(sm)) {
        const t = sm.find((s) => s.type === 'thumbnail');
        if (t?.url) return t.url;
      }
      return Array.isArray(original.meta.image) ? (original.meta.image[0] || '') : '';
    })();
    const { middle: origMiddle } = splitPostBody(original.post.body || '');
    return (
      title.trim() !== (original.post.title || '').trim() ||
      body !== origMiddle ||
      parsedTags.join(' ') !== origTags.join(' ') ||
      thumbnailUrl.trim() !== origThumb
    );
  }, [original, title, body, parsedTags, thumbnailUrl]);

  const handleThumbFilePick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-picking the same file
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file.');
      return;
    }
    // 10 MB cap — same ballpark as the uploader
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image too large (max 10 MB).');
      return;
    }
    setThumbUploading(true);
    try {
      const url = await uploadThumbnail(file);
      setThumbnailUrl(url);
      toast.success('Thumbnail uploaded.');
    } catch (err) {
      console.error('Thumbnail upload failed:', err);
      toast.error(err?.message || 'Thumbnail upload failed.');
    } finally {
      setThumbUploading(false);
    }
  };

  const handleSave = async (e) => {
    e?.preventDefault?.();
    if (!canSave) return;
    if (!isDirty) {
      toast.info('No changes to save.');
      return;
    }

    setSaving(true);
    try {
      const { post, meta } = original;

      // Build new json_metadata preserving the original structure
      const newMeta = { ...meta };
      newMeta.tags = parsedTags;

      // Update thumbnail references in both `image` and `video.info.sourceMap`
      const trimmedThumb = thumbnailUrl.trim();
      if (trimmedThumb) {
        newMeta.image = Array.isArray(newMeta.image)
          ? [trimmedThumb, ...newMeta.image.filter((u) => u !== trimmedThumb)]
          : [trimmedThumb];

        if (newMeta.video?.info?.sourceMap && Array.isArray(newMeta.video.info.sourceMap)) {
          const sm = newMeta.video.info.sourceMap.map((s) =>
            s.type === 'thumbnail' ? { ...s, url: trimmedThumb } : s
          );
          // If no existing thumbnail entry, add one
          if (!sm.some((s) => s.type === 'thumbnail')) {
            sm.push({ type: 'thumbnail', url: trimmedThumb });
          }
          newMeta.video = { ...newMeta.video, info: { ...newMeta.video.info, sourceMap: sm } };
        }
      }

      // Rewrite the thumbnail URL inside the header's image-link, if a header
      // exists and the thumbnail changed. The pattern is [![...](OLD)](watch).
      let finalHeader = bodyHeader;
      if (trimmedThumb && finalHeader) {
        finalHeader = finalHeader.replace(
          /(\[\s*!\[[^\]]*\]\()[^)]*(\)\s*\]\([^)]*\))/,
          `$1${trimmedThumb}$2`
        );
      }

      // Rebuild the full post body: preserved header + user-edited middle + preserved footer
      const finalBody = recombinePostBody(finalHeader, body, bodyFooter);

      const result = await commentWithAioha(
        post.parent_author || '',
        post.parent_permlink || '',
        permlink,
        title.trim(),
        finalBody,
        newMeta,
        null // don't touch comment_options on edit — can't be changed after first broadcast
      );

      if (!result?.success) {
        throw new Error(result?.error || 'Broadcast failed');
      }

      toast.success('Video updated!');
      onSaved?.({
        title: title.trim(),
        body: finalBody,
        tags: parsedTags,
        thumbnail: trimmedThumb,
      });
      onClose();
    } catch (err) {
      console.error('Edit save failed:', err);
      toast.error(err?.message || 'Failed to save changes.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="edit-video-modal-overlay" onClick={onClose}>
      <div className="edit-video-modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="edit-video-close-btn" onClick={onClose} aria-label="Close">
          <IoClose size={22} />
        </button>

        <h3 className="edit-video-title">Edit Video</h3>
        <p className="edit-video-subtitle">@{author}/{permlink}</p>

        {loading && (
          <div className="edit-video-loading">Loading current post…</div>
        )}

        {loadError && !loading && (
          <div className="edit-video-error">{loadError}</div>
        )}

        {!loading && !loadError && original && (
          <form className="edit-video-form" onSubmit={handleSave}>
            {/* Thumbnail */}
            <label className="edit-video-label">Thumbnail</label>
            <div className="edit-video-thumb-row">
              {thumbnailUrl ? (
                <img
                  className="edit-video-thumb-preview"
                  src={thumbnailUrl}
                  alt="Thumbnail preview"
                  onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }}
                  onLoad={(e) => { e.currentTarget.style.visibility = 'visible'; }}
                />
              ) : (
                <div className="edit-video-thumb-placeholder"><MdImage size={32} /></div>
              )}
              <div className="edit-video-thumb-inputs">
                <input
                  type="url"
                  className="edit-video-input"
                  value={thumbnailUrl}
                  onChange={(e) => setThumbnailUrl(e.target.value)}
                  placeholder="https://..."
                  disabled={thumbUploading}
                />
                <button
                  type="button"
                  className="edit-video-upload-btn"
                  onClick={() => thumbInputRef.current?.click()}
                  disabled={thumbUploading || saving}
                  title="Upload an image"
                >
                  <MdUpload size={16} />
                  {thumbUploading ? 'Uploading…' : 'Upload'}
                </button>
                <input
                  ref={thumbInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handleThumbFilePick}
                />
              </div>
            </div>
            <span className="edit-video-hint">
              Upload an image or paste a direct URL. Leave unchanged to keep the current thumbnail.
            </span>

            {/* Title */}
            <label className="edit-video-label">Title</label>
            <input
              type="text"
              className="edit-video-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={TITLE_MAX}
            />
            <span className={`edit-video-hint${!titleValid && title ? ' error' : ''}`}>
              {titleLen}/{TITLE_MAX} · min {TITLE_MIN}
            </span>

            {/* Tags */}
            <label className="edit-video-label">Tags</label>
            <input
              type="text"
              className="edit-video-input"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="space-separated"
            />
            <div className="edit-video-tags-preview">
              {parsedTags.map((t) => <span key={t}>#{t}</span>)}
            </div>
            <span className={`edit-video-hint${!tagsValid && parsedTags.length ? ' error' : ''}`}>
              {parsedTags.length}/{MAX_TAGS} tags · at least 1 required
            </span>

            {/* Body */}
            <label className="edit-video-label">Description</label>
            <textarea
              className="edit-video-textarea"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={10}
              placeholder="Tell viewers about your video…"
            />
            <span className="edit-video-hint">
              Supports markdown. The 3Speak video embed at the top and bottom of
              your post is preserved automatically.
            </span>

            <div className="edit-video-actions">
              <button
                type="button"
                className="edit-video-btn-secondary"
                onClick={onClose}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="edit-video-btn-primary"
                disabled={!canSave || !isDirty}
              >
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body
  );
}
