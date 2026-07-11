import { useLocation, matchPath } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';

/**
 * Sets the browser-tab title for every route.
 *
 * Only the watch page used to do this (via SEOHead), so every other page — shorts,
 * home, leaderboard, profiles… — sat on the static <title> from index.html. This
 * component lives once inside the Router and derives the title from the pathname.
 *
 * Pages that set their OWN (dynamic) title render their own <Helmet>/<SEOHead>;
 * they're listed in SELF_TITLED so we don't emit a competing <title> for them.
 * (react-helmet-async lets the last-rendered value win, and we'd rather not
 * depend on mount order.)
 */
const SELF_TITLED = ['/watch', '/shorts'];

// First match wins. `title` may be a string or a fn of the matched params.
const ROUTES = [
  { path: '/', end: true, title: 'Home' },
  { path: '/home-feed', title: 'Home Feed' },
  { path: '/follow-feed', title: 'Follow Feed' },
  { path: '/trend', title: 'Trending' },
  { path: '/discover', title: 'Discover' },
  { path: '/new', title: 'New Videos' },
  { path: '/firstupload', title: 'First Uploads' },
  { path: '/leaderboard', title: 'Leaderboard' },
  { path: '/notifications', title: 'Notifications' },
  { path: '/communities', title: 'Communities' },
  { path: '/community/:communityName', title: (p) => p.communityName },
  { path: '/audio/:author/:permlink', title: (p) => `Audio by @${p.author}` },
  { path: '/audio', title: 'Audio' },
  { path: '/playlist/:playlistId', title: 'Playlist' },
  { path: '/t/:tag', title: (p) => `#${p.tag}` },
  { path: '/p/:user', title: (p) => `@${p.user}` },
  { path: '/user/:user', title: (p) => `@${p.user}` },
  { path: '/watched/:username', title: (p) => `Watch history — @${p.username}` },
  { path: '/post/:author/:permlink', title: (p) => `Post by @${p.author}` },
  { path: '/profile', title: 'My Profile' },
  { path: '/upload', title: 'Upload' },
  { path: '/embed-studio/*', title: 'Upload Studio' },
  { path: '/draft', title: 'Drafts' },
  { path: '/editvideo/:d', title: 'Edit Video' },
  { path: '/edit-scheduled/:permlink', title: 'Edit Scheduled Post' },
  { path: '/chat', title: 'Chat' },
  { path: '/openpods', title: 'OpenPods' },
  { path: '/about', title: 'About' },
  { path: '/login', title: 'Login' },
  { path: '/newlogin', title: 'Login' },
  { path: '/auth/login', title: 'Login' },
];

export function resolveRouteTitle(pathname) {
  for (const r of ROUTES) {
    const m = matchPath({ path: r.path, end: r.end ?? false }, pathname);
    if (m) return typeof r.title === 'function' ? r.title(m.params) : r.title;
  }
  return null;
}

export default function RouteTitle() {
  const { pathname } = useLocation();

  // Let self-titling pages own the tag entirely.
  if (SELF_TITLED.some((p) => matchPath({ path: p, end: false }, pathname))) return null;

  const title = resolveRouteTitle(pathname);
  // Unknown route → fall back to the plain brand title rather than a stale one.
  return (
    <Helmet>
      <title>{title ? `${title} | 3Speak` : '3Speak - Decentralized Video Platform'}</title>
    </Helmet>
  );
}
