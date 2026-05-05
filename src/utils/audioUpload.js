import axios from 'axios';
import { THREESPEAK_AUDIO_API_URL, THREESPEAK_API_KEY, HIVE_API_URL } from './config';

/**
 * Resolve the latest peak.snaps container post — used as the parent for snap-style replies.
 * Mirrors snapie-io's `getLastSnapsContainer` (lib/hive/client-functions.ts).
 */
export async function getSnapsContainer() {
  const author = 'peak.snaps';
  const beforeDate = new Date().toISOString().split('.')[0];
  const { data } = await axios.post(HIVE_API_URL, {
    jsonrpc: '2.0',
    id: 1,
    method: 'condenser_api.get_discussions_by_author_before_date',
    params: [author, '', beforeDate, 1],
  });
  const container = data?.result?.[0];
  if (!container?.permlink) throw new Error('No peak.snaps container found');
  return { author, permlink: container.permlink };
}

/**
 * Upload an audio blob to the 3Speak audio service.
 * Mirrors snapie-io's `uploadAudioTo3Speak` contract:
 *   POST {THREESPEAK_AUDIO_API_URL}/api/audio/upload
 *   Headers: X-API-Key, X-User
 *   Body: multipart/form-data { audio, duration, format, title }
 *   Response: { success, permlink, cid, playUrl, apiUrl }
 */
export async function uploadAudioTo3Speak({ blob, durationSec, username, title }) {
  if (!THREESPEAK_API_KEY) {
    throw new Error('VITE_3SPEAK_API_KEY is not set');
  }
  if (!username) throw new Error('No username');
  if (!blob) throw new Error('No audio data');

  const isMp3 = (blob.type || '').includes('mpeg') || (blob.type || '').includes('mp3');
  const format = isMp3 ? 'mp3' : 'webm';

  const fd = new FormData();
  fd.append('audio', blob, `recording.${format}`);
  fd.append('duration', String(Math.max(0, Math.round(durationSec || 0))));
  fd.append('format', format);
  fd.append('title', title || `Audio by ${username}`);

  const resp = await fetch(`${THREESPEAK_AUDIO_API_URL}/api/audio/upload`, {
    method: 'POST',
    headers: {
      'X-API-Key': THREESPEAK_API_KEY,
      'X-User': username,
    },
    body: fd,
  });

  if (!resp.ok) {
    let msg = `Upload failed (${resp.status})`;
    try {
      const data = await resp.json();
      msg = data.error || data.message || msg;
    } catch {}
    throw new Error(msg);
  }

  const data = await resp.json();
  // Normalize http→https on returned URLs (snapie does the same)
  const playUrl = data.playUrl?.replace(/^http:/, 'https:') || data.playUrl;
  const apiUrl = data.apiUrl?.replace(/^http:/, 'https:') || data.apiUrl;

  return {
    permlink: data.permlink,
    cid: data.cid,
    playUrl,
    apiUrl,
  };
}
