import { Player } from '@mantequilla-soft/3speak-player';
import Hls from 'hls.js';
import { PLAYER_URL } from '../utils/config';

/**
 * Shared factory for a muted, LOWEST-rendition SDK Player used for cheap video
 * previews — the hover-to-play cards on the homepage AND the scrubber seek
 * preview both use it. Zero extra storage: it reuses the video's existing
 * lowest HLS variant (produced at encode time) instead of a storyboard/GIF.
 *
 * IMPORTANT — we pick the lowest rendition by BITRATE, not by level index. The
 * old `startLevel: 0 / autoLevelCapping: 0` assumed the smallest variant is
 * first in the manifest, which is true for the legacy encoder (240p→720p) but
 * BACKWARDS for the embed encoder, which lists variants highest-first (1080p =
 * index 0). That pinned embed previews to 1080p. Instead: a tiny bandwidth
 * estimate makes ABR start on the smallest rung, and once the manifest's levels
 * are known we lock `currentLevel`/`autoLevelCapping` to the lowest-bitrate one.
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
    hlsConfig: {
      maxBufferLength: 10,
      startFragPrefetch: true,
      // 200 kbps default estimate → ABR selects the smallest variant up front,
      // before the pin below takes over (all renditions are well above this).
      abrEwmaDefaultEstimate: 200000,
    },
  });
  player.attach(videoEl);

  // Lock to the lowest-bitrate rendition as soon as the manifest's levels are
  // known — order-independent, so it's correct for both encoders. player.hls is
  // created synchronously inside load(), so it exists by the time load() resolves.
  const origLoad = player.load.bind(player);
  player.load = async (refOrSource) => {
    const res = await origLoad(refOrSource);
    const hls = player.hls;
    if (hls) {
      const pinLowest = () => {
        const levels = hls.levels || [];
        if (levels.length < 2) return; // single rendition — nothing to choose
        let lo = 0;
        for (let i = 1; i < levels.length; i++) {
          if ((levels[i].bitrate || Infinity) < (levels[lo].bitrate || Infinity)) lo = i;
        }
        hls.autoLevelCapping = lo; // ABR may never climb above the smallest
        hls.currentLevel = lo;     // and start there immediately
      };
      if (hls.levels && hls.levels.length) pinLowest();
      else hls.once(Hls.Events.MANIFEST_PARSED, pinLowest);
    }
    return res;
  };

  return player;
}
