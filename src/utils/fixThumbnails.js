import { Buffer } from "buffer";
import bs58 from "bs58";
import fallbackImg from "../assets/image/speak.jpg";

const APP_BUNNY_IPFS_CDN = "https://hotipfs-3speak-1.b-cdn.net";
const APP_IMAGE_CDN_DOMAIN = "https://media.3speak.tv";
const FALLBACK_THUMBNAIL = "/images/speak.jpg"; // Local fallback image

export { fallbackImg };

// Hive image proxy dimensions: landscape 16:9 by default, portrait 9:16 for
// shorts so the thumbnail is cropped to portrait at the source.
const LANDSCAPE = { w: 340, h: 191 };
const PORTRAIT = { w: 360, h: 640 };

export function fixVideoThumbnail(video, portrait = false) {
  const size = portrait ? PORTRAIT : LANDSCAPE;
  const thumbnail = video?.images?.thumbnail || video?.thumbUrl || video?.spkvideo?.thumbnail_url || video?.thumbnailUrl || video?.thumbnail_url || video?.thumbnail;

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

  // 🔄 Replace deprecated CDN with new CDN
  if (cleanThumbnail.includes("ipfs-3speak.b-cdn.net")) {
    return cleanThumbnail.replace("https://ipfs-3speak.b-cdn.net", APP_BUNNY_IPFS_CDN);
  }

  // ✅ Already a SIZED Hive proxy URL (…/p/… or …/WxH/…) — already small, leave it.
  if (cleanThumbnail.includes("images.hive.blog/p/") || /images\.hive\.blog\/\d+x\d+\//.test(cleanThumbnail)) {
    // For shorts, re-request the proxied image at portrait dimensions (the
    // baked-in params are landscape). The /p/<hash> form re-proxies the original.
    if (portrait && cleanThumbnail.includes("images.hive.blog/p/")) {
      return `${cleanThumbnail.split('?')[0]}?format=jpeg&mode=cover&width=${size.w}&height=${size.h}`;
    }
    return cleanThumbnail;
  }

  // ⚠️ images.hive.blog's resize proxy 403s on ecency-hosted sources. Route them
  // through ecency's OWN imagehoster (same /p/ API) instead, so the thumbnail is
  // still downscaled — and portrait-cropped for shorts — rather than loading the
  // full-resolution original.
  if (cleanThumbnail.includes("i.ecency.com") || cleanThumbnail.includes("images.ecency.com")) {
    // Already an ecency resize-proxy URL — leave it (re-size for portrait shorts).
    if (cleanThumbnail.includes("images.ecency.com/p/") || /images\.ecency\.com\/\d+x\d+\//.test(cleanThumbnail)) {
      if (portrait && cleanThumbnail.includes("images.ecency.com/p/")) {
        return `${cleanThumbnail.split('?')[0]}?format=jpeg&mode=cover&width=${size.w}&height=${size.h}`;
      }
      return cleanThumbnail;
    }
    // Raw ecency image — re-proxy through ecency (hive's proxy 403s on these).
    const encoded = bs58.encode(Buffer.from(cleanThumbnail));
    return `https://images.ecency.com/p/${encoded}?format=jpeg&mode=cover&width=${size.w}&height=${size.h}`;
  }

  // ⚠️ media.3speak.tv doesn't exist anymore - use fallback
  if (cleanThumbnail.includes(APP_IMAGE_CDN_DOMAIN)) {
    return FALLBACK_THUMBNAIL;
  }

  // 🧠 Handle regular HTTP URLs with Hive proxy
  if (cleanThumbnail.startsWith("http")) {
    const encoded = bs58.encode(Buffer.from(cleanThumbnail));
    return `https://images.hive.blog/p/${encoded}?format=jpeg&mode=cover&width=${size.w}&height=${size.h}`;
  }

  // Return as-is for any other format
  return cleanThumbnail;
}
