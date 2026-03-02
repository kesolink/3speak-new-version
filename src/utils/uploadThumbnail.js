import { IMAGE_UPLOAD_URL, IMAGE_UPLOAD_KEY } from './config';

// In dev, always use the Vite proxy to avoid CORS issues.
// In production, use the configured IMAGE_UPLOAD_URL directly.
const BASE_URL = import.meta.env.DEV ? '/image-api' : IMAGE_UPLOAD_URL;

/**
 * Upload a thumbnail image to the 3Speak image service.
 * @param {Blob|File} file - The image file to upload
 * @returns {Promise<string>} The public URL of the uploaded image
 */
export async function uploadThumbnail(file) {
  const formData = new FormData();
  formData.append('image', file);

  const res = await fetch(`${BASE_URL}/upload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${IMAGE_UPLOAD_KEY}`,
    },
    body: formData,
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.error?.name || `Image upload failed (${res.status})`);
  }

  const data = await res.json();
  if (!data.success || !data.url) {
    throw new Error('Image upload returned no URL');
  }

  return data.url;
}
