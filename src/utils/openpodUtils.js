import axios from 'axios';

const HIVE_API_URL = 'https://api.hive.blog';

export async function fetchLatestSnapsPost() {
  const res = await axios.post(HIVE_API_URL, {
    jsonrpc: '2.0',
    method: 'bridge.get_account_posts',
    params: { sort: 'posts', account: 'peak.snaps', start_author: '', start_permlink: '', limit: 1 },
    id: 1,
  });
  const post = res.data?.result?.[0];
  if (!post) throw new Error('No posts found from @peak.snaps');
  return post;
}

export function buildOpenPodSnapBody(roomTitle, roomUrl) {
  return `🎙️ **${roomTitle || 'OpenPod Live'}**\n\nI just started an OpenPod — come join the conversation!\n\n${roomUrl}`;
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
