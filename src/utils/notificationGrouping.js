/**
 * Group Hive blockchain notifications into smart clusters.
 *
 * - vote:   group all votes on the same post within a 24-hour window
 * - follow: group consecutive follows together regardless of URL
 * - other:  keep as individual (single) items
 *
 * Each notification is shaped: { id, date, msg, score, type, url }
 */

const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

/**
 * Extract the dollar value from a vote message.
 * Expected format: "@user voted on your post ($0.04)"
 * Returns 0 when no value can be parsed.
 */
function extractVoteValue(msg) {
  if (!msg) return 0;
  const match = msg.match(/\(\$([0-9]+(?:\.[0-9]+)?)\)/);
  return match ? parseFloat(match[1]) : 0;
}

/**
 * Extract the @username actor from a notification message.
 * Returns the first @-mention found, or null.
 */
function extractActor(msg) {
  if (!msg) return null;
  const match = msg.match(/@([a-z0-9._-]+)/i);
  return match ? match[1] : null;
}

/**
 * Build a "single" group wrapper around one notification.
 */
function makeSingle(notif) {
  return {
    id: notif.id,
    type: 'single',
    notifType: notif.type,
    items: [notif],
    date: notif.date,
    notification: notif,
  };
}

/**
 * Build a group object from an array of notifications sharing the same type.
 */
function makeGroup(items, notifType) {
  // Sort items by date descending so items[0] is the latest
  const sorted = [...items].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  const actors = [];
  const seen = new Set();
  for (const n of sorted) {
    const actor = extractActor(n.msg);
    if (actor && !seen.has(actor)) {
      seen.add(actor);
      actors.push(actor);
    }
  }

  const group = {
    id: sorted[0].id,
    type: 'group',
    notifType,
    items: sorted,
    date: sorted[0].date,
    actors,
  };

  if (notifType === 'vote') {
    group.totalValue = sorted.reduce((sum, n) => sum + extractVoteValue(n.msg), 0);
    // Round to avoid floating-point noise
    group.totalValue = Math.round(group.totalValue * 1000) / 1000;
  }

  return group;
}

/**
 * Group an array of notifications into smart clusters.
 *
 * @param {Array<{id, date, msg, score, type, url}>} notifications
 * @returns {Array<Object>} grouped notification objects
 */
export function groupNotifications(notifications) {
  if (!notifications || notifications.length === 0) return [];

  const result = [];

  // ---- Pass 1: bucket votes by URL, within 24-hour windows ----
  // We collect vote groups keyed by URL; each key may produce multiple
  // window-based groups if votes span more than 24 hours apart.
  const votesByUrl = new Map(); // url -> [notif, ...]
  const followBucket = [];
  const others = []; // { index, notif } — preserve original order

  for (let i = 0; i < notifications.length; i++) {
    const n = notifications[i];
    if (n.type === 'vote') {
      const key = n.url || '__no_url__';
      if (!votesByUrl.has(key)) votesByUrl.set(key, []);
      votesByUrl.get(key).push(n);
    } else if (n.type === 'follow') {
      followBucket.push(n);
    } else {
      others.push({ index: i, notif: n });
    }
  }

  // ---- Process vote buckets into 24-hour window groups ----
  const voteGroups = [];
  for (const [, votes] of votesByUrl) {
    // Sort by date ascending for windowing
    const sorted = [...votes].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );

    let windowStart = new Date(sorted[0].date).getTime();
    let currentWindow = [sorted[0]];

    for (let i = 1; i < sorted.length; i++) {
      const ts = new Date(sorted[i].date).getTime();
      if (ts - windowStart <= TWENTY_FOUR_HOURS) {
        currentWindow.push(sorted[i]);
      } else {
        // Flush current window
        voteGroups.push(currentWindow);
        currentWindow = [sorted[i]];
        windowStart = ts;
      }
    }
    // Flush last window
    voteGroups.push(currentWindow);
  }

  // Convert vote windows to group objects
  for (const window of voteGroups) {
    if (window.length === 1) {
      const single = makeSingle(window[0]);
      single.totalValue = extractVoteValue(window[0].msg);
      single.actors = [];
      const actor = extractActor(window[0].msg);
      if (actor) single.actors.push(actor);
      result.push(single);
    } else {
      result.push(makeGroup(window, 'vote'));
    }
  }

  // ---- Process follow bucket (all consecutive follows grouped together) ----
  if (followBucket.length === 1) {
    const single = makeSingle(followBucket[0]);
    single.actors = [];
    const actor = extractActor(followBucket[0].msg);
    if (actor) single.actors.push(actor);
    result.push(single);
  } else if (followBucket.length > 1) {
    result.push(makeGroup(followBucket, 'follow'));
  }

  // ---- Process everything else as singles ----
  for (const { notif } of others) {
    result.push(makeSingle(notif));
  }

  // ---- Sort final result by date descending (most recent first) ----
  result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return result;
}
