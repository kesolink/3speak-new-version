import { Buffer } from "buffer";
import bs58 from "bs58";
import fallbackImg from "../assets/image/speak.jpg";

const APP_BUNNY_IPFS_CDN = "https://ipfs-3speak.b-cdn.net";
const APP_IMAGE_CDN_DOMAIN = "https://media.3speak.tv";

export { fallbackImg };

export function fixVideoThumbnail(video) {
  console.log('🟡 [fixVideoThumbnail] Processing video:', video);
  const thumbnail = video?.images?.thumbnail || video?.thumbUrl || video?.spkvideo?.thumbnail_url || video?.thumbnailUrl || video?.thumbnail;
  console.log('🟡 [fixVideoThumbnail] Extracted thumbnail:', thumbnail);
  console.log('🟡 [fixVideoThumbnail] Available thumbnail fields:', {
    'images.thumbnail': video?.images?.thumbnail,
    'thumbUrl': video?.thumbUrl,
    'spkvideo.thumbnail_url': video?.spkvideo?.thumbnail_url,
    'thumbnailUrl': video?.thumbnailUrl,
    'thumbnail': video?.thumbnail
  });

  // Validate thumbnail exists and is not just whitespace
  if (!thumbnail || typeof thumbnail !== 'string' || thumbnail.trim() === '') {
    console.log('🔴 [fixVideoThumbnail] No valid thumbnail found, using fallback');
    return fallbackImg;
  }

  const cleanThumbnail = thumbnail.trim();

  // 🧠 Handle malformed double-embedded URLs (IPFS path containing full HTTP URLs)
  if (cleanThumbnail.includes('/ipfs/http')) {
    console.log('🔴 [fixVideoThumbnail] Detected double-embedded URL, extracting inner URL:', cleanThumbnail);
    // Extract the actual HTTP URL from the malformed path
    const match = cleanThumbnail.match(/\/ipfs\/(https?:\/\/.+)/);
    if (match && match[1]) {
      return match[1]; // Return the inner URL directly
    }
  }

  // 🧠 Handle IPFS URLs
  if (cleanThumbnail.includes("ipfs://")) {
    const ipfsHash = cleanThumbnail.replace("ipfs://", "").trim();
    // Validate IPFS hash exists
    if (!ipfsHash || ipfsHash === '') {
      console.log('🔴 [fixVideoThumbnail] Empty IPFS hash, using fallback');
      return fallbackImg;
    }
    const result = `${APP_BUNNY_IPFS_CDN}/ipfs/${ipfsHash}`;
    console.log('🟣 [fixVideoThumbnail] IPFS URL detected, converted to:', result);
    return result;
  }

  // 🧠 If already using images.hive.blog, return as-is (avoid double-proxying)
  if (cleanThumbnail.includes("images.hive.blog")) {
    console.log('🟣 [fixVideoThumbnail] Already proxied, returning as-is:', cleanThumbnail);
    return cleanThumbnail;
  }

  // 🧠 Handle media.3speak.tv URLs with Hive proxy
  if (cleanThumbnail.includes(APP_IMAGE_CDN_DOMAIN)) {
    const encoded = bs58.encode(Buffer.from(cleanThumbnail));
    const result = `https://images.hive.blog/p/${encoded}?format=jpeg&mode=cover&width=340&height=191`;
    console.log('🟣 [fixVideoThumbnail] media.3speak.tv URL, proxying through Hive:', result);
    return result;
  }

  // 🧠 Handle regular HTTP URLs with Hive proxy
  if (cleanThumbnail.startsWith("http")) {
    const encoded = bs58.encode(Buffer.from(cleanThumbnail));
    const result = `https://images.hive.blog/p/${encoded}?format=jpeg&mode=cover&width=340&height=191`;
    console.log('🟣 [fixVideoThumbnail] HTTP URL, proxying through Hive:', result);
    return result;
  }

  // Return as-is for any other format
  console.log('🟣 [fixVideoThumbnail] No special handling, returning as-is:', cleanThumbnail);
  return cleanThumbnail;
}
