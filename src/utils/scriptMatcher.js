// Pure teleprompter matching logic — no React, so it can be exercised directly.
//
// Given a script tokenised into words, it advances a "read so far" pointer as a
// recognizer reports what was actually said. The pointer only moves FORWARD.

// How many upcoming script words a single spoken word may jump over. Small on
// purpose: a large window lets a common word ("the", "to") match far ahead and
// run the prompter away from the reader.
export const LOOKAHEAD = 4;
// Catch-up ("resync") for when the reader SKIPS — e.g. drops a whole sentence and
// carries on from later in the script. The narrow window can't span that, so once
// enough words in a row fail to match we search the rest of the script for the
// phrase actually being said. A jump needs a run of RESYNC_RUN consecutive words:
// one common word matching far ahead must never fling the prompter somewhere wrong.
export const MISS_BEFORE_RESYNC = 3;
export const RESYNC_RUN = 3;
export const RECENT_MAX = 8;

export function normalize(w) {
  return w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}

/**
 * Split the script into word tokens, remembering how many LINE BREAKS precede
 * each one so the overlay can render the author's paragraphs.
 */
export function tokenize(text) {
  const out = [];
  const lines = String(text || '').split(/\r?\n/);
  let pendingBreaks = 0;
  lines.forEach((line, li) => {
    const wordsOnLine = line.split(/[^\S\r\n]+/).filter(Boolean);
    if (!wordsOnLine.length) {
      if (out.length) pendingBreaks += 1; // blank line → paragraph gap
      return;
    }
    if (li > 0 && out.length) pendingBreaks += 1;
    wordsOnLine.forEach((raw, wi) => {
      out.push({ text: raw, norm: normalize(raw), br: wi === 0 ? pendingBreaks : 0 });
      if (wi === 0) pendingBreaks = 0;
    });
  });
  return out;
}

/** Bounded edit distance — bails out as soon as it exceeds `max`. */
export function levenshtein(a, b, max) {
  const la = a.length;
  const lb = b.length;
  if (Math.abs(la - lb) > max) return max + 1;
  let prev = new Array(lb + 1);
  for (let j = 0; j <= lb; j += 1) prev[j] = j;
  for (let i = 1; i <= la; i += 1) {
    const cur = new Array(lb + 1);
    cur[0] = i;
    let best = cur[0];
    for (let j = 1; j <= lb; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (cur[j] < best) best = cur[j];
    }
    if (best > max) return max + 1;
    prev = cur;
  }
  return prev[lb];
}

/**
 * "Close enough" word comparison. Recognizers mangle words — "recognise" comes
 * back as "recognize", a name loses a letter. Words of 4 letters or fewer must
 * still match EXACTLY: otherwise the/they/then/this start matching each other and
 * the prompter wanders. Longer words get a small tolerance and must share a
 * first letter.
 */
export function fuzzyEqual(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen < 5) return false;
  if (Math.abs(a.length - b.length) > 2) return false;
  if (a[0] !== b[0]) return false;
  const tol = maxLen >= 8 ? 2 : 1;
  return levenshtein(a, b, tol) <= tol;
}

const skipDead = (list, p) => {
  let i = p;
  while (i < list.length && !list[i].norm) i += 1;
  return i;
};

const findIn = (list, from, to, word) => {
  for (let j = from; j < to; j += 1) {
    if (list[j].norm && fuzzyEqual(list[j].norm, word)) return j;
  }
  return -1;
};

/** One spoken word covering TWO script words ("tele prompter" heard as one). */
const findPairIn = (list, from, to, word) => {
  for (let j = from; j < to; j += 1) {
    if (!list[j].norm) continue;
    const k = skipDead(list, j + 1);
    if (k < list.length && fuzzyEqual(list[j].norm + list[k].norm, word)) return k;
  }
  return -1;
};

const matchRunAt = (list, j, seq) => {
  let i = j;
  for (const w of seq) {
    while (i < list.length && !list[i].norm) i += 1;
    if (i >= list.length || !fuzzyEqual(list[i].norm, w)) return -1;
    i += 1;
  }
  return i;
};

/** Where is the reader, anywhere ahead? -1 when not confident. */
const findResync = (list, recent, from) => {
  if (recent.length < RESYNC_RUN) return -1;
  const run = recent.slice(-RESYNC_RUN);
  for (let j = from; j < list.length; j += 1) {
    if (!list[j].norm) continue;
    const end = matchRunAt(list, j, run);
    if (end !== -1) return end; // nearest occurrence ahead wins
  }
  return -1;
};

export function createMatcher(initialWords = []) {
  const st = { words: initialWords, matched: 0, recent: [], miss: 0, resyncs: 0 };

  const remember = (w) => {
    st.recent.push(w);
    if (st.recent.length > RECENT_MAX) st.recent.shift();
  };

  return {
    /**
     * Swap the script. A DIFFERENT list means a different script, so the pointer
     * is reset — keeping it would strand the highlight mid-way through the new
     * text. Callers must pass a stable reference for an unchanged script (the
     * hook memoises on the script string), since identity is the change signal.
     */
    setWords(w) {
      if (w === st.words) return;
      st.words = w;
      st.matched = 0;
      st.recent = [];
      st.miss = 0;
    },
    reset() { st.matched = 0; st.recent = []; st.miss = 0; st.resyncs = 0; },
    get matched() { return st.matched; },
    get resyncs() { return st.resyncs; }, // diagnostics for tests
    get miss() { return st.miss; },

    /** Feed the NEW words heard since last call. Returns the updated pointer. */
    advance(recWords) {
      const list = st.words;
      let p = skipDead(list, st.matched);

      for (let k = 0; k < recWords.length; k += 1) {
        const r = recWords[k];
        if (!r) continue;
        remember(r);
        if (p >= list.length) break;

        const end = Math.min(p + LOOKAHEAD, list.length);

        // 1) straight (or near-miss) match
        let endIdx = findIn(list, p, end, r);

        // 2) the recognizer SPLIT one script word in two: "reshare" → "read share"
        if (endIdx === -1 && k + 1 < recWords.length) {
          const j = findIn(list, p, end, r + recWords[k + 1]);
          if (j !== -1) {
            endIdx = j;
            remember(recWords[k + 1]);
            k += 1; // both spoken words covered this one script word
          }
        }

        // 3) ...or MERGED two script words into one
        if (endIdx === -1) endIdx = findPairIn(list, p, end, r);

        if (endIdx !== -1) {
          p = skipDead(list, endIdx + 1);
          // DECAY rather than clear: an occasional lucky match in the middle of a
          // skipped passage must not wipe the evidence that we're lost, or the
          // resync below never gets to fire.
          st.miss = Math.max(0, st.miss - 1);
          continue;
        }

        st.miss += 1;
        if (st.miss >= MISS_BEFORE_RESYNC) {
          const jumped = findResync(list, st.recent, Math.max(p, st.matched));
          if (jumped !== -1) {
            p = skipDead(list, jumped);
            st.miss = 0;
            st.resyncs += 1;
          }
        }
      }

      if (p > st.matched) st.matched = p;
      return st.matched;
    },
  };
}

export default createMatcher;
