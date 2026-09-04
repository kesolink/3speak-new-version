import { useCallback, useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import Hls from 'hls.js';
import './UploadGate.scss';

/**
 * The pre-upload spot: a creator watches it before they may post.
 *
 * 🚨 THIS ONE INTERRUPTS WORK, NOT CONSUMPTION.
 * Every other ad surface sits between somebody and entertainment they can come back to.
 * This sits between a creator and publishing a video they have already made and
 * uploaded, which is the worst possible moment to be wrong. So it fails OPEN at every
 * step: no ad, an ad that will not load, a stalled manifest, a player error, a request
 * that never answers — all of them let the post through. The only path that blocks is
 * one where a spot is genuinely playing.
 *
 * The countdown runs on PLAYBACK rather than on arrival, for the same reason as the
 * shorts spot: a clock started when the ad was requested spends its first seconds on
 * loading, and the advertiser paid for seconds on screen. It stops when the video is
 * paused, so pausing cannot be used to wait the spot out.
 *
 * There is no skip. That is the whole product — an advertiser buying this is buying
 * completion, and a skip button would make it a shorts spot with extra steps. The escape
 * hatch is the failure path above, not a button.
 */
export default function UploadGate({ ad, onWatched }) {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const [left, setLeft] = useState(Math.ceil(Number(ad?.durationSeconds) || 0));
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);

  // One place to leave, so every exit runs the same teardown.
  const finish = useCallback(() => {
    try { hlsRef.current?.destroy(); } catch { /* already gone */ }
    hlsRef.current = null;
    onWatched();
  }, [onWatched]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !ad?.manifestUrl) return undefined;
    let alive = true;

    // A spot that cannot be loaded must not cost somebody their upload.
    const bail = (why) => {
      if (!alive) return;
      console.warn('[uploadGate] letting the post through:', why);
      setFailed(true);
      finish();
    };

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari plays HLS natively and hls.js refuses to attach there.
      video.src = ad.manifestUrl;
      video.play().catch(() => bail('autoplay refused'));
    } else if (Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true });
      hlsRef.current = hls;
      hls.on(Hls.Events.ERROR, (_e, data) => { if (data?.fatal) bail(`hls ${data.type}`); });
      hls.loadSource(ad.manifestUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => video.play().catch(() => bail('autoplay refused')));
    } else {
      bail('no HLS support in this browser');
      return undefined;
    }

    // Belt and braces: if nothing has played after twice the spot's length, stop
    // holding the upload. A stall that never fires an error would otherwise trap
    // somebody on a still frame with no way forward.
    const secs = Number(ad.durationSeconds) || 15;
    const deadline = setTimeout(() => bail('spot never finished'), (secs * 2 + 12) * 1000);

    return () => {
      alive = false;
      clearTimeout(deadline);
      try { hlsRef.current?.destroy(); } catch { /* already gone */ }
      hlsRef.current = null;
    };
  }, [ad, finish]);

  // Ticks only while the video is actually moving, so loading and pausing do not
  // consume the advertiser's seconds.
  useEffect(() => {
    if (!playing || failed) return undefined;
    const t = setInterval(() => setLeft((n) => (n > 0 ? n - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [playing, failed]);

  const brand = ad?.brand;
  return (
    <div className="upload-gate" role="dialog" aria-modal="true" aria-label="Sponsor message">
      <div className="upload-gate-inner">
        <video
          ref={videoRef}
          className="upload-gate-video"
          playsInline
          onPlaying={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={finish}
          onError={() => { setFailed(true); finish(); }}
        />
        <div className="upload-gate-bar">
          <span className="upload-gate-label">{ad?.label || 'Sponsored'}</span>
          {brand?.productName && (
            brand.clickUrl
              ? <a className="upload-gate-brand" href={brand.clickUrl} target="_blank" rel="noopener noreferrer sponsored">{brand.productName}</a>
              : <span className="upload-gate-brand">{brand.productName}</span>
          )}
          <span className="upload-gate-count">
            {playing ? `${left}s` : 'loading…'}
          </span>
        </div>
        <p className="upload-gate-note">Watch this to unlock Post Video.</p>
      </div>
    </div>
  );
}

UploadGate.propTypes = {
  ad: PropTypes.shape({
    manifestUrl: PropTypes.string,
    durationSeconds: PropTypes.number,
    label: PropTypes.string,
    brand: PropTypes.object,
  }).isRequired,
  onWatched: PropTypes.func.isRequired,
};
