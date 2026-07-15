import { useSyncExternalStore } from 'react';

/**
 * Videos the CHECKER has confirmed are dead, this page load.
 *
 * A card whose media is gone plays nothing, so once we know it's dead it should
 * leave the grid immediately rather than sit there until the next feed fetch.
 *
 * Membership comes ONLY from the server's verdict — never from the 404 the browser
 * saw. A single-gateway 404 is not proof: 3Speak moves content off the hot IPFS zone
 * after a while, so a healthy old video 404s on `hotipfs-3speak-1` while
 * `ipfs.3speak.tv` still serves it. Pulling cards on the browser's 404 would make
 * perfectly good videos vanish from people's feeds. So the client reports, the server
 * re-checks every gateway, and only a confirmed ban lands here.
 *
 * Session-scoped and deliberately not persisted: the feed itself excludes these
 * videos from the next request, so this only has to cover the grid already on screen.
 */
const dead = new Set();
const listeners = new Set();

export const videoKey = (author, permlink) =>
  author && permlink ? `${String(author).toLowerCase()}/${permlink}` : null;

/** Called when the checker confirms a video is gone. */
export function markVideoDead(author, permlink) {
  const key = videoKey(author, permlink);
  if (!key || dead.has(key)) return;
  dead.add(key);
  // New Set identity so useSyncExternalStore sees a change.
  snapshot = new Set(dead);
  listeners.forEach((fn) => fn());
}

export function isVideoDead(author, permlink) {
  const key = videoKey(author, permlink);
  return !!key && dead.has(key);
}

let snapshot = new Set();
const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const getSnapshot = () => snapshot;

/**
 * Re-renders the caller whenever a video is confirmed dead. Returns the Set so a grid
 * can filter its own list. Empty on the common path, so this costs nothing until
 * something actually dies.
 */
export function useDeadVideos() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
