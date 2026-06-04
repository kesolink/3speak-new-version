// 3Speak changelog (preview). NEWEST FIRST. One entry per commit to preview.
// Each `version` must line up with the APP_VERSION bumps in version.js.
// Entry `summary` should be 1–5 sentences, simple and user-facing.
//
// These are placeholder/dummy entries so we can design the "What's new" popup.
// Real entries start with the next "commit to preview".
export const CHANGELOG = [
  {
    version: '1.0.0',
    date: '2026-06-04',
    summary:
      "We've started keeping a changelog! From now on you'll get a short note about what changed whenever 3Speak updates.",
  },
  {
    version: '0.9.0',
    date: '2026-06-03',
    summary:
      'Community pages now show every video posted to that community, including the newest uploads. Open any community from the Communities page to check it out.',
  },
  {
    version: '0.8.0',
    date: '2026-06-01',
    summary:
      'View counts are back on video cards, so you can see how many times a video has been watched right from the feed.',
  },
  {
    version: '0.7.0',
    date: '2026-05-28',
    summary:
      'You can now edit a video after publishing it. Look for the Edit button on your own video pages.',
  },
  {
    version: '0.6.0',
    date: '2026-05-24',
    summary:
      'Added audio uploads. Share a podcast or music track from the Upload page just like a video.',
  },
  {
    version: '0.5.0',
    date: '2026-05-20',
    summary:
      'Notifications arrived in the top bar — tap the bell icon to see new comments, follows and rewards.',
  },
  {
    version: '0.4.0',
    date: '2026-05-15',
    summary:
      'Faster, smoother video uploads with support for much larger files.',
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
