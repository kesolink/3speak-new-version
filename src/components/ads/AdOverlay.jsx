import PropTypes from 'prop-types';
import { MdOpenInNew, MdSkipNext } from 'react-icons/md';
import './AdOverlay.scss';

/**
 * The disclosure shown over the video while an ad plays.
 *
 *   Advertisement from @username
 *          ┌──────────────────────
 *   (logo) │ Product name
 *          │ slogan, two lines at most
 *
 * One component for both the real player and the preview on /advertise, so what an
 * advertiser is shown while filling the form is the same markup a viewer gets. Every
 * part below the first line is optional: a product with no logo and no slogan still
 * renders a correct, complete disclosure, which is the part that is not optional.
 *
 * Rendered inside the player frame rather than as a page-level element, for the same
 * reason the old text label was: a filter list cannot hide it without hiding the
 * video with it.
 *
 * With a click URL it becomes a link, opened in a new tab so a viewer never loses the
 * video they were watching. The href points at OUR origin, which counts the click and
 * then redirects — the advertiser's real address is never in the page, and a click is
 * measurable, which is the first thing an advertiser asks about.
 */
export default function AdOverlay({
  account, brand, previewOnly = false, resumeIn = null, onSkip = null,
}) {
  const productName = brand?.productName || null;
  const slogan = brand?.slogan || null;
  const logoUrl = brand?.logoUrl || null;
  // No link in the preview on /advertise: it would send the advertiser to their own
  // site mid-form, and there is no session to count a click against anyway.
  const clickUrl = previewOnly ? null : (brand?.clickUrl || null);

  const inner = (
    <>
      <span className="brandmark-from">
        Advertisement{account ? <> from <strong>@{account}</strong></> : null}
      </span>

      {(productName || slogan || logoUrl) && (
        <div className="brandmark-body">
          {logoUrl
            ? <img className="brandmark-logo" src={logoUrl} alt="" loading="lazy" />
            : <span className="brandmark-logo brandmark-logo-empty" aria-hidden="true" />}
          <div className="brandmark-text">
            {productName ? <strong className="brandmark-name">{productName}</strong> : null}
            {slogan ? <span className="brandmark-slogan">{slogan}</span> : null}
          </div>
        </div>
      )}

      {/* The wait, which is what a viewer actually wants to know. Held at "in a
          moment" rather than showing 0: the last tick is over before the number
          would be read. Inside `inner` so it appears whether or not the overlay is
          a link. */}
      {resumeIn != null && (
        <span className="brandmark-resume">
          {resumeIn > 0
            ? <>Video continues in <strong>{resumeIn}s</strong></>
            : 'Video continues in a moment'}
        </span>
      )}
    </>
  );

  const className = `brandmark${previewOnly ? ' brandmark-preview' : ''}${clickUrl ? ' brandmark-link' : ''}`;

  /* Skip.
   *
   * A SIBLING of the brandmark, never inside it. The brandmark becomes a link when the
   * advertiser has a site, and a skip button inside that link is a button whose click
   * also opens the ad, which is the opposite of what it says.
   *
   * Rendered only once the caller says the threshold has passed, so it appears partway
   * through the spot rather than sitting there from the first frame.
   */
  const skip = onSkip ? (
    <button
      type="button"
      className="ad-skip"
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onSkip(); }}
    >
      Skip ad
      <MdSkipNext aria-hidden="true" />
    </button>
  ) : null;

  if (!clickUrl) {
    return (
      <>
        <div className={className}>{inner}</div>
        {skip}
      </>
    );
  }

  return (
    <>
    <a
      className={className}
      href={clickUrl}
      target="_blank"
      rel="noopener noreferrer"
      // Named for what happens, not what it is: a viewer should know they are about
      // to leave for an advertiser's site and that the video stays put.
      aria-label={`Open ${productName || 'the advertiser'}'s website in a new tab`}
    >
      {inner}
      {/* Says the overlay is openable. Only drawn when there is somewhere to go, so
          it never promises a destination that isn't there — which is also why the
          /advertise preview has none: it is passed no click URL. aria-hidden, since
          the anchor's own label already says what happens. */}
      <MdOpenInNew className="brandmark-open" aria-hidden="true" />
    </a>
    {skip}
    </>
  );
}

AdOverlay.propTypes = {
  account: PropTypes.string,
  brand: PropTypes.shape({
    productName: PropTypes.string,
    slogan: PropTypes.string,
    logoUrl: PropTypes.string,
    clickUrl: PropTypes.string,
  }),
  previewOnly: PropTypes.bool,
  resumeIn: PropTypes.number,
  /** Called when the viewer skips. Absent means the spot is not skippable yet. */
  onSkip: PropTypes.func,
};
