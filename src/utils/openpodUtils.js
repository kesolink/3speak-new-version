import { resolveSnapsContainer } from './snapsContainer';

// Returns { author, permlink } for the newest @peak.snaps container. The
// lookup itself (multi-node, multi-API, retried) lives in snapsContainer.js.
export async function fetchLatestSnapsPost() {
  return resolveSnapsContainer();
}

export function buildOpenPodSnapBody(roomTitle, roomUrl, thumbnailUrl) {
  const thumbnail = thumbnailUrl ? `![${roomTitle || 'OpenPod'}](${thumbnailUrl})\n\n` : '';
  return `${thumbnail}🎙️ **${roomTitle || 'OpenPod Live'}**\n\nI just started an OpenPod — come join the conversation!\n\n${roomUrl}`;
}

export function buildOpenPodPermlink() {
  return `openpod-${Date.now()}`;
}

export function buildOpenPodSnapMetadata(roomName) {
  return {
    app: '3speak/openpod',
    format: 'markdown',
    tags: ['3speak', 'openpod', 'hive-181335'],
    type: 'openpod',
    room: roomName,
  };
}
