// 3Speak changelog (preview). NEWEST FIRST. One entry per commit to preview.
// Each `version` must line up with the APP_VERSION bumps in version.js.
// Entry `summary` should be 1–5 sentences, simple and user-facing — when a feature
// changes, name the button/page (and route) so people know where to find it.
//
// NOTE: production users start at the 1.0.0 baseline, so every entry sits ABOVE
// 1.0.0 — that way they see all of these when develop is pushed to production.
export const CHANGELOG = [
  {
    version: '1.23.0',
    date: '2026-06-19',
    summary:
      'On mobile, switch on Large cards to get a full-width video feed where the centred video auto-plays a muted preview as you scroll. Turn off Large cards or Video previews in Settings to disable it.',
  },
  {
    version: '1.22.0',
    date: '2026-06-19',
    summary:
      'Hover a video card on desktop to play a muted preview — with a draggable timeline and subtitles when available. You can switch previews off under Settings → Video previews.',
  },
  {
    version: '1.21.0',
    date: '2026-06-19',
    summary:
      'Video cards are bigger and now a consistent 16:9 on the home, profile and playlist pages. Prefer the old compact look? Switch from Large to Small cards in Settings → Appearance.',
  },
  {
    version: '1.20.0',
    date: '2026-06-18',
    summary:
      '3Speak now notices when a newer version is available and shows a “Refresh” prompt, so you get the latest updates without manually reloading the page.',
  },
  {
    version: '1.19.0',
    date: '2026-06-17',
    summary:
      'Shorts on desktop: scroll with your mouse wheel to move between shorts (like the up/down arrow keys), the action buttons are smaller and sit at the bottom, and the up/down navigation arrows now stay on the far right — with the comments panel opening to their left.',
  },
  {
    version: '1.18.0',
    date: '2026-06-17',
    summary:
      'The community picker when uploading now lists the communities you’re subscribed to (sorted by size) right under the default one, so you don’t have to search for your usual communities.',
  },
  {
    version: '1.17.0',
    date: '2026-06-15',
    summary:
      'The community picker when uploading is redesigned: each community shows a card with its subscriber count and bio, and you can expand it to read the full About and rules. Video and audio cards now gently zoom on hover, and audio cards now match the look of video cards (16:9 cover, author with a follow button).',
  },
  {
    version: '1.16.0',
    date: '2026-06-15',
    summary:
      'Videos posted to Hive now include a “Watch on 3Speak” link at the bottom that opens the right page (the shorts player for shorts, the watch page for videos). A video’s link is now based on its title instead of its description (shorts still use the first words of their text).',
  },
  {
    version: '1.15.0',
    date: '2026-06-15',
    summary:
      'You can now edit or delete your own chat messages from the ⋯ menu on a message (edited ones show an “edited” mark). Starting a new chat now only accepts real Hive usernames.',
  },
  {
    version: '1.14.0',
    date: '2026-06-15',
    summary:
      'Cleaner profile page: the Videos/Shorts/Audio/Playlists tabs now look like proper tabs with a red underline, and opening a short or playlist then pressing the browser back button returns you to the same tab. Shorts thumbnails fit their cards instead of stretching.',
  },
  {
    version: '1.13.0',
    date: '2026-06-14',
    summary:
      'Big chat upgrade: send GIFs and emojis (with inline :shortcode: typing), paste images into a chat, and see rich cards for 3Speak/Hive links. Messages now do multiple lines, quoting, forwarding, timestamps and full-screen image view. Shorts show view counts, and creator profiles have a “Write message” button.',
  },
  {
    version: '1.12.1',
    date: '2026-06-13',
    summary:
      'Chat polish: images shared in a chat now show up inline instead of as a raw link, and your own messages now use an easy-to-read grey bubble.',
  },
  {
    version: '1.12.0',
    date: '2026-06-13',
    summary:
      'New 3Speak Chat: message any Hive user with direct messages, and join channels, from the new chat icon in the top bar (or the /chat page). It connects on its own — no extra signature popup. And hosting OpenPods rooms now works no matter how you logged in (HiveSigner, Keychain, HiveAuth, PeakVault or Ledger).',
  },
  {
    version: '1.11.1',
    date: '2026-06-12',
    summary:
      'Your video now starts uploading in the background as soon as you reach the “Add details” step — usually ready by the time you press publish — with a progress bar under the steps showing how it’s going. Uploads are also spread across multiple servers now, keeping them fast even when lots of people upload at once.',
  },
  {
    version: '1.11.0',
    date: '2026-06-11',
    summary:
      'Your scheduled videos now appear in your profile’s Videos list with a “Scheduled” date badge, in the spot they’ll publish. You can open one to watch it before it goes live, and use the pen (edit) button on its page to change the details, reschedule, or cancel it. The editor now opens as a popup right on the video, so you stay where you are.',
  },
  {
    version: '1.10.7',
    date: '2026-06-11',
    summary:
      'Before an upload starts, 3Speak now checks you have enough Hive Resource Credits (RC) to publish. If you’re too low it explains why and estimates when your RC will have refilled enough, instead of letting the whole upload run and then fail. This applies to both video and audio uploads.',
  },
  {
    version: '1.10.6',
    date: '2026-06-11',
    summary:
      'When you’re logged in with a Hive wallet and tap “Change account”, it now opens the account switcher directly instead of the sign-up / log-in screen.',
  },
  {
    version: '1.10.5',
    date: '2026-06-11',
    summary:
      'Tapping “Edit Video” on your profile now shows a short guide: you can edit any of your videos from its page using the pen button, which the guide highlights for you.',
  },
  {
    version: '1.10.4',
    date: '2026-06-11',
    summary:
      'Fixed the emoji picker in the video description box (the upload “Add details” step) being cut off — the full picker now shows instead of being clipped by the box.',
  },
  {
    version: '1.10.3',
    date: '2026-06-09',
    summary:
      'On desktop, the Shorts page (/shorts) now opens the comments panel by default so you can read along while watching. On mobile it stays closed (tap the comment icon to open).',
  },
  {
    version: '1.10.2',
    date: '2026-06-09',
    summary:
      'Scheduling a video now works no matter how you’re logged in. Before, scheduling (and editing or cancelling a scheduled post on the Edit scheduled post page) asked you to sign a message, which failed for HiveSigner and ManteAuth logins — that signature step is gone, so it just works.',
  },
  {
    version: '1.10.1',
    date: '2026-06-09',
    summary:
      'Uploading a video your browser can’t read or preview — such as iPhone HEVC/H.265 .MOV files — now works smoothly: it no longer fails on the thumbnail step, and the upload and preview steps show a clear note instead of a broken player. The file still uploads and is converted for playback.',
  },
  {
    version: '1.10.0',
    date: '2026-06-09',
    summary:
      'Navigation refresh: a Settings (cog) button in the top bar opens settings directly, and logged-out visitors get a clearer red “Log in” button. On mobile, the profile menu in the bottom bar now matches the desktop menu. You can also drag & drop files into the video uploader, the thumbnail picker, and the audio cover spots.',
  },
  {
    version: '1.9.13',
    date: '2026-06-08',
    summary:
      'Fixed video and short uploads that could fail to publish for some accounts — for example 3Speak Pro members with no beneficiaries set. Publishing now works reliably for everyone.',
  },
  {
    version: '1.9.12',
    date: '2026-06-08',
    summary:
      'The cover you choose now sticks to voice memos and snap audio — it’s saved with the post and shows on the Audio page (/audio). Before, a recording could end up with no cover.',
  },
  {
    version: '1.9.11',
    date: '2026-06-08',
    summary:
      'Audio now shows an icon for each type — song, podcast, voice message and more — on the Audio page (/audio) and its filter chips.',
  },
  {
    version: '1.9.10',
    date: '2026-06-08',
    summary:
      "Fixed view counts on Shorts and videos so plays are counted again. Shorts opened from a shared link now load and play correctly, and on a Short whose original post isn't available the like, comment and reshare buttons are turned off instead of showing an error.",
  },
  {
    version: '1.9.9',
    date: '2026-06-07',
    summary:
      'Notifications have a new look that matches 3Speak — they stack in a list, have a close (×) button, and you can swipe them away to the right.',
  },
  {
    version: '1.9.8',
    date: '2026-06-07',
    summary:
      'Image uploads for thumbnails and covers are fixed — including the cover picker when you create a playlist in the audio uploader.',
  },
  {
    version: '1.9.7',
    date: '2026-06-07',
    summary:
      'Publishing is more reliable across all logins. The first time you upload you may be asked to authorize @threespeak to post on your behalf — then videos, shorts, audio, and video reactions all publish smoothly.',
  },
  {
    version: '1.9.6',
    date: '2026-06-05',
    summary:
      "On mobile, tap your avatar in the bottom bar to see the app version and which Hive node you're connected to. The “what's new” popup is also easier to browse — arrow buttons on desktop and swipe-to-snap on mobile.",
  },
  {
    version: '1.9.5',
    date: '2026-06-05',
    summary:
      "Settings now shows the app version and which Hive node you're connected to. The main page also loads thumbnails a little faster.",
  },
  {
    version: '1.9.4',
    date: '2026-06-05',
    summary:
      'On a video page you can now click the vote count to pin the list of voters — it shows everyone who voted and scrolls. The payout popover also shows an estimated HIVE/HP split.',
  },
  {
    version: '1.9.3',
    date: '2026-06-05',
    summary:
      'The 3Speak Pro section on your Wallet page has a cleaner two-column layout with calmer colours.',
  },
  {
    version: '1.9.2',
    date: '2026-06-05',
    summary:
      'A visual refresh for dark mode — calmer colours with less red and outlined buttons. The notifications bell now shows a small dot instead of a number.',
  },
  {
    version: '1.9.1',
    date: '2026-06-04',
    summary:
      "3Speak now has a changelog! From now on, whenever we ship an update you'll see a short note like this explaining what's new. It pops up automatically after an update — nothing for you to do.",
  },
  {
    version: '1.9.0',
    date: '2026-06-03',
    summary:
      'A big update to make 3Speak faster and more complete. Feeds load quicker, Community pages now show every video posted to that community, and view counts are back on video and audio cards. We also added a screen for scheduled posts and made uploads larger and faster.',
  },
  {
    version: '1.8.0',
    date: '2026-05-20',
    summary:
      'Pay-per-listen arrived for audio and Pro members get a news ticker. 3Speak now also picks a fast, reliable Hive connection automatically — you can choose your own in the connection settings.',
  },
  {
    version: '1.7.0',
    date: '2026-05-06',
    summary:
      'Audio comes to 3Speak. Share a podcast or music track from the upload menu and listen with the new built-in audio player, plus new profile and social links.',
  },
  {
    version: '1.6.0',
    date: '2026-05-03',
    summary:
      'Introducing OpenPods — live audio and video rooms. Start or join a room from the new OpenPods section (/openpods), publish your recordings, invite guests, and share a room link.',
  },
  {
    version: '1.5.0',
    date: '2026-04-10',
    summary:
      '3Speak Pro is here. Subscribe for premium perks and show a Pro badge on your avatar across the site. There is a free trial too — find it on your Wallet page.',
  },
  {
    version: '1.4.0',
    date: '2026-04-07',
    summary:
      'Notifications! A new bell icon in the top bar shows your comments, follows, mentions and rewards. They are grouped together, big votes get a "whale" alert, and there is a full Notifications page.',
  },
  {
    version: '1.3.0',
    date: '2026-04-06',
    summary:
      'You can now edit your own videos. Open one of your videos and use the Edit button to change the title, tags, description, or thumbnail.',
  },
  {
    version: '1.2.1',
    date: '2026-04-04',
    summary: 'The Hive login popup (HiveAuth) is clearer, with improved text and layout.',
  },
  {
    version: '1.2.0',
    date: '2026-04-01',
    summary:
      'Playlists got better. You can now search your playlists, collapse result groups, and use quick filter chips to find what you want.',
  },
  {
    version: '1.1.0',
    date: '2026-03-26',
    summary:
      'Easier browsing. Tag pages now have filters for type and date, tabs show how many videos they contain, and specially curated videos get a badge.',
  },
  {
    version: '1.0.3',
    date: '2026-03-20',
    summary:
      'Mobile polish: a smaller tipping popup, a fixed comment box, and better title spacing on phones.',
  },
  {
    version: '1.0.2',
    date: '2026-03-12',
    summary:
      'Cleaner posting. Titles and short descriptions now show a character limit as you type, and new posts use tidier links.',
  },
  {
    version: '1.0.1',
    date: '2026-03-08',
    summary:
      "You can now report content. Use the new Report option in the “⋯” menu on any video, comment, or user profile.",
  },
];

// Semver compare of "x.y.z" — returns >0 if a is newer than b.
function compareVersions(a, b) {
  const pa = String(a).split('.').map(Number);
  const pb = String(b).split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff !== 0) return diff > 0 ? 1 : -1;
  }
  return 0;
}

// All changelog entries strictly newer than `version` (newest first).
export function changelogSince(version) {
  if (!version) return [];
  return CHANGELOG.filter((e) => compareVersions(e.version, version) > 0);
}
