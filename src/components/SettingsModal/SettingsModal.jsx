import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { IoClose } from 'react-icons/io5';
import { toast } from 'sonner';
import { useAppStore } from '../../lib/store';
import { APP_VERSION } from '../../version';
import { getHiveUrl } from '../../utils/hiveNode';
import { INTERESTS, fetchUserInterests, saveInterestsToHive } from '../../utils/interests';
import DataRequestForm from './DataRequestForm';
import './SettingsModal.scss';

const sameSet = (a, b) =>
  JSON.stringify([...(a || [])].sort()) === JSON.stringify([...(b || [])].sort());

// Interests picker — canonical copy lives in the user's Hive posting_json_metadata.
// Rendered only while the modal is open, so its hooks mount/unmount with it.
function InterestsSection() {
  const { interests, setInterests, user } = useAppStore();
  const [hydrating, setHydrating] = useState(false);
  const [saving, setSaving] = useState(false);
  // Transient "Saved" confirmation shown right after a save. Resets when the
  // modal (and this section) unmounts, so reopening settings never shows it.
  const [justSaved, setJustSaved] = useState(false);
  const savedRef = useRef(null); // last-known on-chain selection

  // Hydrate from Hive on open (Hive is canonical); keep local cache as fallback.
  useEffect(() => {
    if (!user) return;
    let alive = true;
    setHydrating(true);
    fetchUserInterests(user)
      .then((server) => {
        if (alive && server != null) { setInterests(server); savedRef.current = server; }
      })
      .finally(() => { if (alive) setHydrating(false); });
    return () => { alive = false; };
  }, [user]);

  const selected = new Set(interests || []);
  const dirty = savedRef.current == null
    ? (interests || []).length > 0
    : !sameSet(interests, savedRef.current);

  const toggle = (id) => {
    setJustSaved(false); // a fresh change → back to a "Save" CTA
    setInterests(selected.has(id) ? interests.filter((x) => x !== id) : [...interests, id]);
  };

  const save = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const list = await saveInterestsToHive(user, interests);
      savedRef.current = list;
      setInterests(list);
      setJustSaved(true);
      toast.success('Interests saved to your Hive profile');
    } catch (e) {
      toast.error(e?.message || 'Could not save interests');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="settings-section">
      <h4 className="settings-section-title">
        Interests{hydrating && <span className="settings-interests-status"> · loading…</span>}
      </h4>
      <p className="settings-interests-hint">
        Pick the topics you care about — we’ll use them to show you more of the content you like.
        {!user && ' Log in to choose your interests.'}
      </p>
      <div className="settings-interests-grid">
        {INTERESTS.map(({ id, label, emoji }) => (
          <button
            key={id}
            type="button"
            className={`settings-interest-chip${selected.has(id) ? ' selected' : ''}`}
            onClick={() => toggle(id)}
            disabled={!user || saving}
            aria-pressed={selected.has(id)}
          >
            <span className="settings-interest-emoji">{emoji}</span>
            {label}
          </button>
        ))}
      </div>
      {/* Only shown when there's something to save, while saving, or right after
          a save (the transient "Saved" confirmation). Hidden otherwise. */}
      {user && (dirty || saving || justSaved) && (
        <div className="settings-interests-actions">
          <button
            type="button"
            className="settings-interests-save"
            onClick={save}
            disabled={!dirty || saving}
          >
            {saving ? 'Saving…' : dirty ? 'Save interests' : 'Saved'}
          </button>
        </div>
      )}
    </div>
  );
}

// Small inline switch (replaces the big LabeledToggle in this dialog).
function Switch({ checked, onChange, ariaLabel }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      className={`settings-switch${checked ? ' on' : ''}`}
      onClick={() => onChange(!checked)}
    >
      <span className="settings-switch-knob" />
    </button>
  );
}

function Row({ title, desc, checked, onChange }) {
  return (
    <div className="settings-modal-row">
      <div className="settings-row-text">
        <span className="settings-row-title">{title}</span>
        <span className="settings-row-desc">{desc}</span>
      </div>
      <Switch checked={checked} onChange={onChange} ariaLabel={title} />
    </div>
  );
}

const TABS = [
  { id: 'general', label: 'General' },
  { id: 'shorts', label: 'Shorts' },
  { id: 'content', label: 'Content' },
  { id: 'interests', label: 'Interests' },
  { id: 'about', label: 'About / Contact' },
];

/**
 * Settings popup — the toggles that used to live inline in the profile
 * side menu, now grouped with headers + explanations and compact switches.
 */
export default function SettingsModal({ isOpen, onClose }) {
  const { theme, showNsfw, setShowNsfw, toggleTheme, sidebarHidden, setSidebarHidden, homeCardSize, setHomeCardSize, previewEnabled, setPreviewEnabled, shortsCommentBar, setShortsCommentBar, openShortsOnStart, setOpenShortsOnStart, inlineShorts, setInlineShorts, hideWatched, setHideWatched, privateMode, setPrivateMode, simpleFeed, setSimpleFeed } = useAppStore();
  const [tab, setTab] = useState('general');

  // Lock background page scroll while the modal is open (restore on close).
  useEffect(() => {
    if (!isOpen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [isOpen]);

  // ── Pin the dialog's top-left corner where it lands on open ──
  // The overlay flex-CENTRES the dialog, so a taller tab pushes the top edge
  // upward and the whole thing visibly jumps as you switch tabs. We let it centre
  // once, measure where it landed, then switch to fixed top/left so it only ever
  // grows/shrinks DOWNWARD from that spot.
  //
  // Not on mobile: there it's a bottom sheet and must stay pinned to the bottom.
  const modalRef = useRef(null);
  const [anchor, setAnchor] = useState(null);

  useLayoutEffect(() => {
    if (!isOpen) { setAnchor(null); return undefined; }
    // Bottom sheet (<=640px, see the SCSS) must not be anchored.
    if (!window.matchMedia('(min-width: 641px)').matches) { setAnchor(null); return undefined; }

    // anchor===null → currently centred, so this measurement is the "opened" spot.
    if (!anchor && modalRef.current) {
      const r = modalRef.current.getBoundingClientRect();
      setAnchor({ top: r.top, left: r.left });
    }

    // On resize the stored coords are stale — drop the anchor so it re-centres and
    // the effect measures the new spot on the next pass.
    const onResize = () => setAnchor(null);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [isOpen, anchor]);

  if (!isOpen) return null;

  // The left sidebar only exists on desktop, so its toggle is irrelevant on mobile/tablet.
  const isDesktop = window.matchMedia('(min-width: 1025px)').matches;
  // Previews only work on touch devices in large mode, so hide the toggle when
  // a touch user has small cards selected (it would have no effect).
  const isTouch = !window.matchMedia('(hover: hover)').matches;
  const showPreviewSetting = !isTouch || homeCardSize === 'large';
  // The shorts comment bar is rendered only under 768px (see Short.scss), so its
  // toggle would do nothing on desktop/tablet. Gate it on the SAME breakpoint —
  // `isDesktop` (>=1025px) would wrongly still show it on a tablet.
  const showShortsCommentBarSetting = window.matchMedia('(max-width: 768px)').matches;

  return createPortal(
    <div className="settings-modal-overlay" onClick={onClose}>
      <div
        className="settings-modal"
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
        style={anchor ? {
          position: 'fixed',
          top: anchor.top,
          left: anchor.left,
          // Anchored at a fixed top, a tall tab would otherwise run off the bottom
          // of the screen — cap it to the room actually left below the anchor and
          // let the content scroll inside.
          maxHeight: `calc(100vh - ${Math.round(anchor.top)}px - 16px)`,
        } : undefined}
      >
        <div className="settings-modal-header">
          <h3>Settings</h3>
          <button className="settings-modal-close" onClick={onClose} aria-label="Close">
            <IoClose size={20} />
          </button>
        </div>

        <div className="settings-tabs" role="tablist">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              className={`settings-tab${tab === id ? ' active' : ''}`}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'general' && (
          <div className="settings-section">
            <h4 className="settings-section-title">Appearance</h4>
            <Row
              title="Dark mode"
              desc="Use the dark colour theme across the app."
              checked={theme === 'dark'}
              onChange={(wantDark) => { if ((theme === 'dark') !== wantDark) toggleTheme(); }}
            />
            <Row
              title="Large cards"
              desc="Show bigger video cards on the home, profile and playlist pages. Turn off for smaller, more compact cards."
              checked={homeCardSize === 'large'}
              onChange={(large) => setHomeCardSize(large ? 'large' : 'small')}
            />
            {showPreviewSetting && (
              <Row
                title="Video previews"
                desc="Play a muted preview when you hover a video card (and, on mobile in large mode, the centred card auto-plays as you scroll)."
                checked={previewEnabled !== false}
                onChange={(v) => setPreviewEnabled(v)}
              />
            )}
            <Row
              title="Simple feeds"
              desc="Turn off the recommendation algorithm — Discover, Interests and Trending become plain newest-first lists instead of ranked ones."
              checked={!!simpleFeed}
              onChange={(v) => setSimpleFeed(v)}
            />
            {/* The sidebar only exists on desktop, so this is hidden on mobile/tablet. */}
            {isDesktop && (
              <Row
                title="Hide sidebar"
                desc="Collapse the left navigation sidebar for a wider content area."
                checked={!!sidebarHidden}
                onChange={(hide) => setSidebarHidden(hide)}
              />
            )}
          </div>
        )}

        {tab === 'shorts' && (
          <div className="settings-section">
            <h4 className="settings-section-title">Shorts</h4>
            {/* Comment bar is only rendered under 768px, so it's hidden on desktop. */}
            {showShortsCommentBarSetting && (
              <Row
                title="Comment bar on shorts"
                desc="Show a comment input under a short. Off by default — you can always open the comments panel with the comment button."
                checked={!!shortsCommentBar}
                onChange={(v) => setShortsCommentBar(v)}
              />
            )}
            <Row
              title="Open shorts on start"
              desc="Go straight to Shorts when you open 3Speak, instead of the home feed."
              checked={!!openShortsOnStart}
              onChange={(v) => setOpenShortsOnStart(v)}
            />
            <Row
              title="Shorts inside the feeds"
              desc="Show rows of shorts between the videos in the home feeds and the recommendations on a watch page. Turn off to keep those lists videos-only."
              checked={inlineShorts !== false}
              onChange={(v) => setInlineShorts(v)}
            />
          </div>
        )}

        {tab === 'content' && (
          <div className="settings-section">
            <h4 className="settings-section-title">Content</h4>
            <Row
              title="Show NSFW content"
              desc="Display videos and audio marked not-safe-for-work. Off by default."
              checked={showNsfw}
              onChange={(v) => setShowNsfw(v)}
            />
            <Row
              title="Hide watched videos"
              desc="Leave out videos you've already watched from the home, trending and recommended feeds."
              checked={!!hideWatched}
              onChange={(v) => setHideWatched(v)}
            />
            <Row
              title="Private mode"
              desc="Keep your country out of creators' statistics. We never store your IP address — for anyone. It's turned into a country code the moment you press play and then discarded. With this on, not even that country is recorded for your views."
              checked={!!privateMode}
              onChange={(v) => setPrivateMode(v)}
            />
          </div>
        )}

        {tab === 'interests' && <InterestsSection />}

        {tab === 'about' && (
          <>
            <div className="settings-section">
              <h4 className="settings-section-title">About</h4>
              <div className="settings-modal-row">
                <div className="settings-row-text">
                  <span className="settings-row-title">App version</span>
                  <span className="settings-row-desc">v{APP_VERSION}</span>
                </div>
              </div>
              <div className="settings-modal-row">
                <div className="settings-row-text">
                  <span className="settings-row-title">Hive RPC node</span>
                  <span className="settings-row-desc">{getHiveUrl()}</span>
                </div>
              </div>
            </div>

            <div className="settings-section">
              <h4 className="settings-section-title">Your data</h4>
              <DataRequestForm />
            </div>

            <div className="settings-section">
              <div className="settings-modal-row">
                <div className="settings-row-text">
                  <span className="settings-row-title">Your data</span>
                  <span className="settings-row-desc">
                    <a href="/privacy" target="_blank" rel="noopener noreferrer">
                      How 3Speak handles your data
                    </a>
                  </span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
