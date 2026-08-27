import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { MdOpenInNew } from 'react-icons/md';
import './BannerClick.scss';

/**
 * The click target over a burned-in banner.
 *
 * The banner itself is not here and cannot be: it is part of the video's pixels, so
 * there is nothing in the page to click. What this adds is a transparent region
 * sitting exactly over it, for the seconds it is on screen, so a viewer who wants
 * the advertiser's site can get there.
 *
 * Deliberately ONLY the click. Blocking this element removes the ability to follow
 * the ad and nothing else — the ad still runs, the impression is still counted, the
 * advertiser still gets what they paid for. That asymmetry is the whole design: the
 * part that is worth money is unblockable, and the part a blocker can reach costs
 * only the click.
 *
 * WHERE IT GOES. `placement` comes from the server, in percentages of the VIDEO
 * FRAME, because the server is the only thing that knows where it burned the banner.
 * Those are not percentages of the player box: the video is drawn with
 * `object-fit: contain`, so on any player whose shape does not match the video's
 * there are bars, and a target positioned against the box would sit off the picture
 * by the height of them. So the displayed frame is measured from the element's own
 * intrinsic size and the target is placed inside THAT.
 */
export default function BannerClick({ videoRef, placement, visible, clickUrl, advertiser }) {
  const [rect, setRect] = useState(null);

  useEffect(() => {
    const el = videoRef?.current;
    if (!visible || !el || !placement) return undefined;

    const measure = () => {
      const { videoWidth: vw, videoHeight: vh } = el;
      const box = el.getBoundingClientRect();
      if (!vw || !vh || !box.width || !box.height) { setRect(null); return; }

      // `contain`: the frame is scaled to fit, so one axis fills the box and the
      // other is centred with a bar either side of it.
      const scale = Math.min(box.width / vw, box.height / vh);
      const fw = vw * scale;
      const fh = vh * scale;
      const offsetX = (box.width - fw) / 2;
      const offsetY = (box.height - fh) / 2;

      // The burn box in frame pixels, then the creative FITTED inside it — the same
      // fit filterGraph() does in services/adBurner.js.
      //
      // The fit happens here and not on the server because the box's true aspect
      // depends on the frame's: widthPct is a percentage of the width and
      // maxHeightPct of the height, and only the player knows the frame. Fitting is
      // what keeps the target on the ad: a 5.6:1 strip in this box lands 604x108 on
      // a 720p frame, and covering the full 768-wide box would put 82px of live
      // click target either side of it, over plain video.
      const boxW = (fw * placement.widthPct) / 100;
      const boxH = (fh * placement.maxHeightPct) / 100;
      const w = placement.aspect > 0 ? Math.min(boxW, boxH * placement.aspect) : boxW;
      const h = placement.aspect > 0 ? w / placement.aspect : boxH;
      const bottom = (fh * placement.bottomPct) / 100;

      setRect({
        left: offsetX + (fw - w) / 2,
        top: offsetY + fh - bottom - h,
        width: w,
        height: h,
      });
    };

    measure();
    // The frame moves whenever the player is resized, rotated or made fullscreen,
    // and the intrinsic size is not known until metadata has loaded.
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    el.addEventListener('loadedmetadata', measure);
    window.addEventListener('orientationchange', measure);
    return () => {
      ro.disconnect();
      el.removeEventListener('loadedmetadata', measure);
      window.removeEventListener('orientationchange', measure);
    };
  }, [videoRef, placement, visible]);

  if (!visible || !rect || !clickUrl) return null;

  return (
    <a
      className="watch-banner-hit"
      href={clickUrl}
      target="_blank"
      rel="noopener noreferrer"
      // Named for what happens. The banner is already labelled "Ad" in the picture,
      // so this does not have to disclose — it has to say where the tap goes.
      aria-label={`Open ${advertiser || 'the advertiser'}'s website in a new tab`}
      style={{
        left: `${rect.left}px`,
        top: `${rect.top}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
      }}
    >
      {/* The same mark the disclosure overlay carries, for the same reason: without
          it nothing says this part of the picture opens anything. It sits in the
          banner's top-right corner rather than the middle so it never lands on the
          advertiser's own wordmark, and it is the ONLY thing this element draws.
          aria-hidden — the anchor's label already says what happens. */}
      <MdOpenInNew className="watch-banner-open" aria-hidden="true" />
    </a>
  );
}

BannerClick.propTypes = {
  videoRef: PropTypes.shape({ current: PropTypes.any }),
  placement: PropTypes.shape({
    widthPct: PropTypes.number,
    maxHeightPct: PropTypes.number,
    bottomPct: PropTypes.number,
    aspect: PropTypes.number,
  }),
  visible: PropTypes.bool,
  clickUrl: PropTypes.string,
  advertiser: PropTypes.string,
};
