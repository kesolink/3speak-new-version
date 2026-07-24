/**
 * Cookie / storage consent banner.
 *
 * Written to be honest rather than to farm clicks. 3Speak has no analytics, no ad
 * pixels and no third-party trackers, so there is no "Accept all" that unlocks a
 * pile of hidden tracking — the only real choice is whether we may remember where
 * you left off in a video. The copy says exactly that, and "Essential only" is
 * given the same visual weight as "Accept" (a pre-selected, prettier Accept button
 * next to a buried Decline is precisely the dark pattern regulators go after).
 *
 * Not shown at all once answered. The answer itself is the one thing we must store
 * to honour it — that storage is consent-exempt, and necessarily so: you cannot
 * remember "no" without writing down "no".
 */
import { useEffect, useState } from 'react';
import { hasDecided, setConsent } from '../../lib/consent';
import './CookieConsent.scss';

export default function CookieConsent() {
  const [open, setOpen] = useState(false);
  const [details, setDetails] = useState(false);

  useEffect(() => {
    // Defer a tick so it doesn't fight the first paint.
    const t = setTimeout(() => setOpen(!hasDecided()), 600);
    return () => clearTimeout(t);
  }, []);

  if (!open) return null;

  const decide = (functional) => {
    setConsent({ functional });
    setOpen(false);
  };

  return (
    <div className="cookie-consent" role="dialog" aria-live="polite" aria-label="Cookie and storage settings">
      <div className="cookie-consent-inner">
        <div className="cookie-consent-text">
          <h4>Cookies &amp; browser storage</h4>
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
                </ul>
              </div>
              <p className="cookie-consent-note">
                Choosing “Essential only” stops playback positions from being saved and deletes any
                already stored. You can change your mind any time — choosing “Accept” turns it back
                on straight away.
              </p>
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

        <div className="cookie-consent-actions">
          <button type="button" className="cookie-consent-btn secondary" onClick={() => decide(false)}>
            Essential only
          </button>
          <button type="button" className="cookie-consent-btn primary" onClick={() => decide(true)}>
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
