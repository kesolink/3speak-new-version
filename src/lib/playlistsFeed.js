// Recently-CHANGED public playlists, for interleaving into the home feed next to
// the community snaps. Backed by the checker's /playlists-feed endpoint, which
// reads the on-chain playlist index (a video added/removed bumps updated_at).
// Mirrors fetchCommunityFeed() in ./snaps.

import axios from 'axios';
import { CHECKER_URL } from '../utils/config';

export async function fetchPlaylistsFeed({ scope = 'all', currentuser = '', page = 1, limit = 10 } = {}) {
  const params = new URLSearchParams({ scope, page: String(page), limit: String(limit) });
  if (currentuser) params.set('currentuser', currentuser);
  const { data } = await axios.get(`${CHECKER_URL}/playlists-feed?${params.toString()}`);
  return data; // { success, playlists, page, limit, hasMore }
}

export default fetchPlaylistsFeed;
