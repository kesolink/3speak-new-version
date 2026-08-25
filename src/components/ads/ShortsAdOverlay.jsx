import PropTypes from 'prop-types';
import './ShortsAdOverlay.scss';

/**
 * The chrome around a shorts spot: who it is from, that it is an ad, and a way out.
 *
 * 🚨 Draws NO video. The shorts feed has exactly one <video> element on purpose —
 * iOS will not play a second one — so the spot is loaded into that same persistent
 * player and this only sits on top of it. Creating a video element here would break
 * shorts playback on every iPhone.
 *
 * Unlike the watch-page banner, this is honestly blockable: it is a DOM node, and a
 * cosmetic filter can hide it. That is an accepted trade here — hiding the label does
 * not hide the spot, because the spot IS the video that is playing. The disclosure is
 * the thing at risk, not the impression, which is the right way round.
 */
export default function ShortsAdOverlay({ brand, secondsLeft, onSkip, canSkip }) {
  if (!brand) return null;
  return (
    <div className="mkt-shortad">
      <div className="mkt-shortad-top">
        <span className="mkt-shortad-tag">Ad</span>
        {Number.isFinite(secondsLeft) && secondsLeft > 0 && (
          <span className="mkt-shortad-count">{secondsLeft}s</span>
        )}
        {canSkip && (
          <button type="button" className="mkt-shortad-skip" onClick={onSkip}>Skip</button>
        )}
      </div>

      <a
        className="mkt-shortad-brand"
        href={brand.clickUrl || undefined}
        target="_blank"
        rel="noopener noreferrer sponsored"
        onClick={(e) => { if (!brand.clickUrl) e.preventDefault(); }}
      >
        {brand.logoUrl && <img src={brand.logoUrl} alt="" className="mkt-shortad-logo" />}
        <span className="mkt-shortad-text">
          <strong>{brand.productName || brand.account}</strong>
          {brand.slogan && <span className="mkt-shortad-slogan">{brand.slogan}</span>}
        </span>
      </a>
    </div>
  );
}

ShortsAdOverlay.propTypes = {
  brand: PropTypes.shape({
    account: PropTypes.string,
    productName: PropTypes.string,
    logoUrl: PropTypes.string,
    slogan: PropTypes.string,
    clickUrl: PropTypes.string,
  }),
  secondsLeft: PropTypes.number,
  onSkip: PropTypes.func,
  canSkip: PropTypes.bool,
};
