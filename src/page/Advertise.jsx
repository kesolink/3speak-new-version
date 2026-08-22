import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MdCampaign, MdInfoOutline, MdCheckCircle, MdSchedule, MdCancel } from 'react-icons/md';
import { toast } from 'sonner';
import { useAppStore } from '../lib/store';
import { adsEnabledFor } from '../utils/config';
import NotFound from './NotFound';
import {
  AD_CATEGORIES,
  fetchInventory,
  submitApplication,
  fetchApplication,
  uploadCreative,
  uploadImageAsset,
  fetchCreatives,
  fetchPricing,
  createCampaign,
  fetchCampaigns,
  claimCampaign,
  attachCreative,
  BLOCKED_REASON,
  readVideoDuration,
  formatCount,
  slotLabel,
  countryName,
} from '../lib/advertiseData';
import './Advertise.scss';

// The inventory forecast only moves every few hours, so a long stale time keeps
// the page instant on revisit without ever showing a number the backend disowns.
const INVENTORY_STALE_MS = 10 * 60 * 1000;

const EMPTY_FORM = {
  hiveAccount: '',
  projectName: '',
  website: '',
  contact: '',
  category: '',
  budgetHbd: '',
  markets: [],
  creativeConcept: '',
};

function StatTile({ value, label, note }) {
  return (
    <div className="adv-stat">
      <span className="adv-stat-value">{value}</span>
      <span className="adv-stat-label">{label}</span>
      {note ? <span className="adv-stat-note">{note}</span> : null}
    </div>
  );
}

function InventoryPanel({ data, isLoading, error }) {
  if (isLoading) return <div className="adv-panel adv-panel-muted">Loading current availability…</div>;

  if (error) {
    // A 503 means the forecast job has not produced a snapshot yet — that is a
    // different message from "something broke", and an advertiser deserves the
    // honest one rather than a spinner that never resolves.
    // 404 means the whole ad surface is switched off server-side, not that one
    // number is missing — and in that state the form below does NOT work either,
    // so saying it does would send someone into a dead end.
    if (error.status === 404) {
      return (
        <div className="adv-panel adv-panel-muted">
          Advertising is switched off at the moment. Nothing here will submit until it is turned back on.
        </div>
      );
    }
    return (
      <div className="adv-panel adv-panel-muted">
        {error.status === 503
          ? 'Availability figures are being recalculated. Apply below and we will send you the current numbers with your quote.'
          : 'Availability figures are temporarily unavailable. The application form below still works.'}
      </div>
    );
  }
  if (!data) return null;

  const { audience, slots, quality, trial } = data;
  // Mid-roll first: it is what we actually sell, and leading with the bigger
  // pre-roll number would be selling a slot we do not recommend.
  const ordered = [...(slots || [])].sort((a, b) => (a.position === 0 ? 1 : b.position === 0 ? -1 : a.position - b.position));
  const topCountries = (audience?.countries || []).slice(0, 6);

  return (
    <div className="adv-inventory">
      {trial?.active && (
        // Without this a reader takes platform capacity for what their spot would
        // reach today. The restriction is real and stating it costs us nothing.
        <p className="adv-note adv-note-trial">
          <MdInfoOutline aria-hidden="true" />
          <span>{trial.note}</span>
        </p>
      )}
      <div className="adv-stats">
        <StatTile value={formatCount(audience?.sessionsPerDay)} label="Watch sessions a day" note="Trailing 7 days, after filtering" />
        <StatTile value={formatCount(audience?.videos)} label="Videos in the pool" note={`Last ${data.windowDays} days`} />
        <StatTile value={formatCount(audience?.watchHours)} label="Watch hours" note={`Last ${data.windowDays} days`} />
      </div>

      <div className="adv-slots">
        <h3>Where a spot can run</h3>
        <div className="adv-table-wrap">
          <table className="adv-table">
            <thead>
              <tr>
                <th>Placement</th>
                <th className="num">Plays a day</th>
                <th className="num">Plays a month</th>
                <th className="num">Reach</th>
              </tr>
            </thead>
            <tbody>
              {ordered.map((s) => (
                <tr key={s.position} className={s.position === 0 ? 'adv-row-muted' : ''}>
                  <td>
                    {slotLabel(s)}
                    {s.position === 0 ? <span className="adv-tag">not recommended</span> : null}
                  </td>
                  <td className="num">{formatCount(s.perDay)}</td>
                  <td className="num">{formatCount(s.perMonth)}</td>
                  <td className="num">{s.reachPct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="adv-fine">
          A spot before the video reaches more sessions on paper, but almost half of all
          watching here stops inside fifteen seconds — so most of those plays land on
          someone who was already leaving. A spot placed further in is counted only when
          the viewer actually got there.
        </p>
      </div>

      {topCountries.length > 0 && (
        <div className="adv-countries">
          <h3>Who watches</h3>
          <ul className="adv-country-list">
            {topCountries.map((c) => (
              <li key={c.code}>
                <span className="adv-country-name">{countryName(c.code)}</span>
                <span className="adv-country-bar" aria-hidden="true">
                  <span style={{ width: `${Math.min(100, c.sharePct * 3)}%` }} />
                </span>
                <span className="adv-country-share">{c.sharePct}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {quality && (
        <p className="adv-note">
          <MdInfoOutline aria-hidden="true" />
          <span>
            <strong>{quality.removedPct}% of raw traffic is excluded</strong> from these
            figures — sessions under {quality.minEngagedSeconds} seconds, accounts whose
            average session is too short to be a person watching, and videos whose creator
            opted out. What is left is what we are willing to sell.
          </span>
        </p>
      )}
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    pending: { Icon: MdSchedule, label: 'Under review' },
    approved: { Icon: MdCheckCircle, label: 'Approved' },
    rejected: { Icon: MdCancel, label: 'Not accepted' },
  };
  const { Icon, label } = map[status] || map.pending;
  return (
    <span className={`adv-status adv-status-${status}`}>
      <Icon aria-hidden="true" /> {label}
    </span>
  );
}

/**
 * Book a flight, pay for it, and see what ran.
 *
 * Payment is a plain Hive transfer with a memo — no wallet integration, no
 * redirect, nothing to break. The advertiser sends it from wherever they keep their
 * HBD and presses check; the server reads the payment account's own history and
 * matches the memo, so nothing about the money is taken on trust from this page.
 */
function CampaignPanel({ reference, pricing, creatives, onNeedCreative }) {
  const [campaigns, setCampaigns] = useState([]);
  const [days, setDays] = useState(pricing?.minDays || 7);
  const [slot, setSlot] = useState(null);
  // "Make the spot for us" — a one-time fee on top of the flight, in the same total
  // so the advertiser sends one transfer rather than two.
  const [wantProduction, setWantProduction] = useState(false);
  const [brief, setBrief] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const refresh = useCallback(() => {
    fetchCampaigns(reference)
      .then((r) => setCampaigns(r.campaigns || []))
      .catch(() => { /* an unreadable list is not worth an error banner */ });
  }, [reference]);
  useEffect(() => { refresh(); }, [refresh]);

  // Mid-roll first, and pre-roll last with its warning: the honest recommendation is
  // not the one with the biggest number on it.
  const slots = useMemo(() => {
    const list = (pricing?.slotPositions || []).slice();
    return list.sort((a, b) => (a === 0 ? 1 : b === 0 ? -1 : a - b));
  }, [pricing]);
  const chosenSlot = slot ?? slots[0] ?? 30;
  const productionFee = wantProduction ? (pricing?.productionFeeHbd || 0) : 0;
  const flight = pricing ? Math.round(days * pricing.pricePerDayHbd * 1000) / 1000 : null;
  const total = flight != null ? Math.round((flight + productionFee) * 1000) / 1000 : null;
  const briefTooShort = wantProduction && brief.trim().length < 20;

  async function onBook(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setError(null);
    try {
      const res = await createCampaign({
        reference,
        days: Number(days),
        slotPosition: Number(chosenSlot),
        production: wantProduction ? { requested: true, brief: brief.trim() } : undefined,
      });
      toast.success('Flight booked — send the payment to start it');
      refresh();
      if (!creatives.length) onNeedCreative?.();
      return res;
    } catch (err) {
      setError(err.message || 'Could not book that flight');
    } finally { setBusy(false); }
    return null;
  }

  async function onCheckPayment(id) {
    setError(null);
    try {
      const r = await claimCampaign(id);
      toast.success(r.message || 'Payment found');
      refresh();
    } catch (err) {
      // A missing payment is the normal case right after booking, not a failure.
      setError(err.status === 404 ? 'No matching transfer found yet — it can take a moment to appear on chain.' : (err.message || 'Could not check'));
    }
  }

  async function onAttach(id, embedId) {
    try {
      await attachCreative({ reference, campaignId: id, embedId });
      toast.success('Spot attached');
      refresh();
    } catch (err) { setError(err.message || 'Could not attach that spot'); }
  }

  const ready = creatives.filter((c) => c.status === 'ready');

  return (
    <div className="adv-campaigns">
      <h3>Your flights</h3>

      <form className="adv-book" onSubmit={onBook}>
        <div className="adv-field">
          <label htmlFor="adv-days">Days</label>
          <input
            id="adv-days" type="number" min={pricing?.minDays || 7} max={pricing?.maxDays || 90}
            value={days} onChange={(e) => setDays(e.target.value)}
          />
        </div>
        <div className="adv-field">
          <label htmlFor="adv-slot">Placement</label>
          <select id="adv-slot" value={chosenSlot} onChange={(e) => setSlot(Number(e.target.value))}>
            {slots.map((p) => (
              <option key={p} value={p}>
                {p === 0 ? 'Before the video (not recommended)' : slotLabel({ position: p })}
              </option>
            ))}
          </select>
        </div>
        <div className="adv-production">
          <label className="adv-check">
            <input
              type="checkbox"
              checked={wantProduction}
              onChange={(e) => setWantProduction(e.target.checked)}
            />
            <span>
              Have us make the video for you
              {pricing?.productionFeeHbd
                ? <> &mdash; a one-off <strong>{pricing.productionFeeHbd} HBD</strong> on top of the flight</>
                : null}
            </span>
          </label>
          {wantProduction && (
            <div className="adv-field adv-field-wide">
              <label htmlFor="adv-brief">What should the spot say?</label>
              <textarea
                id="adv-brief"
                rows={4}
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                placeholder="What you are advertising, who it is for, the one thing a viewer should remember, and anything you want us to avoid. Upload a logo or stills above and we will use them."
              />
              <span className="adv-hint">
                {briefTooShort
                  ? `${20 - brief.trim().length} more characters — we cannot make a spot from a blank brief`
                  : 'Enough to work from, thanks'}
              </span>
            </div>
          )}
        </div>

        <div className="adv-book-total">
          {total != null ? (
            <span>
              <strong>{total} HBD</strong> total
              {productionFee > 0 ? <span className="adv-hint"> ({flight} flight + {productionFee} production)</span> : null}
            </span>
          ) : null}
          <button type="submit" className="adv-primary" disabled={busy || briefTooShort}>
            {busy ? 'Booking…' : 'Book this flight'}
          </button>
        </div>
      </form>
      {error ? <p className="adv-upload-error">{error}</p> : null}

      {campaigns.length > 0 && (
        <ul className="adv-campaign-list">
          {campaigns.map((c) => (
            <li key={c.id}>
              <div className="adv-campaign-head">
                <span className="adv-campaign-name">{c.name}</span>
                <span className="adv-creative-status">{c.status.replace(/_/g, ' ')}</span>
              </div>
              <div className="adv-creative-meta">
                {c.days} days · {slotLabel({ position: c.slotPosition })} · {c.priceHbd} HBD
                {c.forecast != null ? ` · forecast ${formatCount(c.forecast)} play${c.forecast === 1 ? '' : 's'}` : ''}
              </div>

              {c.production && (
                <div className="adv-campaign-blocked">
                  We are making the video · {c.production.status}
                  {c.productionFeeHbd ? ` · ${c.productionFeeHbd} HBD` : ''}
                </div>
              )}

              {c.blockedBy && (
                <div className="adv-campaign-blocked">
                  {BLOCKED_REASON[c.blockedBy] || c.blockedBy}
                </div>
              )}

              {c.paidHbd < c.priceHbd && (
                <div className="adv-pay">
                  <p className="adv-fine">
                    Send <strong>{(c.priceHbd - c.paidHbd).toFixed(3)} HBD</strong> to{' '}
                    <strong>@{c.payTo}</strong> with the memo <code>{c.memo}</code>. HIVE works too and
                    is valued at the on-chain price.
                  </p>
                  <button type="button" className="adv-secondary" onClick={() => onCheckPayment(c.id)}>
                    I have sent it
                  </button>
                </div>
              )}

              {!c.creative && ready.length > 0 && (
                <div className="adv-pay">
                  <label className="adv-hint" htmlFor={`attach-${c.id}`}>Attach an approved spot</label>
                  <select
                    id={`attach-${c.id}`}
                    defaultValue=""
                    onChange={(e) => e.target.value && onAttach(c.id, e.target.value)}
                  >
                    <option value="" disabled>Choose one</option>
                    {ready.map((cr) => (
                      <option key={cr.embedId} value={cr.permlink || cr.embedId}>
                        {cr.durationSeconds}s spot
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {(c.delivered > 0 || c.status === 'complete') && (
                <div className="adv-delivery">
                  <span><strong>{formatCount(c.delivered)}</strong> play{c.delivered === 1 ? '' : 's'} delivered
                    {c.forecast ? ` of ${formatCount(c.forecast)} forecast` : ''}</span>
                  {c.refundHbd > 0 && (
                    <span className="adv-refund">
                      {c.refundHbd} HBD owed back for under-delivery
                      {c.refundStatus === 'pending' ? ' — we will send it' : ''}
                    </span>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const CREATIVE_STATUS = {
  pending: 'Encoding',
  review: 'Waiting for review',
  ready: 'Approved',
  rejected: 'Not accepted',
};

/**
 * Upload the spot. Only appears once an application is approved, because an
 * unapproved advertiser uploading video is just us hosting files for strangers.
 *
 * The upload goes through the ordinary pipeline but is never published to Hive —
 * it has no post, earns nothing, and appears in no feed. It exists so the spot can
 * be watched and approved before it ever runs in front of anyone.
 */
function CreativePanel({ reference, account, maxSeconds, onCreatives }) {
  const [creatives, setCreatives] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  const refresh = useCallback(() => {
    fetchCreatives(reference)
      .then((r) => { setCreatives(r.creatives || []); onCreatives?.(r.creatives || []); })
      .catch(() => { /* an unreadable list is not worth an error banner */ });
  }, [reference, onCreatives]);

  useEffect(() => { refresh(); }, [refresh]);

  async function onFile(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      if ((file.type || '').startsWith('image/')) {
        // A still is an asset, not a spot. Said plainly here so nobody uploads a
        // banner and waits for it to start running.
        await uploadImageAsset({ file, reference });
        toast.success('Image saved — it cannot run on its own, but we can build a spot around it');
      } else {
        // Checked here as well as on the server so a too-long spot fails in a second
        // rather than after an upload.
        const durationSeconds = await readVideoDuration(file);
        if (durationSeconds && maxSeconds && durationSeconds > maxSeconds) {
          throw new Error(`That spot is ${durationSeconds} seconds. The slot is ${maxSeconds}.`);
        }
        await uploadCreative({ file, account, reference, durationSeconds });
        toast.success('Spot uploaded — we will review it before it runs');
      }
      refresh();
    } catch (err) {
      setError(err.message || 'Upload failed');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';   // let the same file be retried
    }
  }

  return (
    <div className="adv-creatives">
      <h3>Your spot</h3>
      <p className="adv-fine">
        Upload the video you want to run. It is never posted to Hive and never appears
        in any feed &mdash; it goes through the same encoder as everything else so it
        plays cleanly inside a break, and then waits for us to watch it.
        {maxSeconds ? ` Up to ${maxSeconds} seconds.` : null}
        {' '}You can also upload stills &mdash; a logo, key art, a frame. An image
        cannot play inside a break on its own, but we can build a spot around it.
      </p>

      <div className="adv-upload-row">
        <input
          ref={inputRef}
          id="adv-creative-file"
          type="file"
          accept="video/*,image/*"
          onChange={onFile}
          disabled={busy}
          className="adv-visually-hidden"
        />
        <label htmlFor="adv-creative-file" className={`adv-primary adv-upload-btn${busy ? ' disabled' : ''}`}>
          {busy ? 'Uploading…' : 'Upload a video or image'}
        </label>
      </div>
      {error ? <p className="adv-upload-error">{error}</p> : null}

      {creatives.length > 0 && (
        <ul className="adv-creative-list">
          {creatives.map((c) => (
            <li key={c.embedId}>
              <span className={`adv-creative-status adv-creative-${c.status}`}>
                {CREATIVE_STATUS[c.status] || c.status}
              </span>
              <span className="adv-creative-meta">
                {c.kind === 'image'
                  ? 'Image · cannot run on its own'
                  : (c.durationSeconds ? `${c.durationSeconds}s` : 'duration unknown')}
                {c.note ? ` · ${c.note}` : ''}
              </span>
              {c.kind === 'image' ? (
                <a href={c.imageUrl} target="_blank" rel="noopener noreferrer">View it</a>
              ) : c.previewUrl && c.encoded ? (
                <a href={c.previewUrl} target="_blank" rel="noopener noreferrer">Watch it back</a>
              ) : <span className="adv-creative-meta">still encoding</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function Advertise() {
  const user = useAppStore((s) => s.user);
  const [form, setForm] = useState(() => ({ ...EMPTY_FORM, hiveAccount: user || '' }));
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [lookupRef, setLookupRef] = useState('');
  const [lookup, setLookup] = useState(null);
  const [lookingUp, setLookingUp] = useState(false);
  // Lifted so the flight panel can offer the spots the creative panel has loaded.
  const [creativeList, setCreativeList] = useState([]);

  const { data: inventory, isLoading, error } = useQuery({
    queryKey: ['advertise-inventory'],
    queryFn: fetchInventory,
    staleTime: INVENTORY_STALE_MS,
    retry: false,
  });

  // The rate card also carries the slot length, which is the limit the upload
  // control enforces. One source for it rather than a number typed into the UI.
  const { data: pricing } = useQuery({
    queryKey: ['advertise-pricing'],
    queryFn: fetchPricing,
    staleTime: INVENTORY_STALE_MS,
    retry: false,
  });

  // Offer the markets we can actually deliver rather than a full country list —
  // picking a market with no audience here helps nobody.
  const marketOptions = useMemo(
    () => (inventory?.audience?.countries || []).filter((c) => c.code !== 'unknown').slice(0, 12),
    [inventory],
  );

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const toggleMarket = (code) => setForm((f) => ({
    ...f,
    markets: f.markets.includes(code) ? f.markets.filter((m) => m !== code) : [...f.markets, code],
  }));

  const conceptLeft = 20 - form.creativeConcept.trim().length;

  // Closed testing. Gated here rather than at the route so a typed-in URL is shut
  // too, not just a link nobody is showing yet. The checker refuses writes from
  // accounts outside the beta regardless — this is the courtesy, not the lock.
  //
  // MUST stay below every hook above: `user` arrives asynchronously, so an early
  // return placed higher would run a different number of hooks before and after
  // login and React would tear the component down instead of revealing the page.
  if (!adsEnabledFor(user)) return <NotFound />;

  async function onSubmit(e) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const payload = {
        hiveAccount: form.hiveAccount.trim().toLowerCase().replace(/^@/, ''),
        projectName: form.projectName.trim(),
        website: form.website.trim() || undefined,
        contact: form.contact.trim(),
        category: form.category,
        creativeConcept: form.creativeConcept.trim(),
        markets: form.markets,
      };
      const budget = parseFloat(form.budgetHbd);
      if (Number.isFinite(budget) && budget > 0) payload.budgetHbd = budget;

      const res = await submitApplication(payload);
      setReceipt(res);
      setForm({ ...EMPTY_FORM, hiveAccount: user || '' });
      toast.success('Application received');
    } catch (err) {
      // The backend returns the reference on a duplicate, which is exactly what
      // someone re-submitting has lost — surface it instead of a bare error.
      if (err.status === 409 && err.body?.reference) {
        setReceipt({ reference: err.body.reference, status: err.body.status, message: err.message });
        toast.info(err.message);
      } else {
        toast.error(err.message || 'Could not submit the application');
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function onLookup(e) {
    e.preventDefault();
    const ref = lookupRef.trim();
    if (!ref || lookingUp) return;
    setLookingUp(true);
    setLookup(null);
    try {
      setLookup(await fetchApplication(ref));
    } catch (err) {
      toast.error(err.status === 404 ? 'No application with that reference' : (err.message || 'Lookup failed'));
    } finally {
      setLookingUp(false);
    }
  }

  return (
    <div className="advertise-page">
      <header className="adv-header">
        <MdCampaign className="adv-header-icon" aria-hidden="true" />
        <div>
          <h1>Advertise on 3Speak</h1>
          <p className="adv-lede">
            Put a short spot inside videos on 3Speak, paid in HBD or HIVE. Every advertiser
            is reviewed by hand, so tell us who you are and what you want to run.
          </p>
        </div>
      </header>

      <section className="adv-section">
        <h2>What you would be buying</h2>
        <InventoryPanel data={inventory} isLoading={isLoading} error={error} />
      </section>

      <section className="adv-section">
        <h2>How it is priced</h2>
        <p>
          Spots are sold as a flat booking — your spot runs across the network for a fixed
          period, at a fixed price in HBD. We do not sell by the thousand impressions: at
          this scale that would mean quoting numbers too small to mean anything, and it
          rewards padding the count instead of finding the right audience.
        </p>
        <p>
          You are quoted against the forecast above and reported against what actually
          played. If delivery falls short of the forecast, the difference comes back as
          credit on your next booking.
        </p>
      </section>

      <section className="adv-section">
        <h2>Apply</h2>
        {receipt ? (
          <div className="adv-receipt">
            <StatusBadge status={receipt.status || 'pending'} />
            <p>{receipt.message || 'Your application is with us.'}</p>
            <p className="adv-reference">
              Your reference: <code>{receipt.reference}</code>
            </p>
            <p className="adv-fine">
              Keep it — it is the only way to check back on this application, and we do not
              ask for an account name to look one up.
            </p>
            <button type="button" className="adv-secondary" onClick={() => setReceipt(null)}>
              Submit another
            </button>
          </div>
        ) : (
          <form className="adv-form" onSubmit={onSubmit}>
            <div className="adv-field">
              <label htmlFor="adv-account">Hive account</label>
              <input
                id="adv-account"
                value={form.hiveAccount}
                onChange={set('hiveAccount')}
                placeholder="yourproject"
                autoComplete="off"
                required
              />
              <span className="adv-hint">The account the booking will be paid from.</span>
            </div>

            <div className="adv-field">
              <label htmlFor="adv-project">Project</label>
              <input id="adv-project" value={form.projectName} onChange={set('projectName')} required />
            </div>

            <div className="adv-field">
              <label htmlFor="adv-website">Website <span className="adv-optional">optional</span></label>
              <input id="adv-website" type="url" value={form.website} onChange={set('website')} placeholder="https://" />
            </div>

            <div className="adv-field">
              <label htmlFor="adv-contact">How we reach you</label>
              <input
                id="adv-contact"
                value={form.contact}
                onChange={set('contact')}
                placeholder="Discord, Telegram, email — whatever you actually read"
                required
              />
            </div>

            <div className="adv-field">
              <label htmlFor="adv-category">Category</label>
              <select id="adv-category" value={form.category} onChange={set('category')} required>
                <option value="" disabled>Choose one</option>
                {AD_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>

            <div className="adv-field">
              <label htmlFor="adv-budget">Budget in HBD <span className="adv-optional">optional</span></label>
              <input
                id="adv-budget"
                type="number"
                min="0"
                step="1"
                inputMode="decimal"
                value={form.budgetHbd}
                onChange={set('budgetHbd')}
                placeholder="250"
              />
              <span className="adv-hint">A rough figure is enough — it tells us which slots to quote.</span>
            </div>

            {marketOptions.length > 0 && (
              <div className="adv-field adv-field-wide">
                <span className="adv-label">Markets <span className="adv-optional">optional</span></span>
                <div className="adv-chips">
                  {marketOptions.map((c) => (
                    <button
                      key={c.code}
                      type="button"
                      className={`adv-chip${form.markets.includes(c.code) ? ' selected' : ''}`}
                      aria-pressed={form.markets.includes(c.code)}
                      onClick={() => toggleMarket(c.code)}
                    >
                      {countryName(c.code)} <span className="adv-chip-share">{c.sharePct}%</span>
                    </button>
                  ))}
                </div>
                <span className="adv-hint">Leave all unselected to run everywhere.</span>
              </div>
            )}

            <div className="adv-field adv-field-wide">
              <label htmlFor="adv-concept">What do you want to run?</label>
              <textarea
                id="adv-concept"
                rows={5}
                value={form.creativeConcept}
                onChange={set('creativeConcept')}
                placeholder="The spot itself, who it is aimed at, and roughly when you would want it live."
                required
              />
              <span className="adv-hint">
                {conceptLeft > 0 ? `${conceptLeft} more characters` : 'Enough to go on, thanks'}
              </span>
            </div>

            <div className="adv-actions">
              <button type="submit" className="adv-primary" disabled={submitting}>
                {submitting ? 'Sending…' : 'Send application'}
              </button>
              <span className="adv-fine">Reviewed by a person. We do not accept everyone.</span>
            </div>
          </form>
        )}
      </section>

      <section className="adv-section">
        <h2>Check an application</h2>
        <form className="adv-lookup" onSubmit={onLookup}>
          <label className="adv-visually-hidden" htmlFor="adv-ref">Application reference</label>
          <input
            id="adv-ref"
            value={lookupRef}
            onChange={(e) => setLookupRef(e.target.value)}
            placeholder="Your reference"
            autoComplete="off"
          />
          <button type="submit" className="adv-secondary" disabled={lookingUp || !lookupRef.trim()}>
            {lookingUp ? 'Checking…' : 'Check'}
          </button>
        </form>
        {lookup && (
          <div className="adv-lookup-result">
            <StatusBadge status={lookup.status} />
            <p><strong>{lookup.projectName}</strong> · @{lookup.hiveAccount}</p>
            {lookup.note ? <p className="adv-lookup-note">{lookup.note}</p> : null}
            {lookup.status === 'approved' && (
              <>
                <CreativePanel
                  reference={lookupRef.trim()}
                  account={lookup.hiveAccount}
                  maxSeconds={pricing?.maxCreativeSeconds}
                  onCreatives={setCreativeList}
                />
                <CampaignPanel
                  reference={lookupRef.trim()}
                  pricing={pricing}
                  creatives={creativeList}
                />
              </>
            )}
          </div>
        )}
      </section>

      <section className="adv-section adv-creators">
        <h2>If you are a creator</h2>
        <p>
          Spots run across the network by default, and a share of what they earn goes to the
          creator whose video carried them and to the community it was posted in. You can turn
          ads off for your own videos at any time — a video with ads switched off is removed
          from the availability figures above as well, so nothing is sold that we have promised
          not to use.
        </p>
      </section>
    </div>
  );
}
