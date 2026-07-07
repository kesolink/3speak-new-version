import { useState, useEffect, useMemo, useRef, useCallback, memo } from 'react';
import {
  fetchCreatorOverview, fetchCreatorTimeseries, fetchCreatorDemographics, fetchVideoAnalytics,
  fmtDuration, fmtCount, timeAgo, countryFlag, countryName, countryLatLng,
} from '../../lib/analytics';
import BarLoader from '../Loader/BarLoader';
import VideoStats from './VideoStats';
import { WORLD_LAND_PATH } from '../../lib/worldMapPath';
import './CreatorStats.scss';

const RANGES = [{ d: 7, l: '7d' }, { d: 28, l: '28d' }, { d: 90, l: '90d' }, { d: 0, l: 'All' }];
const CONTENTS = [{ k: 'all', l: 'All' }, { k: 'videos', l: 'Videos' }, { k: 'shorts', l: 'Shorts' }];
const SORTS = [
  { key: 'watchSeconds', label: 'Watch time', fmt: fmtDuration },
  { key: 'sessions', label: 'Views', fmt: fmtCount },
  { key: 'viewers', label: 'Viewers', fmt: fmtCount },
  { key: 'avgPct', label: 'Avg %', fmt: (v) => `${v}%` },
  { key: 'votes', label: 'Votes', fmt: fmtCount },
  { key: 'comments', label: 'Comments', fmt: fmtCount },
  { key: 'payout', label: 'Payout', fmt: (v) => `$${Number(v || 0).toFixed(2)}` },
];
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
// Friendly names for the view `source` field (watchTracking.js).
const SOURCE_LABELS = { '3speak': '3Speak', player: 'Embed player' };

// ── Watch-time trend (area + hover). Single series → title names it. ──
function TrendChart({ series }) {
  const [hover, setHover] = useState(null);
  const wrapRef = useRef(null);
  const n = series?.length || 0;
  const max = Math.max(1, ...(series || []).map((p) => p.watchSeconds));
  const has = n > 1 && series.some((p) => p.watchSeconds > 0);

  const path = useMemo(() => {
    if (!has) return { area: '', line: '' };
    const y = (v) => (100 - (v / max) * 92).toFixed(2);
    const pts = series.map((p, i) => `${((i / (n - 1)) * 100).toFixed(2)},${y(p.watchSeconds)}`);
    return { area: `M0,100 L${pts.join(' L')} L100,100 Z`, line: `M${pts.join(' L')}` };
  }, [series, max, has, n]);

  const onMove = useCallback((e) => {
    const el = wrapRef.current; if (!el || !n) return;
    const cx = e.touches && e.touches[0] ? e.touches[0].clientX : e.clientX;
    const rect = el.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (cx - rect.left) / rect.width));
    setHover(Math.min(n - 1, Math.round(frac * (n - 1))));
  }, [n]);

  if (!has) return <div className="cs-chart-empty">No watch time in this range yet.</div>;
  const hp = hover != null ? series[hover] : null;

  return (
    <div className="cs-trend" ref={wrapRef}
      onMouseMove={onMove} onMouseLeave={() => setHover(null)}
      onTouchStart={onMove} onTouchMove={onMove} onTouchEnd={() => setHover(null)}
    >
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="cs-trend-svg" aria-hidden="true">
        <path className="cs-trend-area" d={path.area} />
        <path className="cs-trend-line" d={path.line} vectorEffect="non-scaling-stroke" />
      </svg>
      {hp && (
        <>
          <div className="cs-trend-cursor" style={{ left: `${(hover / (n - 1)) * 100}%` }} />
          <div className="cs-trend-tip" style={{ left: `${(hover / (n - 1)) * 100}%` }}>
            <strong>{fmtDuration(hp.watchSeconds)}</strong>
            <span>{hp.views} views · {hp.date.slice(5)}</span>
          </div>
        </>
      )}
      <div className="cs-trend-axis"><span>{series[0].date.slice(5)}</span><span>{series[n - 1].date.slice(5)}</span></div>
    </div>
  );
}

// ── Simple sorted bars (device / browser / country). ──
function MiniBars({ items, labelKey, renderLabel }) {
  if (!items?.length) return <div className="cs-chart-empty">No data yet.</div>;
  const max = Math.max(1, ...items.map((i) => i.sessions ?? i.viewers ?? 0));
  return (
    <div className="cs-demo-bars">
      {items.slice(0, 8).map((it) => {
        const v = it.sessions ?? it.viewers ?? 0;
        return (
          <div className="cs-demo-row" key={it[labelKey]}>
            <span className="cs-demo-label">{renderLabel ? renderLabel(it) : it[labelKey]}</span>
            <span className="cs-demo-track"><span className="cs-demo-fill" style={{ width: `${(v / max) * 100}%` }} /></span>
            <span className="cs-demo-val">{fmtCount(v)}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── World bubble map (country centroids sized by viewers). ──
const WorldMap = memo(function WorldMap({ byCountry }) {
  const pts = (byCountry || []).map((c) => ({ ...c, ll: countryLatLng(c.country) })).filter((c) => c.ll);
  if (!pts.length) return null;
  const max = Math.max(1, ...pts.map((c) => c.viewers));
  return (
    <div className="cs-map">
      <svg viewBox="0 0 360 180" className="cs-map-svg" role="img" aria-label="Viewer locations">
        <rect x="0" y="0" width="360" height="180" className="cs-map-bg" />
        {WORLD_LAND_PATH && <path d={WORLD_LAND_PATH} className="cs-map-land" />}
        {[30, 60, 90, 120, 150].map((y) => <line key={`h${y}`} x1="0" y1={y} x2="360" y2={y} className="cs-map-grid" />)}
        {[60, 120, 180, 240, 300].map((x) => <line key={`v${x}`} x1={x} y1="0" x2={x} y2="180" className="cs-map-grid" />)}
        {pts.map((c) => {
          const cx = c.ll[1] + 180;
          const cy = 90 - c.ll[0];
          const r = 2 + Math.sqrt(c.viewers / max) * 10;
          return (
            <circle key={c.country} cx={cx} cy={cy} r={r} className="cs-map-bubble">
              <title>{`${countryName(c.country)} — ${c.viewers} viewer${c.viewers === 1 ? '' : 's'}`}</title>
            </circle>
          );
        })}
      </svg>
    </div>
  );
});

// ── "When your viewers watch" — 7×24 day/hour heatmap. ──
function WhenHeatmap({ matrix }) {
  if (!matrix?.length) return null;
  const max = Math.max(1, ...matrix.flat());
  if (max <= 1) return null;
  return (
    <div className="cs-when">
      <div className="cs-when-grid">
        {matrix.map((row, d) => (
          <div className="cs-when-row" key={d}>
            <span className="cs-when-day">{DOW[d][0]}</span>
            {row.map((v, h) => (
              <span
                key={h}
                className="cs-when-cell"
                style={{ opacity: v ? 0.15 + (v / max) * 0.85 : 0.06 }}
                title={`${DOW[d]} ${String(h).padStart(2, '0')}:00 — ${v} view${v === 1 ? '' : 's'}`}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="cs-when-hours"><span>0h</span><span>6h</span><span>12h</span><span>18h</span><span>23h</span></div>
    </div>
  );
}

const Demographics = memo(function Demographics({ demo }) {
  // Mobile only: switch between the breakdown bars and the map.
  const [tab, setTab] = useState('map');
  if (!demo || (!demo.byCountry?.length && !demo.byDevice?.length)) {
    return <div className="cs-chart-empty">No viewer data in this range yet.</div>;
  }
  const nr = (demo.newViewers || 0) + (demo.returningViewers || 0);
  return (
    <div className="cs-demo">
      {/* Mobile tab switcher (hidden on desktop) */}
      <div className="cs-demo-tabs cs-seg">
        <button className={tab === 'bars' ? 'active' : ''} onClick={() => setTab('bars')}>Breakdown</button>
        <button className={tab === 'map' ? 'active' : ''} onClick={() => setTab('map')}>Map</button>
      </div>

      {/* Desktop: bars on the left, 50% map on the right. Mobile: one per tab. */}
      <div className={`cs-demo-main tab-${tab}`}>
        <div className="cs-demo-bars-side">
          <div className="cs-demo-col">
            <h5>Countries</h5>
            <MiniBars items={demo.byCountry} labelKey="country"
              renderLabel={(c) => <>{countryFlag(c.country)} {countryName(c.country)}</>} />
          </div>
          <div className="cs-demo-col">
            <h5>Devices</h5>
            <MiniBars items={demo.byDevice} labelKey="device" />
          </div>
          <div className="cs-demo-col">
            <h5>Browsers</h5>
            <MiniBars items={demo.byBrowser} labelKey="browser" />
          </div>
          {demo.bySource?.length > 0 && (
            <div className="cs-demo-col">
              <h5>Where they watch<em>3speak vs embed player</em></h5>
              <MiniBars items={demo.bySource} labelKey="source" renderLabel={(s) => SOURCE_LABELS[s.source] || s.source} />
            </div>
          )}
          {nr > 0 && (demo.returningViewers > 0 || demo.days > 0) && (
            <div className="cs-demo-col">
              <h5>New vs returning</h5>
              <MiniBars
                items={[
                  { label: 'New', viewers: demo.newViewers },
                  { label: 'Returning', viewers: demo.returningViewers },
                ]}
                labelKey="label"
              />
            </div>
          )}
          <div className="cs-demo-col">
            <h5>When your viewers watch<em>UTC · darker = more views</em></h5>
            <WhenHeatmap matrix={demo.whenHeatmap} />
          </div>
        </div>
        <div className="cs-demo-map-side">
          <WorldMap byCountry={demo.byCountry} />
        </div>
      </div>

      {demo.unknownViewers > 0 && (
        <p className="cs-demo-note">{demo.locatedViewers} of {demo.totalViewers} viewers located.</p>
      )}
    </div>
  );
});

function VideoDetail({ username, video, onClose }) {
  return (
    <div className="cs-detail">
      <div className="cs-detail-head">
        <img className="cs-detail-thumb" src={video.thumbnail} alt="" />
        <div className="cs-detail-title">
          <strong>{video.title || video.permlink}</strong>
          <span>{fmtCount(video.votes)} votes · {fmtCount(video.comments)} comments · ${Number(video.payout || 0).toFixed(2)}{video.created ? ` · ${timeAgo(video.created)}` : ''}</span>
        </div>
        <button className="cs-detail-close" onClick={onClose} aria-label="Close">✕</button>
      </div>
      <VideoStats username={username} permlink={video.permlink} compact />
    </div>
  );
}

// Overlaid retention curves for two videos (x = % of video, so different lengths
// compare fairly). Two series → legend is always shown.
function CompareChart({ username, a, b }) {
  const [ra, setRa] = useState(null);
  const [rb, setRb] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false; setLoading(true); setRa(null); setRb(null);
    Promise.all([
      fetchVideoAnalytics(username, a.permlink).catch(() => null),
      fetchVideoAnalytics(username, b.permlink).catch(() => null),
    ]).then(([da, db]) => { if (!cancelled) { setRa(da); setRb(db); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [username, a.permlink, b.permlink]);

  const line = (vals) => {
    if (!vals || vals.length < 2) return '';
    const n = vals.length; const y = (v) => (100 - (v / 100) * 92).toFixed(2);
    return `M${vals.map((v, i) => `${((i / (n - 1)) * 100).toFixed(2)},${y(v)}`).join(' L')}`;
  };
  if (loading) return <BarLoader />;
  const sa = ra?.retention || []; const sb = rb?.retention || [];
  if (sa.length < 2 && sb.length < 2) return <div className="cs-chart-empty">Not enough data to compare.</div>;

  return (
    <div className="cs-compare">
      <div className="cs-compare-legend">
        <span><i style={{ background: 'var(--accent-primary, #e53935)' }} />{a.title}</span>
        <span><i style={{ background: 'rgba(120,170,255,0.95)' }} />{b.title}</span>
      </div>
      <div className="cs-compare-chart">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <path d={line(sa)} className="cs-cmp-a" vectorEffect="non-scaling-stroke" />
          <path d={line(sb)} className="cs-cmp-b" vectorEffect="non-scaling-stroke" />
        </svg>
        <div className="cs-cmp-axis"><span>Start</span><span>Retention across the video</span><span>End</span></div>
      </div>
    </div>
  );
}

export default function CreatorStats({ user }) {
  const [days, setDays] = useState(28);
  const [content, setContent] = useState('all');
  const [overview, setOverview] = useState(null);
  const [demo, setDemo] = useState(null);
  const [series, setSeries] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(false);
  const [sort, setSort] = useState('watchSeconds');
  const [selected, setSelected] = useState(null);
  const [cmpA, setCmpA] = useState('');
  const [cmpB, setCmpB] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setErr(false); setSelected(null);
    const opts = { days, content };
    Promise.all([
      fetchCreatorOverview(user, opts).catch(() => null),
      fetchCreatorTimeseries(user, opts).catch(() => null),
      fetchCreatorDemographics(user, opts).catch(() => null),
    ]).then(([ov, ts, dm]) => {
      if (cancelled) return;
      if (!ov) setErr(true);
      setOverview(ov); setSeries(ts?.series || null); setDemo(dm);
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [user, days, content]);

  const filters = (
    <div className="cs-filters">
      <div className="cs-seg">
        {RANGES.map((r) => <button key={r.d} className={days === r.d ? 'active' : ''} onClick={() => setDays(r.d)}>{r.l}</button>)}
      </div>
      <div className="cs-seg">
        {CONTENTS.map((c) => <button key={c.k} className={content === c.k ? 'active' : ''} onClick={() => setContent(c.k)}>{c.l}</button>)}
      </div>
    </div>
  );

  if (loading) return <div className="creator-stats">{filters}<BarLoader /></div>;
  if (err || !overview) return <div className="creator-stats">{filters}<div className="cs-chart-empty">Couldn’t load your stats right now.</div></div>;

  const t = overview.totals || {};
  const videos = overview.videos || [];
  const sortDef = SORTS.find((s) => s.key === sort);
  const list = [...videos].sort((a, b) => (b[sort] || 0) - (a[sort] || 0)).slice(0, 8);
  const cmpAVid = videos.find((v) => v.permlink === cmpA);
  const cmpBVid = videos.find((v) => v.permlink === cmpB);
  const cmpOpts = videos.map((v) => <option key={v.permlink} value={v.permlink}>{v.title}</option>);

  return (
    <div className="creator-stats">
      {filters}

      {!t.videos ? (
        <div className="cs-empty">No watch data in this range yet — try “All”, or wait for people to watch your videos.</div>
      ) : (
        <>
          {/* Tiles */}
          <div className="cs-tiles">
            <div className="cs-tile"><span>{fmtDuration(t.watchSeconds)}</span><label>Watch time</label></div>
            <div className="cs-tile"><span>{fmtCount(t.sessions)}</span><label>Views</label></div>
            <div className="cs-tile"><span>{fmtCount(t.viewers)}</span><label>Unique viewers</label></div>
            <div className="cs-tile"><span>{fmtDuration(t.avgViewDuration)}</span><label>Avg view duration</label></div>
            <div className="cs-tile"><span>{t.avgPct}%</span><label>Avg watched</label></div>
            <div className="cs-tile"><span>{(Number(t.engagementRate || 0) / 100).toFixed(1)}</span><label>Reactions / view</label></div>
          </div>
          <p className="cs-subtotals">
            {fmtCount(t.videos)} videos · {fmtCount(t.votes)} votes · {fmtCount(t.comments)} comments · ${Number(t.payout || 0).toFixed(2)} · avg speed {t.avgRate}×
          </p>

          {/* Trend */}
          {series && (
            <section className="cs-section">
              <div className="cs-section-head"><h4>Watch time over time</h4></div>
              <TrendChart series={series} />
            </section>
          )}

          {/* Best performing + Compare (side by side on desktop) */}
          <section className="cs-section">
            <div className="cs-section-head">
              <h4>Best performing</h4>
            </div>

            <div className="cs-perf-row">
              <div className="cs-list-col">
                <div className="cs-seg cs-seg-scroll">
                  {SORTS.map((m) => (
                    <button key={m.key} className={sort === m.key ? 'active' : ''} onClick={() => setSort(m.key)}>{m.label}</button>
                  ))}
                </div>
                <div className="cs-list">
                {list.map((v, i) => (
                  <button
                    key={v.permlink}
                    className={`cs-item${selected?.permlink === v.permlink ? ' selected' : ''}`}
                    onClick={() => setSelected(selected?.permlink === v.permlink ? null : v)}
                  >
                    <span className="cs-rank">{i + 1}</span>
                    <img className="cs-item-thumb" src={v.thumbnail} alt="" loading="lazy" />
                    <span className="cs-item-info">
                      <span className="cs-item-title">{v.short ? '⏱ ' : ''}{v.title || v.permlink}</span>
                      {v.created && <span className="cs-item-date">{timeAgo(v.created)}</span>}
                    </span>
                    <span className="cs-item-metric">{sortDef.fmt(v[sort])}</span>
                  </button>
                ))}
                </div>
              </div>

              {videos.length >= 2 && (
                <div className="cs-perf-compare">
                  <h5>Compare videos</h5>
                  <div className="cs-compare-picks">
                    <select value={cmpA} onChange={(e) => setCmpA(e.target.value)}><option value="">Pick a video…</option>{cmpOpts}</select>
                    <span className="cs-compare-vs">vs</span>
                    <select value={cmpB} onChange={(e) => setCmpB(e.target.value)}><option value="">Pick another…</option>{cmpOpts}</select>
                  </div>
                </div>
              )}
            </div>

            {/* Graphs under the whole row */}
            {selected && <VideoDetail username={user} video={selected} onClose={() => setSelected(null)} />}
            {cmpAVid && cmpBVid && cmpAVid.permlink !== cmpBVid.permlink && (
              <div className="cs-compare-result">
                <CompareChart username={user} a={cmpAVid} b={cmpBVid} />
              </div>
            )}
          </section>

          {/* Demographics */}
          <section className="cs-section">
            <div className="cs-section-head"><h4>Your audience</h4></div>
            <Demographics demo={demo} />
          </section>
        </>
      )}

      <p className="cs-footnote">Watch stats are from preview tracking and visible only to you.</p>
    </div>
  );
}
