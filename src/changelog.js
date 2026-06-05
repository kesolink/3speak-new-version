// 3Speak changelog (preview). NEWEST FIRST. One entry per commit to preview.
// Each `version` must line up with the APP_VERSION bumps in version.js.
// Entry `summary` should be 1–5 sentences, simple and user-facing — when a feature
// changes, name the button/page (and route) so people know where to find it.
//
// NOTE: production users start at the 1.0.0 baseline, so every entry sits ABOVE
// 1.0.0 — that way they see all of these when develop is pushed to production.
export const CHANGELOG = [
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
