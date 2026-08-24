import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MdCampaign, MdInfoOutline, MdCheckCircle, MdSchedule, MdCancel } from 'react-icons/md';
import { toast } from 'sonner';
import { useAppStore } from '../lib/store';
import { adsEnabledFor } from '../utils/config';
import SEOHead from '../components/SEOHead';
import NotFound from './NotFound';
import AdOverlay from '../components/ads/AdOverlay';
import {
  AD_CATEGORIES,
  fetchInventory,
  submitApplication,
  fetchApplication,
  fetchMyApplications,
  rememberReference,
  rememberedReferences,
  identityIsSilent,
  uploadCreative,
  uploadImageAsset,
  uploadLogo,
  saveBranding,
  SLOGAN_MAX,
  fetchCreatives,
  fetchPricing,
  createCampaign,
  fetchCampaigns,
  fetchSlots,
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

// Country breakdown and per-market targeting, hidden for now. The numbers behind
// them are real but thin at this scale — a market with a 4% share is a handful of
// sessions a day, and offering it as something to buy promises a precision we
// cannot deliver yet. Flip to true to bring back both the "Who watches" panel and
// the market chips on the form; the backend has accepted `markets` all along.
const SHOW_MARKETS = false;

const EMPTY_FORM = {
  projectName: '',
  website: '',
  contact: '',
  category: '',
  budgetHbd: '',
  markets: [],
  creativeConcept: '',
  // "Have us make the video for you", asked here rather than only at booking —
  // most applicants have no spot yet, and that changes what we are approving.
  wantProduction: false,
  productionBrief: '',
};

function StatTile({ value, label, note }) {
  return (
    <div className="mkt-stat">
      <span className="mkt-stat-value">{value}</span>
      <span className="mkt-stat-label">{label}</span>
      {note ? <span className="mkt-stat-note">{note}</span> : null}
    </div>
  );
}

function InventoryPanel({ data, isLoading, error }) {
  if (isLoading) return <div className="mkt-panel mkt-panel-muted">Loading current availability…</div>;

  if (error) {
    // A 503 means the forecast job has not produced a snapshot yet — that is a
    // different message from "something broke", and an advertiser deserves the
    // honest one rather than a spinner that never resolves.
    // 404 means the whole ad surface is switched off server-side, not that one
    // number is missing — and in that state the form below does NOT work either,
    // so saying it does would send someone into a dead end.
    if (error.status === 404) {
      return (
        <div className="mkt-panel mkt-panel-muted">
          Advertising is switched off at the moment. Nothing here will submit until it is turned back on.
        </div>
      );
    }
    return (
      <div className="mkt-panel mkt-panel-muted">
        {error.status === 503
          ? 'Availability figures are being recalculated. Apply below and we will send you the current numbers with your quote.'
          : 'Availability figures are temporarily unavailable. The form below still works.'}
      </div>
    );
  }
  if (!data) return null;

  const { audience, slots, quality, trial } = data;
  // Mid-roll first: it is what we actually sell, and leading with the bigger
  // pre-roll number would be selling a slot we do not recommend.
  // Plain time order. It used to push pre-roll to the bottom so the biggest number
  // would not lead, but a table of positions that is not in position order reads as
  // broken — the "not recommended" tag carries that argument on its own.
  const ordered = [...(slots || [])].sort((a, b) => a.percent - b.percent);
  const topCountries = (audience?.countries || []).slice(0, 6);

  return (
    <div className="mkt-inventory">
      {trial?.active && (
        // Without this a reader takes platform capacity for what their spot would
        // reach today. The restriction is real and stating it costs us nothing.
        <p className="mkt-note mkt-note-trial">
          <MdInfoOutline aria-hidden="true" />
          <span>{trial.note}</span>
        </p>
      )}
      <div className="mkt-stats">
        <StatTile value={formatCount(audience?.sessionsPerDay)} label="Watch sessions a day" note="Trailing 7 days, after filtering" />
        <StatTile value={formatCount(audience?.videos)} label="Videos in the pool" note={`Last ${data.windowDays} days`} />
        <StatTile value={formatCount(audience?.watchHours)} label="Watch hours" note={`Last ${data.windowDays} days`} />
      </div>

      <div className="mkt-slots">
        <h3>Where an ad can run</h3>
        <div className="mkt-table-wrap">
          <table className="mkt-table">
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
                <tr key={s.percent}>
                  <td>
                    {slotLabel(s)}
                    {s.percent === 0 ? <span className="mkt-tag">not recommended</span> : null}
                  </td>
                  <td className="num">{formatCount(s.perDay)}</td>
                  <td className="num">{formatCount(s.perMonth)}</td>
                  <td className="num">{s.reachPct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mkt-fine">
          <strong>Not recommended:</strong> an ad before the video reaches more sessions on
          paper, but almost half of all
          watching here stops inside fifteen seconds — so most of those plays land on
          someone who was already leaving. An ad placed further in is counted only when
          the viewer actually got there.
        </p>
      </div>

      {SHOW_MARKETS && topCountries.length > 0 && (
        <div className="mkt-countries">
          <h3>Who watches</h3>
          <ul className="mkt-country-list">
            {topCountries.map((c) => (
              <li key={c.code}>
                <span className="mkt-country-name">{countryName(c.code)}</span>
                <span className="mkt-country-bar" aria-hidden="true">
                  <span style={{ width: `${Math.min(100, c.sharePct * 3)}%` }} />
                </span>
                <span className="mkt-country-share">{c.sharePct}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {quality && (
        <p className="mkt-note">
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

/**
 * Pick what you are buying, before anything else on the form.
 *
 * The three products differ in price, in maximum length, in what you have to supply
 * and in whether a position is even a thing you choose — so the type has to be
 * settled first and the rest of the form follows from it. Showing every field for
 * every format and letting the server refuse the wrong combinations was the version
 * this replaces.
 *
 * Rendered from whatever the rate card returns rather than a list held here, so a
 * format added on the server appears without a frontend change.
 */
function FormatPicker({ formats, value, onChange }) {
  if (!formats?.length) return null;
  return (
    <fieldset className="mkt-group mkt-formats">
      <legend>What you are buying</legend>
      <div className="mkt-format-list" role="radiogroup" aria-label="Ad type">
        {formats.map((f) => {
          const on = f.key === value;
          return (
            <button
              type="button"
              key={f.key}
              role="radio"
              aria-checked={on}
              className={`mkt-format${on ? ' is-on' : ''}`}
              onClick={() => onChange(f.key)}
            >
              <span className="mkt-format-head">
                <span className="mkt-format-name">{f.label}</span>
                <span className="mkt-format-rate">
                  {f.ratePerSecondDayHbd} HBD
                  <span className="mkt-format-rate-unit"> /sec /day</span>
                </span>
              </span>
              <span className="mkt-format-blurb">{f.blurb}</span>
              <span className="mkt-format-meta">
                {f.creativeKind === 'image' ? 'You supply an image' : 'You supply a video'}
                {' · up to '}{f.maxSeconds}s
                {f.rateIsCustom ? ' · your agreed rate' : null}
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
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
    <span className={`mkt-status mkt-status-${status}`}>
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
function CampaignPanel({ reference, pricing, creatives, onNeedCreative, production }) {
  const [campaigns, setCampaigns] = useState([]);
  const [days, setDays] = useState(pricing?.minDays || 7);
  // What is being bought. Everything below reads from the chosen format's own
  // record — its rate, its maximum length, whether it has a position at all — so
  // there is no second place where a product's rules are written down.
  const [formatKey, setFormatKey] = useState(null);
  const [slotPct, setSlotPct] = useState(null);
  // Which positions are free for this window. A position is sold exclusively across
  // formats, so the form asks before it offers rather than refusing at submit.
  const [slotState, setSlotState] = useState(null);
  // How long a spot this flight buys. Priced per second, so it is the other half of
  // the total alongside the number of days.
  const [spotSeconds, setSpotSeconds] = useState(null);
  // "Make the spot for us" lives up in the spot panel now, where the subject is the
  // video itself — asking "do you have a spot?" underneath Days and Placement put it
  // in the middle of a pricing decision. The fee is still charged HERE, on the
  // flight, so the state is passed down rather than moved.
  const wantProduction = !!production?.wanted;
  const brief = production?.brief || '';
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  // Which creative is PICKED, per flight, before it is committed. Choosing from a
  // dropdown used to attach immediately — a single mis-click bound a creative to a
  // flight with no confirmation and no way back. Picking and saving are two acts.
  const [picked, setPicked] = useState({});
  const [saving, setSaving] = useState(null);

  const refresh = useCallback(() => {
    fetchCampaigns(reference)
      .then((r) => setCampaigns(r.campaigns || []))
      .catch(() => { /* an unreadable list is not worth an error banner */ });
  }, [reference]);
  useEffect(() => { refresh(); }, [refresh]);

  const formats = pricing?.formats || [];
  // Default to the first format the server offers rather than naming one here: the
  // registry decides what exists and in what order.
  const fmt = formats.find((f) => f.key === formatKey) || formats[0] || null;

  // Availability is per WINDOW, so it is re-read when the length of the flight
  // changes. Failure is silent and leaves every slot selectable — the server still
  // refuses a taken one, and a broken availability call must not block a booking.
  useEffect(() => {
    // Nothing to clear on the way out: availability is only ever read for a format
    // that HAS a position, so a stale list for an unpositioned one is never seen.
    if (!fmt?.positioned) return undefined;
    let live = true;
    fetchSlots({ days: Number(days) })
      .then((r) => { if (live) setSlotState(r.slots || null); })
      .catch(() => { if (live) setSlotState(null); });
    return () => { live = false; };
  }, [days, fmt?.positioned]);

  // Mid-roll first, and pre-roll last with its warning: the honest recommendation is
  // not the one with the biggest number on it.
  const slots = useMemo(() => {
    const list = (pricing?.slotPercents || []).slice();
    return list.sort((a, b) => a - b);
  }, [pricing]);
  const slotTaken = (p) => {
    const row = slotState?.find((x) => x.percent === p);
    return row ? !row.available : false;
  };
  // Default to the first slot that is NOT pre-roll, since pre-roll is the one we
  // recommend against — leading with it would be selling against our own advice.
  // Default to the first FREE slot that is not pre-roll. Defaulting to a taken one
  // would show a total for something that cannot be bought.
  const chosenSlot = slotPct
    ?? slots.find((p) => p > 0 && !slotTaken(p))
    ?? slots.find((p) => !slotTaken(p))
    ?? slots.find((p) => p > 0)
    ?? slots[0] ?? 25;

  // The FORMAT's cap, not the platform's — a banner may stay up longer than a spot
  // may run, and quoting one number for both was how the old form read.
  const maxSpot = fmt?.maxSeconds || pricing?.maxCreativeSeconds || 15;
  const minSpot = pricing?.minSpotSeconds || 1;
  const chosenLength = spotSeconds ?? maxSpot;
  const lengthOk = Number.isInteger(chosenLength) && chosenLength >= minSpot && chosenLength <= maxSpot;

  // Video-length targeting, entered in seconds and open-ended at both ends.
  const [minVideo, setMinVideo] = useState('');
  const [maxVideo, setMaxVideo] = useState('');
  const minVideoNum = parseInt(minVideo, 10);
  const maxVideoNum = parseInt(maxVideo, 10);
  const videoRangeOk = !(Number.isFinite(minVideoNum) && Number.isFinite(maxVideoNum)
    && minVideoNum > maxVideoNum);

  const productionFee = wantProduction ? (pricing?.productionFeeHbd || 0) : 0;
  // Must match priceForDays() in 3speakchecks/utils/adModel.js: days x rate x
  // seconds. The quote shown here and the price the server writes have to agree.
  // Must match priceForDays() in 3speakchecks/utils/adModel.js, at the rate for THIS
  // format: days x rate x seconds. The quote shown here and the price the server
  // writes have to agree.
  const rate = fmt ? fmt.ratePerSecondDayHbd : pricing?.pricePerSecondDayHbd;
  const flight = rate != null
    ? Math.round(days * rate * chosenLength * 1000) / 1000
    : null;
  const total = flight != null ? Math.round((flight + productionFee) * 1000) / 1000 : null;
  const briefTooShort = wantProduction && brief.trim().length < 20;

  async function onBook(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setError(null);
    try {
      const res = await createCampaign({
        reference,
        format: fmt?.key,
        days: Number(days),
        // Omitted entirely for a format with no position: sending one would be a
        // value the advertiser never chose.
        slotPercent: fmt?.positioned ? Number(chosenSlot) : undefined,
        spotSeconds: Number(chosenLength),
        minVideoSeconds: Number.isFinite(minVideoNum) && minVideoNum > 0 ? minVideoNum : undefined,
        maxVideoSeconds: Number.isFinite(maxVideoNum) && maxVideoNum > 0 ? maxVideoNum : undefined,
        production: wantProduction ? { requested: true, brief: brief.trim() } : undefined,
      });
      toast.success('Booked. Send the payment to start it');
      refresh();
      if (!creatives.length) onNeedCreative?.();
      return res;
    } catch (err) {
      setError(err.message || 'Could not make that booking');
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

  /**
   * Attach an approved creative to a flight.
   *
   * A video spot is attached by its embed id; a banner is an image and is attached
   * by its URL. Which one to send is decided from the CREATIVE, not the campaign,
   * because that is the thing actually being sent — and sending the wrong one gets
   * "a player banner is an image, send imageUrl" from the server, which is a correct
   * answer to a question the page should not have asked.
   */
  async function onAttach(id) {
    const value = picked[id];
    if (!value || saving) return;
    const cr = creatives.find((c) => (c.permlink || c.embedId) === value);
    setSaving(id); setError(null);
    try {
      await attachCreative(cr?.kind === 'image'
        ? { reference, campaignId: id, imageUrl: cr.imageUrl }
        : { reference, campaignId: id, embedId: value });
      toast.success(cr?.kind === 'image' ? 'Banner saved' : 'Spot saved');
      setPicked((p) => { const n = { ...p }; delete n[id]; return n; });
      refresh();
    } catch (err) {
      setError(err.message || 'Could not use that creative');
    } finally { setSaving(null); }
  }

  const ready = creatives.filter((c) => c.status === 'ready');
  /**
   * Only the creatives THIS flight can use. A banner flight cannot run a video and a
   * spot flight cannot run a still, so offering both and letting the server refuse
   * is a worse experience than offering the one that works.
   */
  const readyFor = (campaign) => (
    // No stated requirement — an older campaign shape, or a response from before the
    // server published it — means show everything. Guessing 'video' here would hide
    // a perfectly good banner from a banner flight and leave no way to attach it,
    // which is exactly the failure this filter was added to prevent.
    campaign.creativeKind
      ? ready.filter((cr) => (cr.kind || 'video') === campaign.creativeKind)
      : ready
  );

  return (
    <div className="mkt-campaigns">
      <h3>Your bookings</h3>

      <form className="mkt-book" onSubmit={onBook}>
        {/* The type comes first and the rest of the form follows from it: the three
            products differ in price, in length, in what you supply and in whether a
            position is even yours to choose. */}
        <FormatPicker formats={formats} value={fmt?.key} onChange={(k) => { setFormatKey(k); setSlotPct(null); setSpotSeconds(null); }} />

        {/* Grouped by what each field describes. Days, length and placement are the
            booking itself; the two duration fields are about the videos it may run
            on, which is a different question and was reading as more booking fields. */}
        <fieldset className="mkt-group">
          <legend>The booking</legend>
        <div className="mkt-field">
          <label htmlFor="mkt-days">Days</label>
          <input
            id="mkt-days" type="number" min={pricing?.minDays || 7} max={pricing?.maxDays || 90}
            value={days} onChange={(e) => setDays(e.target.value)}
          />
          <span className="mkt-hint">
            How long it runs. {pricing?.minDays || 7} to {pricing?.maxDays || 90}.
          </span>
        </div>
        <div className="mkt-field">
          <label htmlFor="mkt-length">
            {fmt?.creativeKind === 'image' ? 'How long it shows' : 'Ad length'}
          </label>
          <input
            id="mkt-length"
            type="number"
            min={minSpot}
            max={maxSpot}
            step="1"
            value={chosenLength}
            onChange={(e) => setSpotSeconds(e.target.value === '' ? '' : Number(e.target.value))}
          />
          <span className={`mkt-hint${lengthOk ? '' : ' mkt-hint-short'}`}>
            Seconds, {minSpot} to {maxSpot}.{' '}
            {fmt?.creativeKind === 'image'
              ? 'How long the banner stays on screen.'
              : 'Your ad video has to fit inside this.'}
          </span>
        </div>

        {/* Only for formats that HAVE a position. The pre-upload spot plays at the
            one moment it can play, so a placement field there would be something an
            advertiser fills in that changes nothing. */}
        {fmt?.positioned ? (
        <div className="mkt-field">
          <label htmlFor="mkt-slot">Placement</label>
          <select id="mkt-slot" value={chosenSlot} onChange={(e) => setSlotPct(Number(e.target.value))}>
            {slots.map((p) => (
              <option key={p} value={p} disabled={slotTaken(p)}>
                {p === 0 ? 'Before the video (not recommended)' : slotLabel({ percent: p })}
                {slotTaken(p) ? ' — taken for these dates' : ''}
              </option>
            ))}
          </select>
          <span className="mkt-hint">
            {/* A position is sold to one advertiser at a time, across every format —
                so this says what is actually for sale, not what exists. */}
            How far into each video it runs. Later reaches fewer people, but reaches
            them watching. One advertiser per position at a time.
          </span>
        </div>
        ) : null}
        </fieldset>

        {/* Both ends optional. Leaving one blank means "no limit on that end", so
            "at least three minutes" does not force you to invent a maximum. */}
        {/* Targeting by video length only means anything where there IS a video
            underneath. The pre-upload spot runs in the upload flow. */}
        {fmt?.surface === 'watch' ? (
        <fieldset className="mkt-group">
          <legend>Videos to run on <span className="mkt-optional">optional</span></legend>
        <div className="mkt-field">
          <label htmlFor="mkt-minvid">Shortest video</label>
          <input
            id="mkt-minvid" type="number" min="0" step="1" placeholder="any"
            value={minVideo} onChange={(e) => setMinVideo(e.target.value)}
          />
          <span className="mkt-hint">Seconds. Blank for no minimum.</span>
        </div>

        <div className="mkt-field">
          <label htmlFor="mkt-maxvid">Longest video</label>
          <input
            id="mkt-maxvid" type="number" min="0" step="1" placeholder="any"
            value={maxVideo} onChange={(e) => setMaxVideo(e.target.value)}
          />
          <span className={`mkt-hint${videoRangeOk ? '' : ' mkt-hint-short'}`}>
            {videoRangeOk
              ? 'Seconds. Blank for no maximum.'
              : 'The longest cannot be shorter than the shortest.'}
          </span>
        </div>
        </fieldset>
        ) : null}
        <div className="mkt-book-total">
          {total != null ? (
            <span>
              <strong>{total} HBD</strong> total
              {productionFee > 0 ? <span className="mkt-hint"> ({flight} booking + {productionFee} production)</span> : null}
              <span className="mkt-hint">
                {' '}· {fmt ? `${fmt.label}, ` : ''}{chosenLength}s × {days} days
                {fmt?.rateIsCustom ? ` at your agreed ${rate} HBD` : ` at ${rate} HBD`}
                {' '}per second per day
              </span>
            </span>
          ) : null}
          <button
            type="submit"
            className="mkt-outline"
            disabled={busy || briefTooShort || !lengthOk || !videoRangeOk
              || (fmt?.positioned && slotTaken(chosenSlot))}
          >
            {busy ? 'Booking…' : 'Book this ad'}
          </button>
        </div>
      </form>
      {error ? <p className="mkt-upload-error">{error}</p> : null}

      {campaigns.length > 0 && (
        <ul className="mkt-campaign-list">
          {campaigns.map((c) => (
            <li key={c.id}>
              <div className="mkt-campaign-head">
                <span className="mkt-campaign-name">{c.name}</span>
                <span className="mkt-creative-status">{c.status.replace(/_/g, ' ')}</span>
              </div>
              <div className="mkt-creative-meta">
                {c.days} days · {c.spotSeconds ? `${c.spotSeconds}s · ` : ''}
                {slotLabel({ percent: c.slotPercent, position: c.slotPosition })} · {c.priceHbd} HBD
                {c.forecast != null ? ` · forecast ${formatCount(c.forecast)} play${c.forecast === 1 ? '' : 's'}` : ''}
              </div>

              {c.production && (
                <div className="mkt-campaign-blocked">
                  We are making the video · {c.production.status}
                  {c.productionFeeHbd ? ` · ${c.productionFeeHbd} HBD` : ''}
                </div>
              )}

              {c.blockedBy && (
                <div className="mkt-campaign-blocked">
                  {BLOCKED_REASON[c.blockedBy] || c.blockedBy}
                </div>
              )}

              {c.paidHbd < c.priceHbd && (
                <div className="mkt-pay">
                  <p className="mkt-fine">
                    Send <strong>{(c.priceHbd - c.paidHbd).toFixed(3)} HBD</strong> to{' '}
                    <strong>@{c.payTo}</strong> with the memo <code>{c.memo}</code>. HIVE works too and
                    is valued at the on-chain price.
                  </p>
                  <button type="button" className="mkt-secondary" onClick={() => onCheckPayment(c.id)}>
                    I have sent it
                  </button>
                </div>
              )}

              {!c.creative && (() => {
                const usable = readyFor(c);
                const wantsImage = (c.creativeKind || 'video') === 'image';
                if (!usable.length) {
                  // Approved creatives exist, just none of the right kind. Say which
                  // kind is missing rather than showing an empty picker.
                  return ready.length > 0 ? (
                    <div className="mkt-pay">
                      <p className="mkt-hint">
                        {wantsImage
                          ? `This is a ${c.formatLabel || 'banner'} flight, so it needs an approved banner image${c.creativeSpec ? ` (${c.creativeSpec.recommended}, between ${c.creativeSpec.minAspect}:1 and ${c.creativeSpec.maxAspect}:1)` : ''}.`
                          : 'This flight needs an approved ad video.'}
                      </p>
                    </div>
                  ) : null;
                }
                return (
                <div className="mkt-pay">
                  <label className="mkt-hint" htmlFor={`attach-${c.id}`}>
                    {wantsImage ? 'Use one of your approved banners' : 'Use one of your approved ad videos'}
                  </label>
                  <div className="mkt-attach-row">
                    <select
                      id={`attach-${c.id}`}
                      value={picked[c.id] || ''}
                      onChange={(e) => setPicked((p) => ({ ...p, [c.id]: e.target.value }))}
                    >
                      <option value="" disabled>Choose one</option>
                      {usable.map((cr) => (
                        <option key={cr.embedId} value={cr.permlink || cr.embedId}>
                          {/* A still has no duration — "0s ad" was what it used to say. */}
                          {cr.kind === 'image'
                            ? `Banner${cr.imageWidth ? ` · ${cr.imageWidth}×${cr.imageHeight}` : ''}`
                            : `${cr.durationSeconds}s ad`}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="mkt-outline"
                      disabled={!picked[c.id] || saving === c.id}
                      onClick={() => onAttach(c.id)}
                    >
                      {saving === c.id ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                </div>
                );
              })()}

              {(c.delivered > 0 || c.status === 'complete') && (
                <div className="mkt-delivery">
                  <span><strong>{formatCount(c.delivered)}</strong> play{c.delivered === 1 ? '' : 's'} delivered
                    {c.forecast ? ` of ${formatCount(c.forecast)} forecast` : ''}</span>
                  {c.refundHbd > 0 && (
                    <span className="mkt-refund">
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
 * Upload the spot.
 *
 * Available from the moment an application exists, not only once it is approved.
 * The reviewer's first question is what would actually run, and the video answers
 * it better than a paragraph describing the video — so an applicant can attach it
 * straight after applying and hear one answer instead of two. The backend caps how
 * many files a pending applicant may attach, so this is not open file hosting.
 *
 * The upload goes through the ordinary pipeline but is never published to Hive —
 * it has no post, earns nothing, and appears in no feed. It exists so the spot can
 * be watched and approved before it ever runs in front of anyone. A spot cannot
 * reach a viewer while the application is pending: serving needs a booked, paid
 * flight, and a flight needs an approved advertiser.
 */
/**
 * The logo and slogan drawn in the disclosure overlay while the ad plays.
 *
 * Sits with the ad videos because it is part of what the viewer sees, and it lives
 * on the product rather than on each clip: it says who the ad is from, which does
 * not change between one video and the next.
 */
function BrandPanel({ reference, account, productName, initialLogoUrl, initialSlogan }) {
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl || null);
  const [slogan, setSlogan] = useState(initialSlogan || '');
  const [savedSlogan, setSavedSlogan] = useState(initialSlogan || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const logoInput = useRef(null);

  async function onLogo(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setBusy(true); setError(null);
    try {
      const res = await uploadLogo({ file, reference });
      setLogoUrl(res.logoUrl);
      toast.success('Logo saved');
    } catch (err) {
      setError(err.message || 'Could not save that logo');
    } finally {
      setBusy(false);
      if (logoInput.current) logoInput.current.value = '';   // let the same file be retried
    }
  }

  async function onSaveSlogan() {
    setBusy(true); setError(null);
    try {
      const res = await saveBranding({ reference, slogan: slogan.trim() });
      setSavedSlogan(res.slogan || '');
      toast.success('Slogan saved');
    } catch (err) {
      setError(err.message || 'Could not save that slogan');
    } finally { setBusy(false); }
  }

  const over = slogan.trim().length > SLOGAN_MAX;
  const dirty = slogan.trim() !== savedSlogan;

  return (
    <div className="mkt-brand">
      <h3>How your ad is labelled</h3>
      <p className="mkt-fine">
        While your ad plays we show who it is from, over the video. This is what it says.
      </p>

      <div className="mkt-brand-row">
        <div className="mkt-brand-fields">
          <div className="mkt-field">
            <span className="mkt-label">Logo</span>
            <input
              ref={logoInput}
              id={`mkt-logo-${reference}`}
              type="file"
              accept="image/*"
              onChange={onLogo}
              disabled={busy}
              className="mkt-visually-hidden"
            />
            <label htmlFor={`mkt-logo-${reference}`} className={`mkt-secondary mkt-upload-btn${busy ? ' disabled' : ''}`}>
              {logoUrl ? 'Replace logo' : 'Upload a logo'}
            </label>
            <span className="mkt-hint">Shown as a circle, so a square image works best.</span>
          </div>

          <div className="mkt-field mkt-field-wide">
            <label htmlFor={`mkt-slogan-${reference}`}>Slogan</label>
            <input
              id={`mkt-slogan-${reference}`}
              value={slogan}
              maxLength={SLOGAN_MAX}
              onChange={(e) => setSlogan(e.target.value)}
              placeholder="One line about what you do"
            />
            <span className={`mkt-hint${over ? ' mkt-hint-short' : ''}`}>
              {slogan.trim().length}/{SLOGAN_MAX} characters. Two lines at most in the overlay.
            </span>
          </div>

          <div className="mkt-field">
            <span className="mkt-label mkt-visually-hidden">Save</span>
            <button
              type="button"
              className="mkt-secondary"
              onClick={onSaveSlogan}
              disabled={busy || over || !dirty}
            >
              {busy ? 'Saving…' : (dirty ? 'Save slogan' : 'Saved')}
            </button>
          </div>
        </div>

        {/* The overlay on its own. The ad video underneath is a separate thing and
            putting it here answered a question nobody was asking: what matters is
            how the label itself reads, at the size it is drawn. */}
        <div className="mkt-brand-preview">
          <span className="mkt-preview-cap">Top left of your ad</span>
          <AdOverlay
            account={account}
            brand={{ productName, slogan: slogan.trim(), logoUrl }}
            previewOnly
          />
        </div>
      </div>

      {error ? <p className="mkt-upload-error">{error}</p> : null}
    </div>
  );
}

function CreativePanel({ reference, account, maxSeconds, bannerSpec, onCreatives, pending, production, offer, brand }) {
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
        // A still used to be an asset and nothing more — the only product was a spot
        // spliced into HLS, which a still cannot be. It is now the whole of the
        // player-banner format, so saying it "cannot run on its own" is simply
        // false. Whether THIS still is banner-shaped is decided when it is attached
        // to a flight, by the one rule that governs it.
        await uploadImageAsset({ file, reference });
        toast.success('Image saved. Use it as a player banner, or we can build an ad video around it');
      } else {
        // Checked here as well as on the server so a too-long spot fails in a second
        // rather than after an upload.
        const durationSeconds = await readVideoDuration(file);
        if (durationSeconds && maxSeconds && durationSeconds > maxSeconds) {
          throw new Error(`That video is ${durationSeconds} seconds. The most an ad can run is ${maxSeconds}.`);
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
    <div className="mkt-creatives">
      {brand && (
        <BrandPanel
          key={reference}
          reference={reference}
          account={account}
          productName={brand.productName}
          initialLogoUrl={brand.logoUrl}
          initialSlogan={brand.slogan}
        />
      )}

      <h3>Your ad creatives</h3>
      <p className="mkt-fine">
        Upload the video you want to run. It is never posted to Hive and never appears
        in any feed &mdash; it goes through the same encoder as everything else so it
        plays cleanly inside a break, and then waits for us to watch it.
        {maxSeconds ? ` Up to ${maxSeconds} seconds.` : null}
      </p>
      <p className="mkt-fine">
        {/* Images used to be assets and nothing else. They are now the whole of the
            player-banner format, so this says what one is FOR rather than what it
            cannot do. The exact shape rules come from the server's rate card, so
            there is no second copy of them to fall out of step. */}
        Images too. A still is what a <strong>player banner</strong> is made of &mdash;
        {bannerSpec
          ? ` ${bannerSpec.recommended} works well, and it needs to be a strip between `
            + `${bannerSpec.minAspect}:1 and ${bannerSpec.maxAspect}:1.`
          : ' it needs to be a wide strip.'}
        {' '}A logo or key art that is not that shape is still worth uploading: we can
        build an ad video around it.
      </p>
      {pending && !production && (
        <p className="mkt-fine">
          You can do this now, while your product is being reviewed. It is the quickest way
          to show us what you have in mind, and nothing here runs until both your product and
          the ad video are approved and a booking is paid for. If you would rather we made
          the video, say so on the form and skip this.
        </p>
      )}
      {production && (
        // They already asked us to make it, so "upload the video you want to run" is
        // the wrong instruction to leave standing. What we want from them is raw
        // material, and only if they have any.
        <p className="mkt-fine">
          You have asked us to make the ad video, so there is nothing you need to upload here.
          If you have a logo, key art or footage you want us to work from, this is where to
          put it.
        </p>
      )}

      <div className="mkt-upload-row">
        <input
          ref={inputRef}
          id="mkt-creative-file"
          type="file"
          accept="video/*,image/*"
          onChange={onFile}
          disabled={busy}
          className="mkt-visually-hidden"
        />
        <label htmlFor="mkt-creative-file" className={`mkt-outline mkt-upload-btn${busy ? ' disabled' : ''}`}>
          {busy ? 'Uploading…' : 'Upload a video or image'}
        </label>
      </div>
      {error ? <p className="mkt-upload-error">{error}</p> : null}

      {/* "Or have us make it" belongs here, next to the upload button: the question
          is about the video, and the person who has just failed to find a file to
          upload is exactly the person who needs the offer. The FEE is still charged
          on the flight, which is why the state lives with the booking panel. */}
      {offer && (
        <div className="mkt-production">
          <label className="mkt-check">
            <input
              type="checkbox"
              checked={!!offer.wanted}
              onChange={(e) => offer.onChange({ wanted: e.target.checked, brief: offer.brief })}
            />
            <span>
              <strong>No ad video? Have us make it for you.</strong>
              {offer.feeHbd
                ? <> A one-off <strong>{offer.feeHbd} HBD</strong>, added to your booking.</>
                : null}
            </span>
          </label>
          {offer.wanted && (
            <div className="mkt-field mkt-field-wide">
              <label htmlFor="mkt-spot-brief">What should the ad say?</label>
              <textarea
                id="mkt-spot-brief"
                rows={4}
                value={offer.brief}
                onChange={(e) => offer.onChange({ wanted: true, brief: e.target.value })}
                placeholder="What you are advertising, who it is for, the one thing a viewer should remember, and anything you want us to avoid. Upload a logo or stills above and we will use them."
              />
              <span className={`mkt-hint${offer.brief.trim().length < 20 ? ' mkt-hint-short' : ''}`}>
                {offer.brief.trim().length < 20
                  ? `${20 - offer.brief.trim().length} more characters, we cannot make an ad from a blank brief`
                  : 'Enough to work from, thanks'}
              </span>
            </div>
          )}
        </div>
      )}

      {creatives.length > 0 && (
        <ul className="mkt-creative-list">
          {creatives.map((c) => (
            <li key={c.embedId}>
              <span className={`mkt-creative-status mkt-creative-${c.status}`}>
                {CREATIVE_STATUS[c.status] || c.status}
              </span>
              <span className="mkt-creative-meta">
                {/* Its size, not a verdict. Whether a given still is banner-shaped
                    is the attach route's call — creativeSpecError() on the server is
                    the single definition, and restating it here would be a second
                    copy of the rule to drift out of step. */}
                {c.kind === 'image'
                  ? `Image${c.imageWidth ? ` · ${c.imageWidth}×${c.imageHeight}` : ''}`
                  : (c.durationSeconds ? `${c.durationSeconds}s` : 'duration unknown')}
                {c.note ? ` · ${c.note}` : ''}
              </span>
              {c.kind === 'image' ? (
                <a href={c.imageUrl} target="_blank" rel="noopener noreferrer">View it</a>
              ) : c.previewUrl && c.encoded ? (
                <a href={c.previewUrl} target="_blank" rel="noopener noreferrer">Watch it back</a>
              ) : <span className="mkt-creative-meta">still encoding</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function Advertise() {
  const user = useAppStore((s) => s.user);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [lookupRef, setLookupRef] = useState('');
  const [lookup, setLookup] = useState(null);
  const [lookingUp, setLookingUp] = useState(false);
  // The logged-in account's own applications, so a returning advertiser does not
  // have to keep a reference code around to find their own work. `forceSigned` is
  // the "ask the checker properly" switch, which costs a signature.
  const [forceSigned, setForceSigned] = useState(false);
  // Bumped whenever a reference is added to this device: applying, or looking one
  // up. localStorage is not reactive and `user` does not change when it is written,
  // so without this the list would keep showing the pre-apply set until a reload.
  const [refsVersion, setRefsVersion] = useState(0);
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
  // Keyed on the open application, because a negotiated rate is per advertiser: the
  // page shows the public rate card until you open yours, and your own rate after.
  // Quoting the default and then charging the negotiated one would be the worst of
  // both, so the key has to include the reference.
  const { data: pricing } = useQuery({
    queryKey: ['advertise-pricing', lookupRef.trim() || null],
    queryFn: () => fetchPricing(lookupRef.trim() || undefined),
    staleTime: INVENTORY_STALE_MS,
    retry: false,
  });

  // Offer the markets we can actually deliver rather than a full country list —
  // picking a market with no audience here helps nobody. Empty while SHOW_MARKETS
  // is off, which is what hides the chips: one flag, not a second copy of the rule.
  const marketOptions = useMemo(
    () => (SHOW_MARKETS
      ? (inventory?.audience?.countries || []).filter((c) => c.code !== 'unknown').slice(0, 12)
      : []),
    [inventory],
  );

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  /**
   * This account's applications.
   *
   * Two ways in. The cached path replays references we have already proved ownership
   * of: a reference IS the credential the rest of this page uses, so once one is on
   * the device it costs nothing and asks for no signature. The signed path goes to
   * the checker with proof and returns the lot, which is what a new browser needs.
   *
   * On react-query rather than a fetch-on-mount effect, like the inventory and rate
   * card above it, so the account key handles invalidation on a login change for us.
   */
  // Read once per account rather than on every render — localStorage in a render
  // body would make the query's `enabled` flip about as React re-renders.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- refsVersion IS the signal
  const hasCachedRefs = useMemo(() => rememberedReferences(user).length > 0, [user, refsVersion]);

  const listMine = useCallback(async () => {
    const cached = rememberedReferences(user);
    if (cached.length && !forceSigned) {
      const rows = await Promise.all(cached.map((ref) => fetchApplication(ref)
        .then((r) => ({ ...r, reference: ref }))
        .catch(() => null)));   // a stale reference is not an error worth showing
      return rows.filter(Boolean);
    }
    return fetchMyApplications(user);
  }, [user, forceSigned]);

  // Runs on arrival when it can do so silently: cached references always, and the
  // signed route for logins the server can verify on its own (Butter Auth,
  // HiveSigner). A wallet login would mean a signing popup the moment the page
  // loads, which is not something to spring on someone who came to read it, so
  // `forceSigned` waits for them to press the button.
  const {
    data: mine,
    isFetching: mineBusy,
    error: mineError,
  } = useQuery({
    queryKey: ['advertise-mine', user, forceSigned, refsVersion],
    queryFn: listMine,
    enabled: !!user && (forceSigned || hasCachedRefs || identityIsSilent()),
    staleTime: 60 * 1000,
    retry: false,
  });

  const myApps = user ? mine : null;
  const approvedApps = (myApps || []).filter((a) => a.status === 'approved');
  // "Have us make the video": chosen in the spot panel, charged on the flight, so
  // it cannot live inside either one.
  const [bookProduction, setBookProduction] = useState({ wanted: false, brief: '' });

  // The page was one long scroll that mixed three unrelated jobs: reading what is
  // for sale, filling in a form, and managing work already in flight. Tabs so each
  // one is a place you can be, rather than a stretch of page you have to find.
  const [tab, setTab] = useState('general');
  const TABS = [
    { id: 'general', label: 'General' },
    { id: 'apply', label: 'New product' },
    { id: 'mine', label: 'My products' },
  ];

  const toggleMarket = (code) => setForm((f) => ({
    ...f,
    markets: f.markets.includes(code) ? f.markets.filter((m) => m !== code) : [...f.markets, code],
  }));

  const conceptLeft = 20 - form.creativeConcept.trim().length;
  // Only bites when they actually asked us to make the video — an untouched brief
  // must not block the button for everyone else. Matches the backend's minimum.
  const briefLeft = form.wantProduction ? 20 - form.productionBrief.trim().length : 0;

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
    // Hoisted out of the try so the receipt can carry it on the duplicate path too:
    // the upload below needs an owner, and by then the form has been cleared.
    const hiveAccount = String(user || '').trim().toLowerCase().replace(/^@/, '');
    try {
      const payload = {
        hiveAccount,
        projectName: form.projectName.trim(),
        website: form.website.trim() || undefined,
        contact: form.contact.trim(),
        category: form.category,
        creativeConcept: form.creativeConcept.trim(),
        markets: form.markets,
      };
      const budget = parseFloat(form.budgetHbd);
      if (Number.isFinite(budget) && budget > 0) payload.budgetHbd = budget;
      if (form.wantProduction) {
        payload.production = { requested: true, brief: form.productionBrief.trim() };
      }

      const res = await submitApplication(payload);
      // On this device from now on, so the next visit finds it without a signature.
      rememberReference(hiveAccount, res.reference);
      setRefsVersion((v) => v + 1);   // so it shows up under "Your applications" now
      setReceipt({ ...res, hiveAccount, production: form.wantProduction });
      setForm(EMPTY_FORM);
      toast.success('Product registered. We will review it');
    } catch (err) {
      // The backend returns the reference on a duplicate, which is exactly what
      // someone re-submitting has lost — surface it instead of a bare error.
      if (err.status === 409 && err.body?.reference) {
        rememberReference(hiveAccount, err.body.reference);
        setRefsVersion((v) => v + 1);
        setReceipt({ reference: err.body.reference, status: err.body.status, message: err.message, hiveAccount });
        toast.info(err.message);
      } else {
        toast.error(err.message || 'Could not register that product');
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
      const found = await fetchApplication(ref);
      setLookup(found);
      // Typed once, remembered after — the same bargain as applying.
      if (found?.hiveAccount) {
        rememberReference(found.hiveAccount, ref);
        setRefsVersion((v) => v + 1);
      }
    } catch (err) {
      toast.error(err.status === 404 ? 'No product with that reference' : (err.message || 'Lookup failed'));
    } finally {
      setLookingUp(false);
    }
  }

  return (
    <div className="mkt-page">
      <SEOHead
        title="Advertise on 3Speak videos"
        description="Put a short ad inside videos on 3Speak, paid in HBD or HIVE. Every advertiser is reviewed by hand."
        url="https://3speak.tv/advertise"
      />
      <header className="mkt-header">
        <MdCampaign className="mkt-header-icon" aria-hidden="true" />
        <div>
          <h1>Advertise on 3Speak videos</h1>
          <p className="mkt-lede">
            Your ad plays <strong>inside</strong> the video rather than in a box beside it, so
            it reaches people whether or not they run an ad blocker.
          </p>
        </div>
      </header>

      <div className="mkt-tabs" role="tablist" aria-label="Advertising">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`mkt-tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`mkt-panel-${t.id}`}
            className={`mkt-tab${tab === t.id ? ' selected' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            {t.id === 'mine' && myApps?.length ? (
              <span className="mkt-tab-count">{myApps.length}</span>
            ) : null}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id="mkt-panel-general"
        aria-labelledby="mkt-tab-general"
        hidden={tab !== 'general'}
      >
      {/* Three cards for the three things this page deals in, in the order you meet
          them. It replaced a four-step "how it works" list because the steps did not
          say what the nouns WERE, and the page is full of them: people could not tell
          whether they were filling in a product, a video or a booking. Numbered
          because the order is real: no booking without a product. */}
      <section className="mkt-intro">
        <h2>How it works</h2>
        <p className="mkt-intro-lede">
          Three things, and each one holds the next.
        </p>
        <ol className="mkt-steps">
          <li>
            <strong>Your product</strong>
            <span>
              Whatever you want to advertise. Tell us about it once and a person reads it.
              Advertising something different later means a new product, reviewed on its
              own.
            </span>
          </li>
          <li>
            <strong>Your ad videos</strong>
            <span>
              The clip that plays inside someone&apos;s video, up to 15 seconds. Upload as
              many as you like under one product, or ask us to make one. We watch each one
              before it can run.
            </span>
          </li>
          <li>
            <strong>Your bookings</strong>
            <span>
              When your ad runs, where in the video it falls, and what it costs. Book as
              many as you like under one product. Each booking uses one of your ad videos
              and starts once your payment lands.
            </span>
          </li>
        </ol>
        <p className="mkt-fine">
          Bookings are priced per second of ad, per day, never by the thousand impressions.
          Nothing runs in front of anyone until both your product and the ad video have been
          approved.
        </p>
      </section>

      <section className="mkt-section">
        <h2>What you would be buying</h2>
        <InventoryPanel data={inventory} isLoading={isLoading} error={error} />
      </section>

      <section className="mkt-section">
        <h2>How it is priced</h2>
        {pricing?.pricePerSecondDayHbd ? (
          // Straight from /advertise/pricing rather than typed into the copy: this is
          // the number the booking will actually charge, and a hardcoded price is a
          // promise the server has no idea it made.
          <p className="mkt-headline-price">
            <strong>{pricing.pricePerSecondDayHbd} HBD</strong> per second of spot, per day
            {pricing.minDays && pricing.maxCreativeSeconds ? (
              <span className="mkt-hint">
                {' '}· a {pricing.maxCreativeSeconds}s spot for the {pricing.minDays}-day minimum
                is {Math.round(pricing.pricePerSecondDayHbd * pricing.minDays * pricing.maxCreativeSeconds * 1000) / 1000} HBD,
                and a shorter spot costs proportionally less
              </span>
            ) : null}
          </p>
        ) : null}
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

      <section className="mkt-section mkt-creators">
        <h2>If you are a creator</h2>
        <p>
          Spots run across the network by default, and a share of what they earn goes to the
          creator whose video carried them and to the community it was posted in. You can turn
          ads off for your own videos at any time &mdash; a video with ads switched off is
          removed from the availability figures above as well, so nothing is sold that we have
          promised not to use.
        </p>
      </section>
      </div>

      <div
        role="tabpanel"
        id="mkt-panel-apply"
        aria-labelledby="mkt-tab-apply"
        hidden={tab !== 'apply'}
      >
      <section className="mkt-section">
        <h2>Tell us about your product</h2>

        {/* An approved advertiser can apply again, but only a NEW product needs it.
            Without saying so the obvious reading of a visible form is "apply again to
            run more", which would put them back in a review queue for something they
            are already cleared for. */}
        {approvedApps.length > 0 && !receipt && (
          <p className="mkt-note">
            <MdInfoOutline aria-hidden="true" />
            <span>
              You are already approved for{' '}
              <strong>{approvedApps.map((a) => a.projectName).join(', ')}</strong>. To run more
              of that, make another booking from{' '}
              <button type="button" className="mkt-linkish" onClick={() => {
                setLookupRef(approvedApps[0].reference);
                setLookup(approvedApps[0]);
                setTab('mine');
              }}>My products</button>{' '}
              rather than registering it again. Use this form for a{' '}
              <strong>different product</strong>, which we review separately.
            </span>
          </p>
        )}

        {receipt ? (
          <div className="mkt-receipt">
            <StatusBadge status={receipt.status || 'pending'} />
            <p>{receipt.message || 'Your product is with us.'}</p>
            <p className="mkt-reference">
              Your reference: <code>{receipt.reference}</code>
            </p>
            <p className="mkt-fine">
              Keep it. It is the only way to open this product from another browser, and we
              never ask for an account name to look one up.
            </p>

            {/* The upload, here rather than behind approval. Someone who has just
                applied is exactly the person with the file open and the page in
                front of them; making them wait for a decision and come back is how
                a spot ends up described in words instead of attached. */}
            <CreativePanel
              reference={receipt.reference}
              account={receipt.hiveAccount}
              maxSeconds={pricing?.maxCreativeSeconds}
              bannerSpec={pricing?.formats?.find((f) => f.key === 'video_banner')?.creativeSpec}
              pending={receipt.status !== 'approved'}
              production={!!receipt.production}
            />

            <button type="button" className="mkt-secondary" onClick={() => setReceipt(null)}>
              Register another product
            </button>
          </div>
        ) : !user ? (
          <div className="mkt-panel mkt-panel-muted">
            <p style={{ margin: 0 }}>
              Log in with the Hive account you want to advertise from. The product is tied to
              that account, and it is the wallet the booking is paid from.
            </p>
          </div>
        ) : (
          <form className="mkt-form" onSubmit={onSubmit}>
            {/* Not an input any more. The account is whoever is logged in: typing it
                invited a typo in the one field that decides who owns the application
                and which wallet the booking is paid from. Stated plainly instead, so
                nobody has to guess which account they are applying as. */}
            <div className="mkt-field mkt-field-wide mkt-asaccount">
              <span className="mkt-label">Applying as</span>
              <strong>@{user}</strong>
              <span className="mkt-hint">
                The account the booking will be paid from. Log in as a different account to
                apply as that one.
              </span>
            </div>

            <div className="mkt-field">
              <label htmlFor="mkt-project">Product name</label>
              <input id="mkt-project" value={form.projectName} onChange={set('projectName')} required />
            </div>

            <div className="mkt-field">
              <label htmlFor="mkt-website">Website <span className="mkt-optional">optional</span></label>
              <input id="mkt-website" type="url" value={form.website} onChange={set('website')} placeholder="https://" />
              <span className="mkt-hint">Where viewers land when they click your ad.</span>
            </div>

            <div className="mkt-field">
              <label htmlFor="mkt-contact">How we reach you</label>
              <input
                id="mkt-contact"
                value={form.contact}
                onChange={set('contact')}
                placeholder="Discord, Telegram, email — whatever you actually read"
                required
              />
            </div>

            <div className="mkt-field">
              <label htmlFor="mkt-category">Category</label>
              <select id="mkt-category" value={form.category} onChange={set('category')} required>
                <option value="" disabled>Choose one</option>
                {AD_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>

            <div className="mkt-field">
              <label htmlFor="mkt-budget">Budget in HBD <span className="mkt-optional">optional</span></label>
              <input
                id="mkt-budget"
                type="number"
                min="0"
                step="1"
                inputMode="decimal"
                value={form.budgetHbd}
                onChange={set('budgetHbd')}
                placeholder="250"
              />
              <span className="mkt-hint">A rough figure is enough.</span>
            </div>

            {marketOptions.length > 0 && (
              <div className="mkt-field mkt-field-wide">
                <span className="mkt-label">Markets <span className="mkt-optional">optional</span></span>
                <div className="mkt-chips">
                  {marketOptions.map((c) => (
                    <button
                      key={c.code}
                      type="button"
                      className={`mkt-chip${form.markets.includes(c.code) ? ' selected' : ''}`}
                      aria-pressed={form.markets.includes(c.code)}
                      onClick={() => toggleMarket(c.code)}
                    >
                      {countryName(c.code)} <span className="mkt-chip-share">{c.sharePct}%</span>
                    </button>
                  ))}
                </div>
                <span className="mkt-hint">Leave all unselected to run everywhere.</span>
              </div>
            )}

            <div className="mkt-field mkt-field-wide">
              <label htmlFor="mkt-concept">What do you want to run?</label>
              <textarea
                id="mkt-concept"
                rows={5}
                value={form.creativeConcept}
                onChange={set('creativeConcept')}
                placeholder="The spot itself, who it is aimed at, and roughly when you would want it live."
                required
              />
              <span className={`mkt-hint${conceptLeft > 0 ? ' mkt-hint-short' : ''}`}>
                {conceptLeft > 0 ? `${conceptLeft} more characters` : 'Enough to go on, thanks'}
              </span>
            </div>

            <div className="mkt-production">
              <label className="mkt-check">
                <input
                  type="checkbox"
                  checked={form.wantProduction}
                  onChange={(e) => setForm((f) => ({ ...f, wantProduction: e.target.checked }))}
                />
                <span>
                  <strong>Have us make the video for you.</strong> Tick this if you do not
                  have a spot yet
                  {pricing?.productionFeeHbd
                    ? <>. A one-off <strong>{pricing.productionFeeHbd} HBD</strong>, quoted with
                      your booking and charged only when you book, so applying costs nothing.</>
                    : '.'}
                </span>
              </label>
              {form.wantProduction && (
                <div className="mkt-field mkt-field-wide">
                  <label htmlFor="mkt-apply-brief">What should the spot say?</label>
                  <textarea
                    id="mkt-apply-brief"
                    rows={4}
                    value={form.productionBrief}
                    onChange={set('productionBrief')}
                    placeholder="What you are advertising, who it is for, the one thing a viewer should remember, and anything you want us to avoid. You can send us a logo and stills once you have your reference."
                    required
                  />
                  <span className={`mkt-hint${briefLeft > 0 ? ' mkt-hint-short' : ''}`}>
                    {briefLeft > 0
                      ? `${briefLeft} more characters, we cannot make a spot from a blank brief`
                      : 'Enough to work from, thanks'}
                  </span>
                </div>
              )}
              {!form.wantProduction && (
                <span className="mkt-hint">
                  Already have the video? Leave this unticked. You can upload it as soon as
                  you have your reference, without waiting to be approved.
                </span>
              )}
            </div>

            <div className="mkt-actions">
              <button type="submit" className="mkt-outline" disabled={submitting || briefLeft > 0}>
                {submitting ? 'Sending…' : 'Register this product'}
              </button>
              <span className="mkt-fine">Reviewed by a person. We do not accept every product.</span>
            </div>
          </form>
        )}
      </section>
      </div>

      <div
        role="tabpanel"
        id="mkt-panel-mine"
        aria-labelledby="mkt-tab-mine"
        hidden={tab !== 'mine'}
      >
        {/* Master/detail. The list used to sit above the detail, so opening a product
            pushed everything down and you lost sight of which one you were looking at
            once you scrolled into its bookings. */}
        <div className="mkt-split">
          <aside className="mkt-split-nav">
            <h2>Your products</h2>

            {!user && (
              <div className="mkt-panel mkt-panel-muted">
                <p style={{ margin: 0 }}>
                  Log in to see the products registered to your Hive account, or open a single
                  one with its reference.
                </p>
              </div>
            )}

            {mineBusy && !myApps && <p className="mkt-fine">Looking…</p>}

            {mineError && (
              <div className="mkt-panel mkt-panel-muted">
                <p style={{ margin: 0 }}>{mineError.message || 'Could not load your products'}</p>
                <p className="mkt-fine">You can still open one with its reference.</p>
              </div>
            )}

            {myApps && myApps.length === 0 && !mineBusy && (
              <p className="mkt-fine">
                Nothing yet under @{user}. Register a product and it will show up here.
              </p>
            )}

            {myApps && myApps.length > 0 && (
              <ul className="mkt-mine-list">
                {myApps.map((a) => (
                  <li key={a.reference}>
                    {/* The whole row is the control. A separate "Open" button made the
                        row look clickable and then ignored the click everywhere else. */}
                    <button
                      type="button"
                      className={`mkt-mine-item${a.reference === lookupRef.trim() ? ' selected' : ''}`}
                      aria-current={a.reference === lookupRef.trim() ? 'true' : undefined}
                      onClick={() => { setLookupRef(a.reference); setLookup(a); }}
                    >
                      <span className="mkt-mine-body">
                        <strong>{a.projectName}</strong>
                        <span className="mkt-mine-meta">
                          <code>{a.reference}</code>
                          {a.production?.requested ? ' · we are making it' : null}
                        </span>
                      </span>
                      <StatusBadge status={a.status} />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {/* A wallet login has a key in the browser, so proving who it is means a
                signing prompt. Springing that on someone the moment the page loads is
                worse than a button, so this is the button. Butter Auth and HiveSigner
                never reach here — the server verifies those sessions on its own. */}
            {user && !myApps && !mineBusy && !mineError && (
              <>
                <p className="mkt-fine">
                  Sign once to list every product registered to your account. We remember it on
                  this device afterwards, so you will not be asked again here.
                </p>
                <button type="button" className="mkt-secondary" onClick={() => setForceSigned(true)}>
                  Show my products
                </button>
              </>
            )}

            {myApps && myApps.length > 0 && (
              <p className="mkt-fine">
                Registered one on another browser?{' '}
                <button type="button" className="mkt-linkish" onClick={() => setForceSigned(true)}>
                  Fetch the full list
                </button>
              </p>
            )}

            <form className="mkt-lookup" onSubmit={onLookup}>
              <label className="mkt-visually-hidden" htmlFor="mkt-ref">Product reference</label>
              <input
                id="mkt-ref"
                value={lookupRef}
                onChange={(e) => setLookupRef(e.target.value)}
                placeholder="Open by reference"
                autoComplete="off"
              />
              <button type="submit" className="mkt-secondary" disabled={lookingUp || !lookupRef.trim()}>
                {lookingUp ? 'Checking…' : 'Open'}
              </button>
            </form>
          </aside>

          <div className="mkt-split-main">
            {lookup ? (
              <div className="mkt-lookup-result">
                <div className="mkt-detail-head">
                  <div>
                    <h3>{lookup.projectName}</h3>
                    <span className="mkt-mine-meta">
                      @{lookup.hiveAccount} · <code>{lookupRef.trim()}</code>
                    </span>
                  </div>
                  <StatusBadge status={lookup.status} />
                </div>
                {lookup.note ? <p className="mkt-lookup-note">{lookup.note}</p> : null}

                {/* Uploading is open to a pending applicant; booking is not. Nothing can
                    run either way until the product is approved and a booking is paid for,
                    so the split is where it belongs. */}
                {(lookup.status === 'pending' || lookup.status === 'approved') && (
                  <CreativePanel
                    reference={lookupRef.trim()}
                    account={lookup.hiveAccount}
                    maxSeconds={pricing?.maxCreativeSeconds}
                    bannerSpec={pricing?.formats?.find((f) => f.key === 'video_banner')?.creativeSpec}
                    onCreatives={setCreativeList}
                    pending={lookup.status !== 'approved'}
                    production={!!lookup.production?.requested}
                    brand={{
                      productName: lookup.projectName,
                      logoUrl: lookup.logoUrl,
                      slogan: lookup.slogan,
                    }}
                    offer={lookup.status === 'approved' && !lookup.production?.requested ? {
                      ...bookProduction,
                      feeHbd: pricing?.productionFeeHbd,
                      onChange: setBookProduction,
                    } : null}
                  />
                )}
                {lookup.status === 'approved' && (
                  <CampaignPanel
                    reference={lookupRef.trim()}
                    pricing={pricing}
                    creatives={creativeList}
                    production={bookProduction}
                  />
                )}
              </div>
            ) : (
              <div className="mkt-panel mkt-panel-muted mkt-split-empty">
                <p style={{ margin: 0 }}>
                  {myApps?.length
                    ? 'Pick a product on the left to see its ad videos and bookings.'
                    : 'Open a product with its reference to see its ad videos and bookings.'}
                </p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
