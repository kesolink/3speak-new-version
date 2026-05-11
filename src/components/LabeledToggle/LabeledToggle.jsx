import './LabeledToggle.scss';

/**
 * Two-state segmented toggle with labels on each side.
 *
 * Props:
 *   leftLabel, rightLabel  — text shown on each side
 *   value (bool)           — false = left active, true = right active
 *   onChange(next: bool)
 *   ariaLabel              — describes what the toggle controls (for screen readers)
 */
function LabeledToggle({ leftLabel, rightLabel, value, onChange, ariaLabel }) {
  return (
    <div
      className={`labeled-toggle${value ? ' is-right' : ' is-left'}`}
      role="switch"
      aria-checked={value}
      aria-label={ariaLabel}
    >
      <button
        type="button"
        className={`labeled-toggle-side${!value ? ' active' : ''}`}
        onClick={() => onChange(false)}
      >
        {leftLabel}
      </button>
      <button
        type="button"
        className={`labeled-toggle-side${value ? ' active' : ''}`}
        onClick={() => onChange(true)}
      >
        {rightLabel}
      </button>
    </div>
  );
}

export default LabeledToggle;
