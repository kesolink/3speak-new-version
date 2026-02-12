import { Buffer } from "buffer";
import bs58 from "bs58";
import fallbackImg from "../assets/image/speak.jpg";

const APP_BUNNY_IPFS_CDN = "https://ipfs-3speak.b-cdn.net";
const APP_IMAGE_CDN_DOMAIN = "https://media.3speak.tv";

export { fallbackImg };

export function fixVideoThumbnail(video) {
  const thumbnail = video?.images?.thumbnail || video?.thumbUrl || video?.spkvideo?.thumbnail_url || video?.thumbnailUrl || video?.thumbnail;

  if (!thumbnail) {
    return fallbackImg;
  }

  // 🧠 Handle IPFS URLs
  if (thumbnail.includes("ipfs://")) {
    const ipfsHash = thumbnail.replace("ipfs://", "");
    return `${APP_BUNNY_IPFS_CDN}/ipfs/${ipfsHash}`;
  }

  // 🧠 Handle media.3speak.tv URLs with Hive proxy
  if (thumbnail.includes(APP_IMAGE_CDN_DOMAIN)) {
    const encoded = bs58.encode(Buffer.from(thumbnail));
    return `https://images.hive.blog/p/${encoded}?format=jpeg&mode=cover&width=340&height=191`;
  }

  // 🧠 Handle regular HTTP URLs with Hive proxy
  if (thumbnail.startsWith("http")) {
    const encoded = bs58.encode(Buffer.from(thumbnail));
    return `https://images.hive.blog/p/${encoded}?format=jpeg&mode=cover&width=340&height=191`;
  }

  // Return as-is for any other format
  return thumbnail;
}
