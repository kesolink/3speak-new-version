import { IMAGE_UPLOAD_URL, IMAGE_UPLOAD_KEY, EMBED_API_KEY } from './config';
import { signMessageWithAioha, isLoggedIn } from '../hive-api/aioha';
import { KeyTypes } from '@aioha/aioha';

// Our backend (:4021) signs the hive.blog image challenge as @threespeak.
const THREESPEAK_API = import.meta.env.VITE_THREESPEAK_API || '/api';
// 3Speak image server (fallback). In dev use the Vite proxy to avoid CORS.
const THREESPEAK_BASE = import.meta.env.DEV ? '/image-api' : IMAGE_UPLOAD_URL;

// Primary: @threespeak backend signs the images.hive.blog "ImageSigningChallenge"
// and uploads on our behalf. Works for every login (no client-side signing), and
// is how covers/thumbnails go up now that posts are broadcast by @threespeak.
async function uploadViaThreespeak(file) {
  const res = await fetch(`${THREESPEAK_API}/upload-image`, {
    method: 'POST',
    headers: {
      'Content-Type': file.type || 'application/octet-stream',
      'X-API-Key': EMBED_API_KEY,
    },
    body: file,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.url) {
    throw new Error(data.error || `@threespeak image upload failed (${res.status})`);
  }
  return data.url;
}
// images.hive.blog (primary) goes through a same-origin nginx proxy so the
// browser never makes a cross-origin request (mirrors how snapie-io proxies it
// server-side). nginx /hive-image-api/ → https://images.hive.blog/.
const HIVE_IMAGE_BASE = '/hive-image-api';

function readFileAsBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      reader.result ? resolve(Buffer.from(reader.result)) : reject(new Error('Failed to read file'));
    reader.onerror = () => reject(new Error('Error reading file'));
    reader.readAsArrayBuffer(file);
  });
}

// Primary: images.hive.blog, authenticated with a posting-key signature over the
// standard "ImageSigningChallenge" + image-bytes challenge (same construction as
// snapie-io's uploadImageWithKeychain).
async function uploadToHive(file, username) {
  const fileContent = await readFileAsBuffer(file);
  const challengeBuffer = Buffer.concat([Buffer.from('ImageSigningChallenge'), fileContent]);
  const challengeString = JSON.stringify(challengeBuffer);

  const { result: signature } = await signMessageWithAioha(challengeString, KeyTypes.Posting);

  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${HIVE_IMAGE_BASE}/${username}/${signature}`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`hive.blog upload failed (${res.status}) ${errText}`.trim());
  }
  const data = await res.json();
  if (!data.url) throw new Error('hive.blog upload returned no URL');
  return data.url;
}

// Fallback: 3Speak image server (Bearer API key).
async function uploadTo3Speak(file) {
  const formData = new FormData();
  formData.append('image', file);

  const res = await fetch(`${THREESPEAK_BASE}/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${IMAGE_UPLOAD_KEY}` },
    body: formData,
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.error?.name || `3Speak image upload failed (${res.status})`);
  }
  const data = await res.json();
  if (!data.success || !data.url) throw new Error('3Speak image upload returned no URL');
  return data.url;
}

/**
rebase  * Upload a thumbnail/cover image. Primary path is the @threespeak backend (signs
 * the hive.blog challenge server-side — works for every login). Falls back to the
 * user-signed hive.blog path (when a username is given and not preferStatic) and
 * finally the 3Speak image server, so an upload never hard-fails on one outage.
 * @param {Blob|File} file - The image file to upload
 * @param {string} [username] - Hive username; enables the user-signed fallback
 * @param {object} [opts]
 * @param {boolean} [opts.preferStatic] - Skip the user-signed hive.blog fallback
 *   (it can't run for HiveSigner anyway). The @threespeak path is tried regardless.
 * @returns {Promise<string>} The public URL of the uploaded image
 */
export async function uploadThumbnail(file, username, { preferStatic = false } = {}) {
  // Primary: @threespeak signs + uploads on our behalf.
  try {
    return await uploadViaThreespeak(file);
  } catch (e) {
    console.warn('@threespeak image upload failed, falling back:', e?.message);
  }
  // Fallback 1: user-signed hive.blog (needs a username + a wallet that can sign).
  if (!preferStatic && username && isLoggedIn()) {
    try {
      return await uploadToHive(file, username);
    } catch (e) {
      console.warn('hive.blog (user-signed) upload failed, falling back to 3Speak:', e?.message);
    }
  }
  // Fallback 2: 3Speak image server (static key).
  return await uploadTo3Speak(file);
}
