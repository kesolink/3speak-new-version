import { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import {
  TAG_CATEGORIES, getCategoryOf, getTagLabel, getTagEmoji, isCategorySlug,
} from '../../utils/tagsV2';
import './TagsV2Picker.scss';

/**
 * Two-level topic-tree picker over the v2 taxonomy (7 CATEGORIES → 27 TOPICS).
 *
 * SINGLE mode (default, the vote/tag dialog): `value` is a single slug. Pick one
 * of the 7 broad CATEGORIES, then optionally refine to a TOPIC. Stopping at the
 * category is a valid, coarser tag.
 *
 * MULTI mode (the Interests picker): `value` is an ARRAY of topic slugs and
 * `onChange` receives the next array. Categories act as accordion headers with a
 * count badge; the selectable interests are the topics.
 *
 * `searchable` adds a filter box that flattens the tree to the matching topics
 * (and, in single mode, categories) so a topic can be found without navigating.
 */
function TagsV2Picker({
  value, onChange, tagPct = {}, disabled = false, suggested = [],
  multi = false, searchable = false,
}) {
  const selectedArr = multi && Array.isArray(value) ? value : [];
  const selectedSet = useMemo(() => new Set(selectedArr), [selectedArr]);
  const isSel = (slug) => (multi ? selectedSet.has(slug) : value === slug);

  // Which category's topics are shown. Single mode derives it from the selected
  // value; multi mode tracks it locally (there's no single value), opening the
  // first category that already has a selection so returning users see it.
  const [openCatMulti, setOpenCatMulti] = useState(() => {
    if (!multi) return null;
    const cat = TAG_CATEGORIES.find((c) => c.topics.some((t) => selectedSet.has(t.slug)));
    return cat ? cat.slug : null;
  });
  const activeCategory = multi ? openCatMulti : getCategoryOf(value);
  const openCategory = TAG_CATEGORIES.find((c) => c.slug === activeCategory) || null;

  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();

  // Search → flat list of matches. Topics always; categories only in single mode
  // (they aren't selectable interests in multi).
  const matches = useMemo(() => {
    if (!q) return null;
    const out = [];
    for (const cat of TAG_CATEGORIES) {
      if (!multi && cat.label.toLowerCase().includes(q)) {
        out.push({ slug: cat.slug, label: cat.label, emoji: cat.emoji, isCat: true });
      }
      for (const t of cat.topics) {
        if (t.label.toLowerCase().includes(q)) {
          out.push({ slug: t.slug, label: t.label, emoji: t.emoji, isCat: false });
        }
      }
    }
    return out;
  }, [q, multi]);

  const toggleMulti = (slug) => {
    onChange(selectedSet.has(slug) ? selectedArr.filter((s) => s !== slug) : [...selectedArr, slug]);
  };

  const pickCategory = (slug) => {
    if (disabled) return;
    if (multi) setOpenCatMulti((prev) => (prev === slug ? null : slug)); // expand/collapse
    else onChange(value === slug ? '' : slug);                            // select/clear
  };

  const pickTopic = (slug) => {
    if (disabled) return;
    if (multi) toggleMulti(slug);
    else onChange(value === slug ? getCategoryOf(slug) : slug); // topic → back to category
  };

  const pickResult = (m) => {
    if (disabled) return;
    if (multi) toggleMulti(m.slug);
    else onChange(value === m.slug ? '' : m.slug);
  };

  const catCount = (cat) => cat.topics.reduce((n, t) => n + (selectedSet.has(t.slug) ? 1 : 0), 0);

  const known = suggested.filter(Boolean);

  const renderTopic = (t) => {
    const pct = tagPct[t.slug];
    return (
      <button
        type="button"
        key={t.slug}
        className={`tagsv2-topic${isSel(t.slug) ? ' selected' : ''}`}
        onClick={() => pickTopic(t.slug)}
        disabled={disabled}
        aria-pressed={isSel(t.slug)}
      >
        <span className="tagsv2-emoji">{t.emoji}</span>
        <span className="tagsv2-label">{t.label}</span>
        {pct != null && <span className="tagsv2-pct">{pct}%</span>}
      </button>
    );
  };

  return (
    <div className="tagsv2-picker" onClick={(e) => e.stopPropagation()}>
      {known.length > 0 && (
        <p className="tagsv2-suggested">
          Auto-tagged: {known.map((s) => `${getTagEmoji(s)} ${getTagLabel(s)}`).join(', ')}
        </p>
      )}

      {searchable && (
        <input
          type="search"
          className="tagsv2-search"
          placeholder="Search topics…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={disabled}
          aria-label="Search topics"
        />
      )}

      {q ? (
        matches.length === 0 ? (
          <p className="tagsv2-hint">No topics match “{query}”.</p>
        ) : (
          <div className="tagsv2-row">
            {matches.map((m) => (
              <button
                type="button"
                key={m.slug}
                className={`${m.isCat ? 'tagsv2-cat' : 'tagsv2-topic'}${isSel(m.slug) ? ' selected' : ''}`}
                onClick={() => pickResult(m)}
                disabled={disabled}
                aria-pressed={isSel(m.slug)}
              >
                <span className="tagsv2-emoji">{m.emoji}</span>
                <span className="tagsv2-label">{m.label}</span>
              </button>
            ))}
          </div>
        )
      ) : (
        <>
          <div className="tagsv2-row">
            {TAG_CATEGORIES.map((cat) => {
              const isOpen = activeCategory === cat.slug;
              const pct = tagPct[cat.slug];
              const cnt = multi ? catCount(cat) : 0;
              return (
                <button
                  type="button"
                  key={cat.slug}
                  className={`tagsv2-cat${isOpen ? ' open' : ''}${value === cat.slug ? ' selected' : ''}${cnt > 0 ? ' has-selected' : ''}`}
                  onClick={() => pickCategory(cat.slug)}
                  disabled={disabled}
                  aria-pressed={isOpen}
                >
                  <span className="tagsv2-emoji">{cat.emoji}</span>
                  <span className="tagsv2-label">{cat.label}</span>
                  {cnt > 0 && <span className="tagsv2-count">{cnt}</span>}
                  {pct != null && <span className="tagsv2-pct">{pct}%</span>}
                </button>
              );
            })}
          </div>

          {openCategory && (
            <div className="tagsv2-topics">
              <p className="tagsv2-hint">
                {multi
                  ? 'Pick the topics you care about:'
                  : isCategorySlug(value)
                    ? 'Good enough — or get more specific (optional):'
                    : 'More specific:'}
              </p>
              <div className="tagsv2-row">
                {openCategory.topics.map(renderTopic)}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

TagsV2Picker.propTypes = {
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.array]),
  onChange: PropTypes.func.isRequired,
  tagPct: PropTypes.object,
  disabled: PropTypes.bool,
  suggested: PropTypes.array,
  multi: PropTypes.bool,
  searchable: PropTypes.bool,
};

export default TagsV2Picker;
