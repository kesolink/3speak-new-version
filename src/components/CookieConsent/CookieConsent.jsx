/**
 * Cookie / storage consent banner.
 *
 * Written to be honest rather than to farm clicks. The copy is driven by
 * ENABLE_THIRDPARTY_ADS so it cannot claim one thing while the site does another:
 * with the flag off there genuinely is no advertising and the banner says so; with
 * it on the claim disappears and advertising becomes its own opt-in, defaulted off.
 * That coupling is the point. A hand-edited banner is a banner that goes stale the
 * first time someone ships a tag in a hurry.
 *
 * Every optional category is off until chosen, and refusing is exactly as easy as
 * accepting (same size, same weight, all solid fills). A pre-selected, prettier
 * Accept next to a buried Decline is precisely the dark pattern regulators go after.
 *
 * Not shown at all once answered. The answer itself is the one thing we must store
 * to honour it — that storage is consent-exempt, and necessarily so: you cannot
 * remember "no" without writing down "no".
 */
import { useEffect, useState } from 'react';
import { hasDecided, setConsent } from '../../lib/consent';
import { notifyAdConsentChanged, subscribeToCmp } from '../../lib/thirdPartyAds';
import { ENABLE_THIRDPARTY_ADS } from '../../utils/config';
import './CookieConsent.scss';

export default function CookieConsent() {
  const [open, setOpen] = useState(false);
  const [details, setDetails] = useState(false);
  // Both start off. Nothing optional is ever pre-ticked.
  const [functionalOn, setFunctionalOn] = useState(false);
  const [advertisingOn, setAdvertisingOn] = useState(false);

  useEffect(() => {
    // If a TCF CMP is on the page, start listening now: its answer feeds the same
    // gate the banner does, and the ad loader stays shut until it arrives.
    subscribeToCmp();
    // Defer a tick so it doesn't fight the first paint.
    const t = setTimeout(() => setOpen(!hasDecided()), 600);
    return () => clearTimeout(t);
  }, []);

  if (!open) return null;

  const decide = ({ functional, advertising }) => {
    setConsent({ functional, advertising });
    notifyAdConsentChanged();
    setOpen(false);
  };

  return (
    <div className="cookie-consent" role="dialog" aria-live="polite" aria-label="Cookie and storage settings">
      <div className="cookie-consent-inner">
        <div className="cookie-consent-text">
          <h4>Cookies &amp; browser storage</h4>

          {ENABLE_THIRDPARTY_ADS ? (
            <>
              <p>
                3Speak keeps your login and the settings you choose in your browser. That is what
                makes the site work, and it stays on your device. Two things are optional, and both
                are off unless you turn them on below.
              </p>
              <p>
                One of them is <strong>advertising</strong>. When it is on, an outside advertising
                company loads its own code on the page and can store things we do not control. That
                is why it is a separate choice and never bundled with anything else.
              </p>
            </>
          ) : (
            <>
              <p>
                3Speak keeps your login and the settings you choose in your browser — that's what makes
                the site work. We use <strong>no tracking cookies, no advertising and no third-party
                analytics</strong>. The only thing watching a video can save to your device is where you
                left off — and that's the one optional choice below.
              </p>
              <p>
                The one optional thing: we can remember <strong>where you left off in each video</strong>{' '}
                so playback resumes. It never leaves your device.
              </p>
            </>
          )}

          {details && (
            <div className="cookie-consent-details">
              <div className="cookie-consent-cat">
                <span className="cookie-consent-cat-title">Essential — always on</span>
                <ul>
                  <li>Your login session</li>
                  <li>Settings you set: theme, volume, language, subtitles, feed preferences</li>
                  <li>Resuming an interrupted upload, and drafts of posts you're writing</li>
                  <li>The app itself, for offline use once installed</li>
                  <li>Your answer to this banner</li>
                </ul>
              </div>
              <div className="cookie-consent-cat">
                <span className="cookie-consent-cat-title">Optional — your choice</span>
                <ul>
                  <li>Playback position per video, so you can pick up where you left off</li>
                  {ENABLE_THIRDPARTY_ADS && (
                    <li>
                      Advertising: an outside advertising company's code, and whatever it stores on
                      your device to count and cap the ads you are shown
                    </li>
                  )}
                </ul>
              </div>
              <p className="cookie-consent-note">
                {ENABLE_THIRDPARTY_ADS
                  ? 'Leaving these off stops playback positions from being saved and deletes any already stored, and means no advertising code is loaded at all. You can change your mind any time.'
                  : 'Choosing “Essential only” stops playback positions from being saved and deletes any already stored. You can change your mind any time — choosing “Accept” turns it back on straight away.'}
              </p>
            </div>
          )}

          {/* Granular toggles only exist once there is more than one optional thing to
              weigh. With ads off the single choice is carried by the buttons alone,
              exactly as before. */}
          {ENABLE_THIRDPARTY_ADS && (
            <div className="cookie-consent-toggles">
              <label className="cookie-consent-toggle">
                <input
                  type="checkbox"
                  checked={functionalOn}
                  onChange={(e) => setFunctionalOn(e.target.checked)}
                />
                <span>
                  <strong>Resume playback</strong>
                  Remember where you left off in each video. Stays on your device.
                </span>
              </label>
              <label className="cookie-consent-toggle">
                <input
                  type="checkbox"
                  checked={advertisingOn}
                  onChange={(e) => setAdvertisingOn(e.target.checked)}
                />
                <span>
                  <strong>Advertising</strong>
                  Let an outside advertising company load its code and store what it needs.
                </span>
              </label>
            </div>
          )}

          <button
            type="button"
            className="cookie-consent-link"
            onClick={() => setDetails((d) => !d)}
          >
            {details ? 'Hide details' : 'What exactly is stored?'}
          </button>
        </div>

        <div className={`cookie-consent-actions${ENABLE_THIRDPARTY_ADS ? ' three-up' : ''}`}>
          <button
            type="button"
            className="cookie-consent-btn secondary"
            onClick={() => decide({ functional: false, advertising: false })}
          >
            Essential only
          </button>
          {ENABLE_THIRDPARTY_ADS && (
            <button
              type="button"
              className="cookie-consent-btn secondary"
              onClick={() => decide({ functional: functionalOn, advertising: advertisingOn })}
            >
              Save choices
            </button>
          )}
          <button
            type="button"
            className="cookie-consent-btn primary"
            onClick={() => decide({ functional: true, advertising: ENABLE_THIRDPARTY_ADS })}
          >
            {ENABLE_THIRDPARTY_ADS ? 'Accept all' : 'Accept'}
          </button>
        </div>
      </div>
    </div>
  );
}
