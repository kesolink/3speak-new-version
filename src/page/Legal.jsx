/**
 * Privacy policy + imprint (Art. 13 GDPR information duty + §5 DDG Impressum).
 *
 * The app had NEITHER of these, which are both legally required for an EU/German
 * video service. This page is grounded in what the code actually does — the data
 * flows here are real and current as of 2026-07-14.
 *
 * ⚠️ TWO THINGS BEFORE THIS GOES LIVE ON PRODUCTION:
 *   1. A lawyer must review the wording. This is a solid, honest, technically
 *      accurate draft, not a substitute for legal review.
 *   2. Every [PLACEHOLDER …] must be filled with the real controller details.
 *      A DEFECTIVE Impressum is Abmahnung bait — worse than a marked draft. Do not
 *      ship it with placeholders still in it; the LAST_REVIEWED banner is the guard.
 */
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import './Legal.scss';

// Flip to true only once a lawyer has reviewed this AND every [PLACEHOLDER] below is
// filled with real details. Until then the draft banner shows.
const LEGAL_REVIEWED = false;

function Placeholder({ children }) {
  return <span className="legal-placeholder">[PLACEHOLDER — {children}]</span>;
}

export default function Legal() {
  return (
    <div className="legal">
      <Helmet><title>Privacy & Imprint · 3Speak</title></Helmet>

      {!LEGAL_REVIEWED && (
        <div className="legal-draft" role="alert">
          <strong>Draft — not yet legally reviewed.</strong> This page is technically accurate
          but needs a lawyer's sign-off and the real company details filled in before it is
          relied upon. Do not treat the placeholders as final.
        </div>
      )}

      <h1>Privacy Policy</h1>
      <p className="legal-updated">Last updated: 14 July 2026</p>

      {/* ── The blockchain reality, up front. This is the single most important
          sentence for a Hive-based service and belongs before anything else. ── */}
      <section className="legal-highlight">
        <h2>Read this first: 3Speak runs on a public blockchain</h2>
        <p>
          When you post a video, comment, vote or reshare on 3Speak, it is signed with your own
          Hive keys and broadcast to the <strong>Hive blockchain</strong> — a public, permanent,
          decentralised ledger. Anyone in the world can read it, and copies exist on servers we do
          not control.
        </p>
        <p>
          <strong>This content cannot be deleted — not by us, not by you, not by anyone.</strong>{' '}
          Deleting your 3Speak account removes our copies and stops us showing your content here,
          but the blockchain records remain public forever. Please do not publish anything you may
          later need removed.
        </p>
      </section>

      <section>
        <h2>1. Who is responsible</h2>
        <p>
          The controller for the processing described here is <Placeholder>legal entity name</Placeholder>,{' '}
          <Placeholder>street address</Placeholder>, <Placeholder>postal code, city</Placeholder>, Germany.
        </p>
        <p>
          For any privacy question or to exercise your rights, contact us at{' '}
          <a href="mailto:privacy@3speak.tv">privacy@3speak.tv</a>, or use the request form under{' '}
          <em>Settings → About / Contact</em>.
        </p>
      </section>

      <section>
        <h2>2. What we process, why, and our legal basis</h2>
        <table className="legal-table">
          <thead>
            <tr><th>Data</th><th>Purpose</th><th>Legal basis (GDPR Art. 6)</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>Your Hive account name and login tokens</td>
              <td>Signing you in and keeping you signed in</td>
              <td>Performance of a contract, Art. 6(1)(b)</td>
            </tr>
            <tr>
              <td>Video, playlist, reshare and subscription records</td>
              <td>Running the features you use</td>
              <td>Art. 6(1)(b)</td>
            </tr>
            <tr>
              <td>
                Watch statistics — <strong>country only</strong> (derived from your IP the moment
                you press play, then the IP is discarded), device/browser type, seconds watched
              </td>
              <td>Aggregate audience analytics shown to the creator of the video</td>
              <td>Legitimate interest, Art. 6(1)(f)</td>
            </tr>
            <tr>
              <td>
                View counts — we store a <strong>one-way, per-video hash</strong> of your IP, never
                the IP itself, to count a view once
              </td>
              <td>Counting views without double-counting</td>
              <td>Legitimate interest, Art. 6(1)(f)</td>
            </tr>
            <tr>
              <td>Watch history (only if you leave it enabled in Settings)</td>
              <td>Hiding videos you already watched; “continue watching”</td>
              <td>Art. 6(1)(b) / your settings</td>
            </tr>
            <tr>
              <td>Topic tags you add to videos when voting</td>
              <td>Community topic labelling (also written to the blockchain by you)</td>
              <td>Art. 6(1)(f)</td>
            </tr>
          </tbody>
        </table>
        <p className="legal-note">
          We do <strong>not</strong> store your IP address in our application database, we run{' '}
          <strong>no</strong> advertising, and we use <strong>no</strong> third-party analytics or
          tracking pixels.
        </p>
      </section>

      <section>
        <h2>3. What we store in your browser</h2>
        <p>
          We keep your login, the settings you choose (theme, volume, language, subtitles, feed
          preferences) and — if you allow it — where you left off in each video, all in your
          browser's local storage. None of this is advertising or tracking, and the video-resume
          data never leaves your device. You control the optional part through the cookie banner
          shown on your first visit. See the banner's “What exactly is stored?” for the full list.
        </p>
      </section>

      <section>
        <h2>4. Who else receives data</h2>
        <ul>
          <li><strong>Hosting:</strong> <Placeholder>hosting provider, e.g. Hetzner Online GmbH, Germany</Placeholder>.</li>
          <li><strong>Content delivery / DDoS protection:</strong> <Placeholder>e.g. Cloudflare, Inc. (USA)</Placeholder> — for some domains; see international transfers below.</li>
          <li><strong>Email:</strong> <Placeholder>email provider used to answer data requests, e.g. Resend</Placeholder>.</li>
          <li><strong>The Hive blockchain and IPFS:</strong> public, decentralised networks. Anything you publish goes to them and is outside our control.</li>
        </ul>
        <p>
          We have (or will put in place) data-processing agreements (Art. 28) with each processor
          before launch. <Placeholder>confirm AVV/DPA status per processor</Placeholder>.
        </p>
      </section>

      <section>
        <h2>5. International transfers</h2>
        <p>
          Where a processor is outside the EU/EEA (for example a US-based CDN or email provider),
          the transfer is covered by the European Commission's Standard Contractual Clauses or an
          adequacy decision. <Placeholder>confirm transfer mechanism per processor</Placeholder>.
        </p>
      </section>

      <section>
        <h2>6. How long we keep it</h2>
        <ul>
          <li>Watch-statistics rows: 365 days, then automatically deleted.</li>
          <li>Server access logs: IP addresses are truncated at the point of writing; logs rotate within ~14 days.</li>
          <li>Measurement sessions: minutes (they expire automatically).</li>
          <li>Account-related records: for as long as you have an account, then removed on request.</li>
        </ul>
      </section>

      <section>
        <h2>7. Your rights</h2>
        <p>Under the GDPR you have the right to:</p>
        <ul>
          <li>access the data we hold about you (Art. 15);</li>
          <li>have it corrected (Art. 16) or erased (Art. 17);</li>
          <li>restrict or object to processing (Art. 18, 21);</li>
          <li>receive your data in a portable format (Art. 20).</li>
        </ul>
        <p>
          Use the form under <em>Settings → About / Contact</em> or email{' '}
          <a href="mailto:privacy@3speak.tv">privacy@3speak.tv</a>. We respond within one month. Note
          the blockchain limit explained at the top: we can remove our own copies, but not the
          public ledger.
        </p>
        <p>
          You also have the right to complain to a supervisory authority. For us that is the{' '}
          <strong>Hessischer Beauftragter für Datenschutz und Informationsfreiheit (HBDI)</strong>,
          Wiesbaden. <Placeholder>confirm competent authority</Placeholder>
        </p>
      </section>

      <section>
        <h2>8. No automated decisions with legal effect</h2>
        <p>
          Our feeds rank videos by popularity and your chosen interests, but this does not produce
          any decision with a legal or similarly significant effect on you (Art. 22).
        </p>
      </section>

      {/* ── §5 DDG Impressum. ── */}
      <h1 id="imprint" className="legal-imprint-title">Imprint (Impressum)</h1>
      <section>
        <p>Information pursuant to § 5 DDG:</p>
        <p>
          <Placeholder>legal entity / provider name</Placeholder><br />
          <Placeholder>street address</Placeholder><br />
          <Placeholder>postal code, city</Placeholder>, Germany
        </p>
        <p>
          <strong>Represented by:</strong> <Placeholder>managing director / responsible person</Placeholder>
        </p>
        <p>
          <strong>Contact:</strong> <Placeholder>phone</Placeholder> ·{' '}
          <a href="mailto:privacy@3speak.tv">privacy@3speak.tv</a>
        </p>
        <p>
          <strong>Register:</strong> <Placeholder>commercial register + number, if applicable</Placeholder><br />
          <strong>VAT ID:</strong> <Placeholder>USt-IdNr., if applicable</Placeholder>
        </p>
        <p>
          <strong>Responsible for content</strong> per § 18(2) MStV:{' '}
          <Placeholder>name + address of the person responsible for content</Placeholder>
        </p>
      </section>

      <p className="legal-back"><Link to="/">← Back to 3Speak</Link></p>
    </div>
  );
}
