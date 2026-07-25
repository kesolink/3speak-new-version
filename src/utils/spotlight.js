// Spotlight — creator link pages ("linktree"). Shared client helpers: the API
// wrapper, the curated icon set, theme/section defaults, and a section factory.
import {
  FaLink, FaGlobe, FaYoutube, FaXTwitter, FaInstagram, FaTiktok, FaDiscord, FaTelegram,
  FaWhatsapp, FaGithub, FaTwitch, FaFacebook, FaLinkedin, FaSpotify, FaSoundcloud, FaPatreon,
  FaMedium, FaReddit, FaMastodon, FaThreads, FaBluesky, FaPinterest, FaSnapchat, FaVimeo,
  FaPodcast, FaApple, FaAndroid, FaGoogle, FaBitcoin, FaEthereum, FaPaypal, FaEnvelope,
  FaPhone, FaRss, FaQrcode, FaCartShopping, FaBagShopping, FaDollarSign, FaGift, FaHeart,
  FaStar, FaThumbsUp, FaFire, FaBolt, FaMusic, FaHeadphones, FaMicrophone, FaVideo,
  FaFilm, FaTv, FaPlay, FaCamera, FaImage, FaPalette, FaPen, FaBook,
  FaNewspaper, FaGraduationCap, FaCode, FaGamepad, FaBriefcase, FaHouse, FaLocationDot, FaMap,
  FaCalendarDays, FaClock, FaBell, FaTag, FaDownload, FaFile, FaUsers, FaComment,
  FaShareNodes, FaMugHot, FaWallet, FaPlus, FaCheck,
} from 'react-icons/fa6';

import { getAccounts } from '../hive-api/hiveApi';
import { broadcastWithAioha, KeyTypes } from '../hive-api/aioha';

// Spotlight lives ON-CHAIN in the user's posting_json_metadata under the shared
// `3speak` namespace (alongside interests) — no database. Writes go through the
// same posting-auth broadcast the interests picker uses, so delegated logins never
// re-sign; wallet logins sign once via the SIWH session.
const META_NS = '3speak';
const cleanUser = (u) => String(u || '').trim().replace(/^@/, '').toLowerCase();

function parsePostingMeta(account) {
  if (!account) return {};
  const raw = account.posting_json_metadata;
  try {
    if (typeof raw === 'string') return JSON.parse(raw || '{}') || {};
    if (raw && typeof raw === 'object') return raw;
  } catch { /* malformed metadata → empty */ }
  return {};
}

export function readSpotlightFromAccount(account) {
  const meta = parsePostingMeta(account);
  const sp = meta && meta[META_NS] && meta[META_NS].spotlight;
  return (sp && typeof sp === 'object') ? sp : null;
}

// Curated icon set. Backend stores only the slug (validated /^[a-z0-9-]{1,40}$/);
// unknown slugs fall back to the generic link icon.
export const SPOTLIGHT_ICONS = [
  { slug: 'link', label: 'Link', Icon: FaLink },
  { slug: 'globe', label: 'Website', Icon: FaGlobe },
  { slug: 'youtube', label: 'YouTube', Icon: FaYoutube },
  { slug: 'x', label: 'X', Icon: FaXTwitter },
  { slug: 'instagram', label: 'Instagram', Icon: FaInstagram },
  { slug: 'tiktok', label: 'TikTok', Icon: FaTiktok },
  { slug: 'discord', label: 'Discord', Icon: FaDiscord },
  { slug: 'telegram', label: 'Telegram', Icon: FaTelegram },
  { slug: 'whatsapp', label: 'WhatsApp', Icon: FaWhatsapp },
  { slug: 'github', label: 'GitHub', Icon: FaGithub },
  { slug: 'twitch', label: 'Twitch', Icon: FaTwitch },
  { slug: 'facebook', label: 'Facebook', Icon: FaFacebook },
  { slug: 'linkedin', label: 'LinkedIn', Icon: FaLinkedin },
  { slug: 'spotify', label: 'Spotify', Icon: FaSpotify },
  { slug: 'soundcloud', label: 'SoundCloud', Icon: FaSoundcloud },
  { slug: 'patreon', label: 'Patreon', Icon: FaPatreon },
  { slug: 'medium', label: 'Medium', Icon: FaMedium },
  { slug: 'reddit', label: 'Reddit', Icon: FaReddit },
  { slug: 'mastodon', label: 'Mastodon', Icon: FaMastodon },
  { slug: 'threads', label: 'Threads', Icon: FaThreads },
  { slug: 'bluesky', label: 'Bluesky', Icon: FaBluesky },
  { slug: 'pinterest', label: 'Pinterest', Icon: FaPinterest },
  { slug: 'snapchat', label: 'Snapchat', Icon: FaSnapchat },
  { slug: 'vimeo', label: 'Vimeo', Icon: FaVimeo },
  { slug: 'podcast', label: 'Podcast', Icon: FaPodcast },
  { slug: 'apple', label: 'Apple', Icon: FaApple },
  { slug: 'android', label: 'Android', Icon: FaAndroid },
  { slug: 'google', label: 'Google', Icon: FaGoogle },
  { slug: 'bitcoin', label: 'Bitcoin', Icon: FaBitcoin },
  { slug: 'ethereum', label: 'Ethereum', Icon: FaEthereum },
  { slug: 'paypal', label: 'PayPal', Icon: FaPaypal },
  { slug: 'email', label: 'Email', Icon: FaEnvelope },
  { slug: 'phone', label: 'Phone', Icon: FaPhone },
  { slug: 'rss', label: 'RSS', Icon: FaRss },
  { slug: 'qrcode', label: 'QR code', Icon: FaQrcode },
  { slug: 'shop', label: 'Shop', Icon: FaCartShopping },
  { slug: 'bag', label: 'Store', Icon: FaBagShopping },
  { slug: 'dollar', label: 'Money', Icon: FaDollarSign },
  { slug: 'gift', label: 'Gift', Icon: FaGift },
  { slug: 'heart', label: 'Support', Icon: FaHeart },
  { slug: 'star', label: 'Star', Icon: FaStar },
  { slug: 'thumbsup', label: 'Like', Icon: FaThumbsUp },
  { slug: 'fire', label: 'Fire', Icon: FaFire },
  { slug: 'bolt', label: 'Bolt', Icon: FaBolt },
  { slug: 'music', label: 'Music', Icon: FaMusic },
  { slug: 'headphones', label: 'Audio', Icon: FaHeadphones },
  { slug: 'mic', label: 'Mic', Icon: FaMicrophone },
  { slug: 'video', label: 'Video', Icon: FaVideo },
  { slug: 'film', label: 'Film', Icon: FaFilm },
  { slug: 'tv', label: 'TV', Icon: FaTv },
  { slug: 'play', label: 'Play', Icon: FaPlay },
  { slug: 'camera', label: 'Photo', Icon: FaCamera },
  { slug: 'image', label: 'Image', Icon: FaImage },
  { slug: 'palette', label: 'Art', Icon: FaPalette },
  { slug: 'pen', label: 'Write', Icon: FaPen },
  { slug: 'book', label: 'Book', Icon: FaBook },
  { slug: 'newspaper', label: 'News', Icon: FaNewspaper },
  { slug: 'graduation', label: 'Course', Icon: FaGraduationCap },
  { slug: 'code', label: 'Code', Icon: FaCode },
  { slug: 'gamepad', label: 'Gaming', Icon: FaGamepad },
  { slug: 'briefcase', label: 'Work', Icon: FaBriefcase },
  { slug: 'home', label: 'Home', Icon: FaHouse },
  { slug: 'location', label: 'Location', Icon: FaLocationDot },
  { slug: 'map', label: 'Map', Icon: FaMap },
  { slug: 'calendar', label: 'Calendar', Icon: FaCalendarDays },
  { slug: 'clock', label: 'Clock', Icon: FaClock },
  { slug: 'bell', label: 'Alerts', Icon: FaBell },
  { slug: 'tag', label: 'Tag', Icon: FaTag },
  { slug: 'download', label: 'Download', Icon: FaDownload },
  { slug: 'file', label: 'File', Icon: FaFile },
  { slug: 'users', label: 'Community', Icon: FaUsers },
  { slug: 'comment', label: 'Comment', Icon: FaComment },
  { slug: 'share', label: 'Share', Icon: FaShareNodes },
  { slug: 'coffee', label: 'Coffee', Icon: FaMugHot },
  { slug: 'wallet', label: 'Wallet', Icon: FaWallet },
  { slug: 'plus', label: 'More', Icon: FaPlus },
  { slug: 'check', label: 'Check', Icon: FaCheck },
];

const ICON_BY_SLUG = new Map(SPOTLIGHT_ICONS.map((i) => [i.slug, i.Icon]));
export const iconForSlug = (slug) => ICON_BY_SLUG.get(slug) || FaLink;

// Guess an icon slug from a URL host, so a freshly-pasted link gets a sensible
// default icon without the user having to pick one.
export function guessIconFromUrl(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
    const map = {
      'youtube.com': 'youtube', 'youtu.be': 'youtube', 'twitter.com': 'x', 'x.com': 'x',
      'instagram.com': 'instagram', 'tiktok.com': 'tiktok', 'discord.gg': 'discord',
      'discord.com': 'discord', 't.me': 'telegram', 'telegram.me': 'telegram',
      'github.com': 'github', 'twitch.tv': 'twitch', 'facebook.com': 'facebook',
      'linkedin.com': 'linkedin', 'open.spotify.com': 'spotify', 'spotify.com': 'spotify',
      'patreon.com': 'patreon', 'medium.com': 'medium', 'reddit.com': 'reddit',
    };
    if (map[host]) return map[host];
    for (const key of Object.keys(map)) if (host.endsWith(key)) return map[key];
    if (url.startsWith('mailto:')) return 'email';
    return 'globe';
  } catch {
    return 'link';
  }
}

// Brand/platform icons are only offered when the user picks that platform as the
// link type — a brand icon always implies a link TO that platform. They're kept
// OUT of the free-form icon picker (Website mode), so nobody puts a YouTube icon
// on a non-YouTube link. Optional `base` pre-fills the URL when the platform is chosen.
export const LINK_PLATFORMS = [
  { slug: 'youtube', label: 'YouTube', base: 'https://youtube.com/@' },
  { slug: 'instagram', label: 'Instagram', base: 'https://instagram.com/' },
  { slug: 'x', label: 'X (Twitter)', base: 'https://x.com/' },
  { slug: 'tiktok', label: 'TikTok', base: 'https://tiktok.com/@' },
  { slug: 'facebook', label: 'Facebook', base: 'https://facebook.com/' },
  { slug: 'github', label: 'GitHub', base: 'https://github.com/' },
  { slug: 'linkedin', label: 'LinkedIn', base: 'https://linkedin.com/in/' },
  { slug: 'discord', label: 'Discord', base: 'https://discord.gg/' },
  { slug: 'telegram', label: 'Telegram', base: 'https://t.me/' },
  { slug: 'whatsapp', label: 'WhatsApp', base: 'https://wa.me/' },
  { slug: 'twitch', label: 'Twitch', base: 'https://twitch.tv/' },
  { slug: 'spotify', label: 'Spotify', base: 'https://open.spotify.com/' },
  { slug: 'soundcloud', label: 'SoundCloud', base: 'https://soundcloud.com/' },
  { slug: 'patreon', label: 'Patreon', base: 'https://patreon.com/' },
  { slug: 'medium', label: 'Medium', base: 'https://medium.com/@' },
  { slug: 'reddit', label: 'Reddit', base: 'https://reddit.com/user/' },
  { slug: 'mastodon', label: 'Mastodon', base: 'https://' },
  { slug: 'threads', label: 'Threads', base: 'https://threads.net/@' },
  { slug: 'bluesky', label: 'Bluesky', base: 'https://bsky.app/profile/' },
  { slug: 'pinterest', label: 'Pinterest', base: 'https://pinterest.com/' },
  { slug: 'snapchat', label: 'Snapchat', base: 'https://snapchat.com/add/' },
  { slug: 'vimeo', label: 'Vimeo', base: 'https://vimeo.com/' },
  { slug: 'paypal', label: 'PayPal', base: 'https://paypal.me/' },
  { slug: 'apple', label: 'Apple', base: 'https://' },
  { slug: 'google', label: 'Google', base: 'https://' },
  { slug: 'android', label: 'Android', base: 'https://' },
  { slug: 'bitcoin', label: 'Bitcoin', base: '' },
  { slug: 'ethereum', label: 'Ethereum', base: '' },
];
export const BRAND_SLUGS = new Set(LINK_PLATFORMS.map((p) => p.slug));
export const LINK_PLATFORM_BY_SLUG = new Map(LINK_PLATFORMS.map((p) => [p.slug, p]));
// Free-form icons for Website-mode links (brand icons excluded).
export const SPOTLIGHT_ICONS_GENERAL = SPOTLIGHT_ICONS.filter((i) => !BRAND_SLUGS.has(i.slug));

export const DEFAULT_THEME = {
  bg: {
    type: 'gradient', color: '#12121a', color2: '#241b33', angle: 160, image: null,
    overlayType: 'none', overlayColor: '#000000', overlayColor2: '#000000', overlayAngle: 160, overlayOpacity: 45,
  },
  text: '#f5f5f7',
  sectionBg: 'rgba(255,255,255,0.08)',
  sectionText: '#f5f5f7',
  radius: 16,
  buttonStyle: 'soft',
  font: 'system',
  fontScale: 100,
  fontStyle: 'normal',
  textShadow: 'none',
  textStroke: 0,
  textStrokeColor: '#000000',
  avatarPct: 100,
  avatarShadow: 30,
  avatarGlow: null,
  avatarGlowSize: 24,
  avatarAnimType: 'none',
  avatarAnimSpeed: 5,
  avatarAnimLoop: true,
  avatarAnimDur: 10,
  footerText: 'Open my Channel on 3Speak',
};

export const FONT_OPTIONS = [
  { value: 'system', label: 'System' },
  { value: 'rounded', label: 'Rounded' },
  { value: 'serif', label: 'Serif' },
  { value: 'mono', label: 'Mono' },
  { value: 'display', label: 'Display' },
  { value: 'condensed', label: 'Condensed' },
  { value: 'handwriting', label: 'Handwriting' },
  { value: 'grotesk', label: 'Grotesk' },
  { value: 'humanist', label: 'Humanist' },
  { value: 'geometric', label: 'Geometric' },
  { value: 'slab', label: 'Slab' },
  { value: 'elegant', label: 'Elegant' },
  { value: 'typewriter', label: 'Typewriter' },
  { value: 'marker', label: 'Marker' },
  { value: 'brush', label: 'Brush' },
  { value: 'palatino', label: 'Palatino' },
  { value: 'wide', label: 'Wide' },
];

// Looping "slight movement" animation types (shared by blocks + avatar).
export const ANIM_TYPES = [
  { value: 'none', label: 'None' },
  { value: 'float', label: 'Float' },
  { value: 'sway', label: 'Sway' },
  { value: 'pulse', label: 'Pulse' },
  { value: 'wobble', label: 'Wobble' },
  { value: 'bounce', label: 'Bounce' },
  { value: 'tilt', label: 'Tilt 3D' },
  { value: 'spin', label: 'Spin' },
  { value: 'shake', label: 'Shake' },
  { value: 'breathe', label: 'Breathe' },
];

export const emptyLayout = () => ({ headline: '', theme: { ...DEFAULT_THEME }, sections: [] });

// A stable-enough client id for a new section (server ignores it, but React keys
// + dnd-kit need one). No Date.now()/random dependence beyond the browser.
let _seq = 0;
const newId = () => `s_${Date.now().toString(36)}_${(_seq += 1)}`;

export function newSection(type) {
  const id = newId();
  switch (type) {
    case 'header': return { id, type: 'header', text: 'Section title', size: 'md', align: 'center' };
    case 'link': return { id, type: 'link', title: '', url: '', icon: 'link', iconColor: null, iconBg: null };
    case 'image': return { id, type: 'image', src: '', alt: '', url: null };
    case 'video': return { id, type: 'video', author: '', permlink: '', title: '', thumbnail: null, isShort: false };
    case 'embed': return { id, type: 'embed', source: 'link', url: '', title: '', description: '', image: null, siteName: '', imgSize: 55, count: 3, perRow: 1 };
    default: return { id, type: 'link', title: '', url: '', icon: 'link' };
  }
}

export const SECTION_TYPES = [
  { type: 'link', label: 'Link', Icon: FaLink },
  { type: 'video', label: '3Speak content', Icon: FaVideo },
  { type: 'embed', label: 'Rich link', Icon: FaShareNodes },
  { type: 'image', label: 'Image', Icon: FaCamera },
  { type: 'header', label: 'Title / text', Icon: FaStar },
];

// Ensure every section has a client id (docs from the server have id:null).
export function withIds(layout) {
  const l = layout && typeof layout === 'object' ? layout : emptyLayout();
  return {
    headline: l.headline || '',
    theme: { ...DEFAULT_THEME, ...(l.theme || {}), bg: { ...DEFAULT_THEME.bg, ...((l.theme && l.theme.bg) || {}) } },
    sections: (Array.isArray(l.sections) ? l.sections : []).map((s) => ({ ...s, id: s.id || newId() })),
  };
}

// ── grid rows ↔ flat sections ────────────────────────────────────────────────
// The layout is stored as a flat, ordered array where each block has a `width`
// (full/half/third). For the drag-arrange grid we group it into ROWS: pack blocks
// left-to-right by their fractional width until a row is full (max 3 per row).
const WIDTH_FRAC = { full: 1, half: 0.5, third: 1 / 3 };
export function layoutToRows(sections) {
  const rows = [];
  let cur = [];
  let acc = 0;
  for (const s of (sections || [])) {
    const f = WIDTH_FRAC[s.width] || 1;
    if (cur.length && (acc + f > 1.0001 || cur.length >= 3)) { rows.push(cur); cur = []; acc = 0; }
    cur.push(s);
    acc += f;
    if (acc >= 0.999 || cur.length >= 3) { rows.push(cur); cur = []; acc = 0; }
  }
  if (cur.length) rows.push(cur);
  return rows;
}
// Flatten rows back, normalising each block's width to its row length (2→half,
// 3→third, 1→full). Full drops the `width` key entirely.
export function rowsToSections(rows) {
  const w = (len) => (len >= 3 ? 'third' : len === 2 ? 'half' : 'full');
  return (rows || []).filter((r) => r.length).flatMap((r) => r.map((s) => {
    const width = w(r.length);
    const { width: _drop, ...rest } = s;
    return width === 'full' ? rest : { ...rest, width };
  }));
}

// CSS background string for a theme's page/section background object.
export function bgToCss(bg) {
  if (!bg) return undefined;
  if (bg.type === 'image' && bg.image) return `center / cover no-repeat url("${bg.image}")`;
  if (bg.type === 'gradient') return `linear-gradient(${bg.angle || 160}deg, ${bg.color || '#12121a'}, ${bg.color2 || '#241b33'})`;
  return bg.color || '#12121a';
}

// Read a user's Spotlight from their Hive posting_json_metadata.
export async function fetchSpotlight(username) {
  const u = cleanUser(username);
  if (!u) return { exists: false, page: null };
  try {
    const [account] = await getAccounts([u]);
    const page = readSpotlightFromAccount(account);
    return { exists: !!(page && Array.isArray(page.sections)), page: page || null };
  } catch {
    return { exists: false, page: null };
  }
}

// Persist the caller's Spotlight into their posting_json_metadata via an
// account_update2 (merged so the `profile`/`3speak.interests` keys are preserved).
// Broadcast with posting authority — @threespeak for delegated logins (no signing),
// the user's wallet otherwise. Section `id`s are client-only, stripped before store.
export async function saveSpotlight(username, layout) {
  const u = cleanUser(username);
  if (!u) throw new Error('Not logged in');
  const clean = {
    headline: layout.headline || '',
    theme: layout.theme,
    sections: (layout.sections || []).map(({ id, ...rest }) => rest),
  };

  const [account] = await getAccounts([u]);
  const meta = parsePostingMeta(account);
  meta[META_NS] = { ...(meta[META_NS] || {}), spotlight: clean };

  // Empty json_metadata string = "leave unchanged" on-chain, so only
  // posting_json_metadata is written (posting auth suffices).
  const op = ['account_update2', {
    account: u,
    json_metadata: '',
    posting_json_metadata: JSON.stringify(meta),
    extensions: [],
  }];
  const result = await broadcastWithAioha([op], KeyTypes.Posting);
  if (!result || !result.success) throw new Error('Could not save to Hive');
  return clean;
}
