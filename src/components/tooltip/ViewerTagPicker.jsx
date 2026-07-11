import PropTypes from 'prop-types';
import { VIEWER_TAG_OPTIONS } from '../../utils/viewerTag';
import './ViewerTagPicker.scss';

/**
 * Tile list for picking a video's topic in the vote dialog. Replaces the old
 * <select>. Order: voted topics first (highest % → lowest, ties alphabetical),
 * then the rest alphabetically. Clicking the selected tile clears it (tagging is
 * optional). `tagPct` is a { tagId: percent } map from the crowd consensus.
 */
function ViewerTagPicker({ value, onChange, tagPct = {}, disabled = false }) {
  const sorted = [...VIEWER_TAG_OPTIONS].sort((a, b) => {
    const pa = tagPct[a.id];
    const pb = tagPct[b.id];
    const va = pa != null;
    const vb = pb != null;
    if (va && vb) return pb - pa || a.label.localeCompare(b.label); // voted: % desc, then name
    if (va !== vb) return va ? -1 : 1;                              // voted before unvoted
    return a.label.localeCompare(b.label);                         // both unvoted: alphabetical
  });

  return (
    <div className="viewer-tag-tiles" onClick={(e) => e.stopPropagation()}>
      {sorted.map((t) => {
        const pct = tagPct[t.id];
        const selected = value === t.id;
        return (
          <button
            type="button"
            key={t.id}
            className={`vtag-tile${selected ? ' selected' : ''}${pct != null ? ' voted' : ''}`}
            onClick={() => !disabled && onChange(selected ? '' : t.id)}
            disabled={disabled}
            aria-pressed={selected}
          >
            {t.emoji && <span className="vtag-emoji">{t.emoji}</span>}
            <span className="vtag-label">{t.label}</span>
            {pct != null && <span className="vtag-pct">{pct}%</span>}
          </button>
        );
      })}
    </div>
  );
}

ViewerTagPicker.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  tagPct: PropTypes.object,
  disabled: PropTypes.bool,
};

export default ViewerTagPicker;
