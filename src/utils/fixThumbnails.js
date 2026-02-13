import { Buffer } from "buffer";
import bs58 from "bs58";
import fallbackImg from "../assets/image/speak.jpg";

const APP_BUNNY_IPFS_CDN = "https://ipfs-3speak.b-cdn.net";
const APP_IMAGE_CDN_DOMAIN = "https://media.3speak.tv";

export { fallbackImg };

export function fixVideoThumbnail(video) {
  const thumbnail = video?.images?.thumbnail || video?.thumbUrl || video?.spkvideo?.thumbnail_url || video?.thumbnailUrl || video?.thumbnail;

  // Validate thumbnail exists and is not just whitespace
  if (!thumbnail || typeof thumbnail !== 'string' || thumbnail.trim() === '') {
    return fallbackImg;
  }

  const cleanThumbnail = thumbnail.trim();

  // 🧠 Handle malformed double-embedded URLs (IPFS path containing full HTTP URLs)
  if (cleanThumbnail.includes('/ipfs/http')) {
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
      return fallbackImg;
    }
    return `${APP_BUNNY_IPFS_CDN}/ipfs/${ipfsHash}`;
  }

  // 🧠 If already using images.hive.blog, return as-is (avoid double-proxying)
  if (cleanThumbnail.includes("images.hive.blog")) {
    return cleanThumbnail;
  }

  // 🧠 Handle media.3speak.tv URLs with Hive proxy
  if (cleanThumbnail.includes(APP_IMAGE_CDN_DOMAIN)) {
    const encoded = bs58.encode(Buffer.from(cleanThumbnail));
    return `https://images.hive.blog/p/${encoded}?format=jpeg&mode=cover&width=340&height=191`;
  }

  // 🧠 Handle regular HTTP URLs with Hive proxy
  if (cleanThumbnail.startsWith("http")) {
    const encoded = bs58.encode(Buffer.from(cleanThumbnail));
    return `https://images.hive.blog/p/${encoded}?format=jpeg&mode=cover&width=340&height=191`;
  }

  // Return as-is for any other format
  return cleanThumbnail;
}
