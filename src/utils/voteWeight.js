// Remembers the vote weight the user last voted with, so the slider comes back
// where they left it instead of resetting to 100% every time.
//
// Posts, shorts and comments are kept SEPARATE on purpose: people commonly
// full-weight a video, burn through shorts at a much lower weight, and give
// comments a different slice again — one shared value would fight them on every
// vote. Comments on a short still count as comments.

const KEYS = {
  post: '3speak_vote_weight_post',
  short: '3speak_vote_weight_short',
  comment: '3speak_vote_weight_comment',
};

export const DEFAULT_VOTE_WEIGHT = 100;

const keyFor = (kind) => KEYS[kind] || KEYS.post;

// The slider's range is 1–100; anything outside (or unparseable) falls back.
const clamp = (n) => Math.max(1, Math.min(100, Math.round(n)));

/** Last weight used for this kind, or the default when nothing is stored. */
export function getSavedVoteWeight(kind) {
  try {
    const raw = localStorage.getItem(keyFor(kind));
    if (raw == null) return DEFAULT_VOTE_WEIGHT;
    const n = Number(raw);
    return Number.isFinite(n) ? clamp(n) : DEFAULT_VOTE_WEIGHT;
  } catch {
    return DEFAULT_VOTE_WEIGHT; // private mode / storage disabled
  }
}

/** Persist the weight actually voted with. Never throws. */
export function saveVoteWeight(kind, weight) {
  const n = Number(weight);
  if (!Number.isFinite(n)) return;
  try {
    localStorage.setItem(keyFor(kind), String(clamp(n)));
  } catch { /* storage unavailable — remembering is best-effort */ }
}
