import { Player } from '@mantequilla-soft/3speak-player';
import { PLAYER_URL } from '../utils/config';

/**
 * Shared factory for a muted, LOWEST-rendition SDK Player used for cheap video
 * previews — the hover-to-play cards on the homepage AND the scrubber seek
 * preview both use it. Zero extra storage: it reuses the video's existing
 * lowest HLS variant (produced at encode time) instead of a storyboard/GIF.
 *
 * `hlsConfig: { startLevel: 0, autoLevelCapping: 0 }` pins the smallest level and
 * `testBandwidth: false` skips the ABR probe so it starts on that level instantly.
 *
 * @param {HTMLVideoElement} videoEl  element to attach the player to
 * @param {{ loop?: boolean }} opts    loop (cards) vs one-shot (scrubber)
 * @returns {import('@mantequilla-soft/3speak-player').Player}
 */
export function createLowResPreviewPlayer(videoEl, { loop = false } = {}) {
  const player = new Player({
    apiBase: PLAYER_URL,
    muted: true,
    loop,
    poster: false,
    debug: false,
    hlsConfig: { startLevel: 0, autoLevelCapping: 0, testBandwidth: false, maxBufferLength: 10 },
  });
  player.attach(videoEl);
  return player;
}
