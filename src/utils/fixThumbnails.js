import { Buffer } from "buffer";
import bs58 from "bs58";

const APP_BUNNY_IPFS_CDN = "https://hotipfs-3speak-1.b-cdn.net";
const APP_IMAGE_CDN_DOMAIN = "https://media.3speak.tv";
const FALLBACK_THUMBNAIL = "/images/speak.jpg"; // Local fallback image

// export function fixVideoThumbnail(video) {
//   let baseUrl = "";
//   let thumbUrl = "";

//   // 🧠 Check if IPFS
//   if (video.images?.thumbnail?.includes("ipfs://")) {
//     baseUrl = `${APP_BUNNY_IPFS_CDN}/ipfs/${video.images?.thumbnail.replace("ipfs://", "")}/`;
//   } else if (video.images?.thumbnail?.includes(APP_IMAGE_CDN_DOMAIN)) {
//     // 🧠 Convert old thumbnail to Hive image proxy
//     const encoded = bs58.encode(Buffer.from(video.images?.thumbnail));
//     thumbUrl = `https://images.hive.blog/p/${encoded}?format=jpeg&mode=cover&width=340&height=191`;
//     baseUrl = video.images?.thumbnail;
//   } else {
//     baseUrl = video.images?.thumbnail || "";
//   }
//   console.log(thumbUrl)
//   return thumbUrl || baseUrl;
// }

export function fixVideoThumbnail(video) {
  const thumbnail = video?.images?.thumbnail || video?.thumbUrl || video?.spkvideo?.thumbnail_url;

  // 🚧 If no thumbnail, return a fallback image
  if (!thumbnail) {
    return FALLBACK_THUMBNAIL;
  }

  // 🧠 Handle IPFS URLs
  if (thumbnail.includes("ipfs://")) {
    const ipfsHash = thumbnail.replace("ipfs://", "");
    return `${APP_BUNNY_IPFS_CDN}/ipfs/${ipfsHash}`;
  }

  // 🔄 Replace deprecated CDN with new CDN
  if (thumbnail.includes("ipfs-3speak.b-cdn.net")) {
    return thumbnail.replace("https://ipfs-3speak.b-cdn.net", APP_BUNNY_IPFS_CDN);
  }

  // ✅ Already using optimized CDN - return as-is (no need to re-proxy)
  if (thumbnail.includes("images.hive.blog") || 
      thumbnail.includes("files.peakd.com") || 
      thumbnail.includes("images.3speak.tv")) {
    return thumbnail;
  }

  // ⚠️ media.3speak.tv doesn't exist anymore - use fallback
  if (thumbnail.includes(APP_IMAGE_CDN_DOMAIN)) {
    console.log('⚠️ Dead server URL detected:', thumbnail, '→ Returning local fallback:', FALLBACK_THUMBNAIL);
    return FALLBACK_THUMBNAIL;
  }

  // 🧠 Handle regular HTTP URLs with Hive proxy
  if (thumbnail.startsWith("http")) {
    const encoded = bs58.encode(Buffer.from(thumbnail));
    const result = `https://images.hive.blog/p/${encoded}?format=jpeg&mode=cover&width=340&height=191`;
    console.log('🖼️ Thumbnail proxy:', thumbnail, '→', result);
    return result;
  }

  // Return as-is for any other format
  return thumbnail;
}
