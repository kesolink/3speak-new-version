import { useLayoutEffect, useState } from 'react';

/**
 * Measurement hooks for dropping full-width shorts rails INTO a Card3 grid.
 *
 * Shared by the home feed and the watch page's recommendation list. Both hooks
 * take a ref to a wrapper that CONTAINS a `.card-container` (what Card3 renders)
 * and observe it live.
 *
 * Two deliberate choices, both learned the hard way:
 *
 *  - useLayoutEffect, NOT useEffect: it runs after the DOM is written but BEFORE
 *    the browser paints, so a rail lands in the SAME paint as the grid instead of
 *    appearing a beat later and shoving the grid down.
 *
 *  - Observe the ROOT (always mounted) and re-query `.card-container` on every
 *    measure — never resolve it once. The grid mounts asynchronously (panels show
 *    skeletons until their data is in) and that mount doesn't necessarily change
 *    these hooks' deps. Resolving once meant bailing out while the skeletons were
 *    up and never re-measuring when the grid finally arrived, so the rails only
 *    appeared after a tab switch forced a re-run.
 *
 * A hidden container (`display: none`) measures 0 and both hooks return 0 — which
 * is what we want on the watch page, where the desktop and mobile recommendation
 * lists are both mounted and CSS picks one.
 */

function observeRoot(root, measure) {
  const cleanups = [];
  if (typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(measure);
    ro.observe(root);                                       // width changes → re-measure
    cleanups.push(() => ro.disconnect());
  }
  if (typeof MutationObserver !== 'undefined') {
    const mo = new MutationObserver(measure);
    mo.observe(root, { childList: true, subtree: true });   // grid mounts → measure
    cleanups.push(() => mo.disconnect());
  }
  return () => cleanups.forEach((fn) => fn());
}

/**
 * How many columns the card grid is CURRENTLY rendering. The grid is
 * `repeat(auto-fill, minmax(...))`, so the count is decided by the browser at the
 * live width — we can't infer it from a breakpoint. Read it back off the computed
 * style, so "every N rows" means N REAL rows.
 */
export function useGridColumns(rootRef, deps) {
  const [cols, setCols] = useState(0);
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    const measure = () => {
      const grid = root.querySelector('.card-container');
      if (!grid) { setCols((p) => (p === 0 ? p : 0)); return; }
      const tpl = getComputedStyle(grid).gridTemplateColumns || '';
      // "220px 220px 220px" -> 3. `none` (not yet laid out) -> 0.
      const n = tpl === 'none' ? 0 : tpl.split(/\s+/).filter(Boolean).length;
      setCols((prev) => (prev === n ? prev : n));
    };
    measure();
    return observeRoot(root, measure);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rootRef, deps]);
  return cols;
}

// Shorts card sizing. The rail is a full row (not a scroller), so the caller must
// hand it EXACTLY as many shorts as fit — one too many and it wraps to a second
// line, one too few and the row comes up short.
const SHORT_MIN_W = 150;        // desktop minimum card width
const SHORT_MIN_W_PHONE = 104;  // phones fit ~3 across instead of 2
const SHORT_GAP = 16;
const SHORT_GAP_PHONE = 10;

/** How many shorts fit across the grid at its CURRENT width. */
export function useShortsPerRow(rootRef, deps) {
  const [n, setN] = useState(0);
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    const measure = () => {
      const grid = root.querySelector('.card-container');
      const w = grid?.clientWidth || 0;
      if (!w) { setN((p) => (p === 0 ? p : 0)); return; }
      const phone = window.matchMedia('(max-width: 600px)').matches;
      const min = phone ? SHORT_MIN_W_PHONE : SHORT_MIN_W;
      const gap = phone ? SHORT_GAP_PHONE : SHORT_GAP;
      // How many `min`-wide cards + gaps fit in w. The tracks are 1fr, so whatever
      // fits then stretches to fill the width exactly.
      const fit = Math.max(2, Math.floor((w + gap) / (min + gap)));
      setN((prev) => (prev === fit ? prev : fit));
    };
    measure();
    return observeRoot(root, measure);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rootRef, deps]);
  return n;
}
