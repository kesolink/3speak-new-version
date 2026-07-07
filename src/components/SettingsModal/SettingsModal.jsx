import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { IoClose } from 'react-icons/io5';
import { toast } from 'sonner';
import { useAppStore } from '../../lib/store';
import { APP_VERSION } from '../../version';
import { getHiveUrl } from '../../utils/hiveNode';
import { INTERESTS, fetchUserInterests, saveInterestsToHive } from '../../utils/interests';
import './SettingsModal.scss';

const sameSet = (a, b) =>
  JSON.stringify([...(a || [])].sort()) === JSON.stringify([...(b || [])].sort());

// Interests picker — canonical copy lives in the user's Hive posting_json_metadata.
// Rendered only while the modal is open, so its hooks mount/unmount with it.
function InterestsSection() {
  const { interests, setInterests, user } = useAppStore();
  const [hydrating, setHydrating] = useState(false);
  const [saving, setSaving] = useState(false);
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
    setInterests(selected.has(id) ? interests.filter((x) => x !== id) : [...interests, id]);
  };

  const save = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const list = await saveInterestsToHive(user, interests);
      savedRef.current = list;
      setInterests(list);
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
      {user && (
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

/**
 * Settings popup — the toggles that used to live inline in the profile
 * side menu, now grouped with headers + explanations and compact switches.
 */
export default function SettingsModal({ isOpen, onClose }) {
  const { theme, showNsfw, setShowNsfw, toggleTheme, sidebarHidden, setSidebarHidden, homeCardSize, setHomeCardSize, previewEnabled, setPreviewEnabled, hideWatched, setHideWatched } = useAppStore();
  const [tab, setTab] = useState('general');
  if (!isOpen) return null;

  // The left sidebar only exists on desktop, so its toggle is irrelevant on mobile/tablet.
  const isDesktop = window.matchMedia('(min-width: 1025px)').matches;
  // Previews only work on touch devices in large mode, so hide the toggle when
  // a touch user has small cards selected (it would have no effect).
  const isTouch = !window.matchMedia('(hover: hover)').matches;
  const showPreviewSetting = !isTouch || homeCardSize === 'large';

  return createPortal(
    <div className="settings-modal-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-modal-header">
          <h3>Settings</h3>
          <button className="settings-modal-close" onClick={onClose} aria-label="Close">
            <IoClose size={20} />
          </button>
        </div>

        <div className="settings-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'general'}
            className={`settings-tab${tab === 'general' ? ' active' : ''}`}
            onClick={() => setTab('general')}
          >
            General
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'content'}
            className={`settings-tab${tab === 'content' ? ' active' : ''}`}
            onClick={() => setTab('content')}
          >
            Interests
          </button>
        </div>

        {tab === 'general' && (
          <>
            <div className="settings-section">
              <h4 className="settings-section-title">Appearance</h4>
              <Row
                title="Dark mode"
                desc="Use the dark colour theme across the app."
                checked={theme === 'dark'}
                onChange={(wantDark) => { if ((theme === 'dark') !== wantDark) toggleTheme(); }}
              />
              {isDesktop && (
                <Row
                  title="Hide sidebar"
                  desc="Collapse the left navigation sidebar for a wider content area."
                  checked={!!sidebarHidden}
                  onChange={(hide) => setSidebarHidden(hide)}
                />
              )}
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
            </div>

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
          </>
        )}

        {tab === 'content' && (
          <>
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
            </div>

            <InterestsSection />
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
