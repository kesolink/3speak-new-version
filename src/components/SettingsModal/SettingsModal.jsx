import { createPortal } from 'react-dom';
import { IoClose } from 'react-icons/io5';
import { useAppStore } from '../../lib/store';
import { APP_VERSION } from '../../version';
import { getHiveUrl } from '../../utils/hiveNode';
import './SettingsModal.scss';

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
  const { theme, showNsfw, setShowNsfw, toggleTheme, sidebarHidden, setSidebarHidden } = useAppStore();
  if (!isOpen) return null;

  return createPortal(
    <div className="settings-modal-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-modal-header">
          <h3>Settings</h3>
          <button className="settings-modal-close" onClick={onClose} aria-label="Close">
            <IoClose size={20} />
          </button>
        </div>

        <div className="settings-section">
          <h4 className="settings-section-title">Content</h4>
          <Row
            title="Show NSFW content"
            desc="Display videos and audio marked not-safe-for-work. Off by default."
            checked={showNsfw}
            onChange={(v) => setShowNsfw(v)}
          />
        </div>

        <div className="settings-section">
          <h4 className="settings-section-title">Appearance</h4>
          <Row
            title="Dark mode"
            desc="Use the dark colour theme across the app."
            checked={theme === 'dark'}
            onChange={(wantDark) => { if ((theme === 'dark') !== wantDark) toggleTheme(); }}
          />
          <Row
            title="Hide sidebar"
            desc="Collapse the left navigation sidebar for a wider content area."
            checked={!!sidebarHidden}
            onChange={(hide) => setSidebarHidden(hide)}
          />
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
      </div>
    </div>,
    document.body,
  );
}
