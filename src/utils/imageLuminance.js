import { useEffect, useState } from 'react';

/**
 * Median perceived luminance of an image, 0 (black) to 1 (white).
 *
 * Used to decide how dark the profile panel's scrim has to be: a pale cover
 * needs a heavier veil behind white text than a dark one does.
 *
 * MEDIAN rather than mean, deliberately. A banner that's mostly dark with a
 * blown-out sky (or a bright logo in one corner) averages far lighter than it
 * looks, and we'd dim the panel for no reason. The median asks "what is most of
 * this image like", which is the actual question.
 *
 * Returns null when the image can't be read — a missing cover, a network
 * failure, or a host that doesn't allow canvas reads. Callers keep their default.
 */

const cache = new Map();   // url -> Promise<number|null>

// The image is drawn tiny before sampling: 24x14 is ~340 pixels, plenty for a
// median and far cheaper than reading a full-size banner.
const SAMPLE_W = 24;
const SAMPLE_H = 14;

export function medianLuminance(url) {
  if (!url) return Promise.resolve(null);
  if (cache.has(url)) return cache.get(url);

  const job = new Promise((resolve) => {
    if (typeof document === 'undefined') { resolve(null); return; }
    const img = new Image();
    // Required for getImageData: without it the canvas is tainted and throws.
    // images.hive.blog echoes our origin, so this succeeds there.
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = SAMPLE_W;
        canvas.height = SAMPLE_H;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, SAMPLE_W, SAMPLE_H);
        const { data } = ctx.getImageData(0, 0, SAMPLE_W, SAMPLE_H);

        const lums = [];
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] < 128) continue;   // skip transparent pixels
          // Rec. 709 luma: green dominates what the eye reads as brightness.
          lums.push((0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255);
        }
        if (!lums.length) { resolve(null); return; }

        lums.sort((a, b) => a - b);
        resolve(lums[Math.floor(lums.length / 2)]);
      } catch {
        resolve(null);   // tainted canvas or a decode failure
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });

  cache.set(url, job);
  return job;
}

/** Hook form. Returns null while loading, or when the image can't be sampled. */
export function useImageLuminance(url) {
  const [luminance, setLuminance] = useState(null);
  useEffect(() => {
    let alive = true;
    setLuminance(null);
    medianLuminance(url).then((v) => { if (alive) setLuminance(v); });
    return () => { alive = false; };
  }, [url]);
  return luminance;
}
