import PropTypes from 'prop-types';
import {
  TAG_CATEGORIES, getCategoryOf, getTagLabel, getTagEmoji, isCategorySlug,
} from '../../utils/tagsV2';
import './TagsV2Picker.scss';

/**
 * Tag picker for videos carrying v2 tags (the new closed taxonomy).
 *
 * Two steps, deliberately: pick one of the 7 broad CATEGORIES, then optionally
 * refine to a TOPIC. Stopping at the category is a valid, correct answer — the
 * taxonomy treats a category as a legitimate (coarser) tag, and the category
 * level is both smaller and more reliably right than the topic level.
 *
 * `value` is a single slug (category OR topic), so it drops straight into the
 * existing viewer-tag contract. `tagPct` is a { slug: percent } crowd tally.
 */
function TagsV2Picker({ value, onChange, tagPct = {}, disabled = false, suggested = [] }) {
  const activeCategory = getCategoryOf(value); // a topic rolls up to its category
  const openCategory = TAG_CATEGORIES.find((c) => c.slug === activeCategory) || null;

  const pickCategory = (slug) => {
    if (disabled) return;
    // Clicking the chosen category again clears it (tagging is optional).
    onChange(value === slug ? '' : slug);
  };

  const pickTopic = (slug) => {
    if (disabled) return;
    // Clicking the chosen topic steps back to its (still valid) category.
    onChange(value === slug ? getCategoryOf(slug) : slug);
  };

  const known = suggested.filter(Boolean);

  return (
    <div className="tagsv2-picker" onClick={(e) => e.stopPropagation()}>
      {known.length > 0 && (
        <p className="tagsv2-suggested">
          Auto-tagged: {known.map((s) => `${getTagEmoji(s)} ${getTagLabel(s)}`).join(', ')}
        </p>
      )}

      <div className="tagsv2-row">
        {TAG_CATEGORIES.map((cat) => {
          const isOpen = activeCategory === cat.slug;
          const pct = tagPct[cat.slug];
          return (
            <button
              type="button"
              key={cat.slug}
              className={`tagsv2-cat${isOpen ? ' open' : ''}${value === cat.slug ? ' selected' : ''}`}
              onClick={() => pickCategory(cat.slug)}
              disabled={disabled}
              aria-pressed={isOpen}
            >
              <span className="tagsv2-emoji">{cat.emoji}</span>
              <span className="tagsv2-label">{cat.label}</span>
              {pct != null && <span className="tagsv2-pct">{pct}%</span>}
            </button>
          );
        })}
      </div>

      {openCategory && (
        <div className="tagsv2-topics">
          <p className="tagsv2-hint">
            {isCategorySlug(value)
              ? 'Good enough — or get more specific (optional):'
              : 'More specific:'}
          </p>
          <div className="tagsv2-row">
            {openCategory.topics.map((t) => {
              const pct = tagPct[t.slug];
              return (
                <button
                  type="button"
                  key={t.slug}
                  className={`tagsv2-topic${value === t.slug ? ' selected' : ''}`}
                  onClick={() => pickTopic(t.slug)}
                  disabled={disabled}
                  aria-pressed={value === t.slug}
                >
                  <span className="tagsv2-emoji">{t.emoji}</span>
                  <span className="tagsv2-label">{t.label}</span>
                  {pct != null && <span className="tagsv2-pct">{pct}%</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

TagsV2Picker.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  tagPct: PropTypes.object,
  disabled: PropTypes.bool,
  suggested: PropTypes.array,
};

export default TagsV2Picker;
