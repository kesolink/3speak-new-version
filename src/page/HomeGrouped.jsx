import { useRef, useState, useEffect, useMemo, useCallback } from "react";
import { useQuery, useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Link } from "react-router-dom";
import "./HomeGrouped.scss";
import CardSkeleton from "../components/Cards/CardSkeleton";
import Card3 from "../components/Cards/Card3";
import { FEED_URL, TRENDING_SORTED_URL, FOLLOW_FEED_URL, DISCOVER_FEED_URL, INTERESTS_FEED_URL, NEW_CONTENT_URL, CHECKER_URL, appendNsfw } from "../utils/config";
import { useContentBatch } from "../hooks/useContentBatch";
import { useWatchHistory } from "../hooks/useWatchHistory";
import useViewCounts from "../hooks/useViewCounts";
import { useAppStore } from "../lib/store";
import { getFeedSeed, regenerateFeedSeed } from "../utils/feedSeed";
import ShortsStories from "../components/ShortsStories/ShortsStories";
import OpenPodsLiveStrip from "../components/OpenPod/OpenPodsLiveStrip";
import PullToRefresh from "../components/PullToRefresh/PullToRefresh";
import { TrendingIcon, NewContentIcon } from "../components/FeedIcons";
import { Rocket, Compass, Sparkles, GripVertical } from "lucide-react";

// Extra feed params for the logged-in user: interests (checker weights the feed
// toward them), currentuser (needed for BOTH the always-on dismissals and
// hide-watched) and the hide-watched preference itself. Empty when logged out.
const feedParams = () => {
  const st = useAppStore.getState();
  let p = '';
  const list = st.interests;
  if (Array.isArray(list) && list.length) p += `&interests=${encodeURIComponent(list.join(','))}`;
  if (st.user) {
    p += `&currentuser=${encodeURIComponent(st.user)}`;
    p += `&hidewatched=${st.hideWatched ? '1' : '0'}`;
  }
  if (st.simpleFeed) p += '&chrono=1'; // algo off → newest-first
  // Pin the shuffle to THIS page load. Without a seed the checker falls back to a
  // 5-minute time bucket, which reshuffled the feed under the user every 5 minutes
  // even if they never navigated or refreshed. One seed per page load means the
  // order is stable across navigation and only changes on a real refresh.
  p += `&seed=${getFeedSeed()}`;
  return p;
};

// Page sizes per feed — used to decide whether another page exists.
const PAGE_MAIN = 50;   // trending / follow / new
const PAGE_POOL = 30;   // discover / interests

// Fetch functions for each feed (paginated).
const fetchHome = async (page = 1) => {
  // Use the checker's trendingSorted feed for the "home" group — the older
  // /apiv2/feeds/home path on legacy is gone now that FEED_URL points at the
  // checker. trendingSorted is the broadest curated set the checker exposes.
  const res = await axios.get(`${TRENDING_SORTED_URL}?page=${page}&limit=${PAGE_MAIN}${feedParams()}`);
  return res.data.videos || res.data.trends || [];
};

const fetchFollowFeed = async (username, page = 1) => {
  const res = await axios.get(appendNsfw(`${FOLLOW_FEED_URL}/${username}?page=${page}&limit=${PAGE_MAIN}${feedParams()}`, useAppStore.getState().showNsfw));
  return res.data?.videos || [];
};

// Discovery row: driven by interests + watch-retention, blind to votes/views.
// The checker seeds its shuffle in 5-minute buckets, so paging within that window
// stays consistent without us pinning a seed.
const fetchDiscover = async (page = 1) => {
  const res = await axios.get(appendNsfw(`${DISCOVER_FEED_URL}?page=${page}&limit=${PAGE_POOL}${feedParams()}`, useAppStore.getState().showNsfw));
  return res.data?.videos || [];
};

// "Interests" row: ONLY videos whose winning topic is in the user's interests,
// re-ranked by retention with older ones sprinkled in. Empty with no interests.
// Uses the DEDICATED /feeds/interests endpoint, which has its own topic-stratified
// pool. The old `/feeds/discover?interestsOnly=1` filtered the discover pool — a
// uniform sample of the catalogue — so niche topics ran out after a page or two
// (science surfaced 29 of its 785 videos). Now every topic has ~25+ pages.
const fetchInterestsFeed = async (page = 1) => {
  const res = await axios.get(appendNsfw(`${INTERESTS_FEED_URL}?page=${page}&limit=${PAGE_POOL}${feedParams()}`, useAppStore.getState().showNsfw));
  return res.data?.videos || [];
};

const fetchTrending = async (page = 1) => {
  const res = await axios.get(appendNsfw(`${TRENDING_SORTED_URL}?page=${page}&limit=${PAGE_MAIN}${feedParams()}`, useAppStore.getState().showNsfw));
  return res.data?.videos || [];
};

const fetchPromoted = async () => {
  const res = await axios.get(appendNsfw(`${CHECKER_URL}/feeds/promoted?limit=20`, useAppStore.getState().showNsfw));
  return res.data?.videos || [];
};

// "New Content" stays purely chronological — no interests, no retention, and
// never hide-watched (hidewatched=0). Still passes currentuser so the checker can
// drop explicit dismissals, which apply on every feed.
const fetchNewContent = async (page = 1) => {
  const st = useAppStore.getState();
  const dismissals = st.user ? `&currentuser=${encodeURIComponent(st.user)}&hidewatched=0` : '';
  const res = await axios.get(appendNsfw(`${NEW_CONTENT_URL}?page=${page}&limit=${PAGE_MAIN}${dismissals}`, st.showNsfw));
  return res.data?.videos || [];
};

// getNextPageParam: keep paging as long as the last page returned ANYTHING. This
// is more robust than requiring an exactly-full page (server-side filtering can
// trim a page below `limit` even when more pages exist); the feed stops on the
// first empty page. One extra (empty) request at the very end is fine.
const nextPage = () => (lastPage, allPages) =>
  (lastPage?.length || 0) > 0 ? allPages.length + 1 : undefined;

// Helper to deduplicate videos by author+permlink
const deduplicateVideos = (videos) => {
  const seen = new Set();
  return videos.filter(video => {
    const author = video.author?.username || video.author || video.owner;
    const key = `${author}-${video.permlink}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

// Section icons shown in the tab bar.
const iconsByTitle = {
  "Home Feed": <TrendingIcon />,
  "Follow Feed": <TrendingIcon />,
  "New Content": <NewContentIcon />,
  "Trending": <TrendingIcon />,
  "Promoted": <Rocket size={16} />,
  "Discover": <Compass size={16} />,
  "Interests": <Sparkles size={16} />,
};

// ── Persisted custom tab order (array of section keys) in localStorage ──
const TAB_ORDER_KEY = "3speak_home_tab_order";
const loadTabOrder = () => {
  try {
    const arr = JSON.parse(localStorage.getItem(TAB_ORDER_KEY) || "null");
    return Array.isArray(arr) ? arr.filter((k) => typeof k === "string") : [];
  } catch { return []; }
};
const saveTabOrder = (order) => {
  try { localStorage.setItem(TAB_ORDER_KEY, JSON.stringify(order)); } catch { /* ignore */ }
};
// Reorder sections by the saved order; new/unknown keys keep their natural spot.
const applyTabOrder = (sections, order) => {
  if (!order || !order.length) return sections;
  const bySection = new Map(sections.map((s) => [s.key, s]));
  const out = [];
  for (const key of order) if (bySection.has(key)) { out.push(bySection.get(key)); bySection.delete(key); }
  for (const s of sections) if (bySection.has(s.key)) out.push(s);
  return out;
};

// Bottom-of-list sentinel — fires onLoadMore when it scrolls into view (600px
// early) so the next page is fetched before the user hits the actual end.
function InfiniteSentinel({ hasMore, loading, onLoadMore }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!hasMore) return undefined;
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting) && !loading) onLoadMore();
    }, { rootMargin: '600px' });
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loading, onLoadMore]);
  if (!hasMore) return null;
  return <div ref={ref} className="home-tab-sentinel">{loading && <span className="home-tab-loading">Loading more…</span>}</div>;
}

// Tracks which cards (by their data-vidkey) have scrolled near the viewport, so
// we only fetch metadata for those. Accumulates across scroll; re-observes new
// cards when the list grows (`sig`/`count` change). Returns a Set of keys.
function useVisibleKeys(rootRef, sig, count) {
  const [keys, setKeys] = useState(() => new Set());
  const seen = useRef(new Set());
  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof IntersectionObserver === "undefined") return undefined;
    const io = new IntersectionObserver((entries) => {
      let changed = false;
      for (const e of entries) {
        if (e.isIntersecting) {
          const k = e.target.dataset.vidkey;
          if (k && !seen.current.has(k)) { seen.current.add(k); changed = true; }
          io.unobserve(e.target);
        }
      }
      if (changed) setKeys(new Set(seen.current));
    }, { rootMargin: "600px 0px" });
    root.querySelectorAll("[data-vidkey]").forEach((n) => {
      if (!seen.current.has(n.dataset.vidkey)) io.observe(n);
    });
    return () => io.disconnect();
  }, [rootRef, sig, count]);
  return keys;
}

const HomeGrouped = () => {
  const { authenticated, user, showNsfw, homeCardSize, hideWatched, interests, simpleFeed } = useAppStore();
  const queryClient = useQueryClient();
  const hasInterests = Array.isArray(interests) && interests.length > 0;
  const interestsKey = hasInterests ? interests.join(',') : '';

  // On mobile/tablet the stacked section rows become tabs (one section at a time).
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' && window.matchMedia('(max-width: 1024px)').matches,
  );
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1024px)');
    const onChange = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  const [activeTab, setActiveTab] = useState(0);

  // Persisted custom tab order + live drag state (pointer-based so it works on
  // both mouse and touch). `dragKey` = the tab being dragged, `overKey` = the tab
  // currently under the pointer (its drop position).
  const [tabOrder, setTabOrder] = useState(loadTabOrder);
  const [drag, setDrag] = useState(null); // { key, overKey } | null
  const dragRef = useRef(null);           // { key, startX, startY, mode, moved }
  const tabBarRef = useRef(null);

  // Each content feed is an INFINITE query — pages load as the user reaches the
  // end of the active tab's grid (see the sentinel in renderPanel).
  const INF = { staleTime: 5 * 60 * 1000, gcTime: 10 * 60 * 1000, initialPageParam: 1 };

  const homeQ = useInfiniteQuery({
    queryKey: authenticated ? ["follow-feed", user, showNsfw, hideWatched, simpleFeed] : ["home-grouped", showNsfw, hideWatched, user, simpleFeed],
    queryFn: authenticated ? ({ pageParam }) => fetchFollowFeed(user, pageParam) : ({ pageParam }) => fetchHome(pageParam),
    getNextPageParam: nextPage(),
    ...INF,
  });
  const homeData = useMemo(() => deduplicateVideos(homeQ.data?.pages.flat() || []), [homeQ.data]);

  const discoverQ = useInfiniteQuery({
    queryKey: ["discover-grouped", showNsfw, hideWatched, user, simpleFeed],
    queryFn: ({ pageParam }) => fetchDiscover(pageParam),
    getNextPageParam: nextPage(),
    ...INF,
  });
  const discoverData = useMemo(() => deduplicateVideos(discoverQ.data?.pages.flat() || []), [discoverQ.data]);

  const interestsQ = useInfiniteQuery({
    queryKey: ["interests-grouped", showNsfw, hideWatched, user, interestsKey, simpleFeed],
    queryFn: ({ pageParam }) => fetchInterestsFeed(pageParam),
    getNextPageParam: nextPage(),
    enabled: authenticated && hasInterests,
    ...INF,
  });
  const interestsData = useMemo(() => deduplicateVideos(interestsQ.data?.pages.flat() || []), [interestsQ.data]);

  const trendingQ = useInfiniteQuery({
    queryKey: ["trending-grouped", showNsfw, hideWatched, user, simpleFeed],
    queryFn: ({ pageParam }) => fetchTrending(pageParam),
    getNextPageParam: nextPage(),
    enabled: authenticated,
    ...INF,
  });
  const trendingData = useMemo(() => deduplicateVideos(trendingQ.data?.pages.flat() || []), [trendingQ.data]);

  const newQ = useInfiniteQuery({
    queryKey: ["newcontent-grouped", showNsfw, user],
    queryFn: ({ pageParam }) => fetchNewContent(pageParam),
    getNextPageParam: nextPage(),
    ...INF,
  });
  const newContentData = useMemo(() => deduplicateVideos(newQ.data?.pages.flat() || []), [newQ.data]);

  const homeLoading = homeQ.isLoading;
  const discoverLoading = discoverQ.isLoading;
  const interestsLoading = interestsQ.isLoading;
  const trendingLoading = trendingQ.isLoading;
  const newContentLoading = newQ.isLoading;

  // Promoted videos — prefixed onto EVERY feed below (no dedicated tab any more).
  const { data: promotedData } = useQuery({
    queryKey: ["promoted-grouped", showNsfw],
    queryFn: fetchPromoted,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  // Promoted videos LEAD EVERY FEED — they no longer get a tab of their own. Each
  // section is prefixed with them and deduped, so a promoted video that also shows
  // up organically further down that feed isn't rendered twice.
  const leadWithPromoted = useCallback(
    (videos) => (promotedData?.length
      ? deduplicateVideos([...promotedData, ...(videos || [])])
      : (videos || [])),
    [promotedData],
  );

  // ── Build the section list (natural order), then apply the user's saved order ──
  const baseSections = [
    { key: 'discover', title: 'Discover', videos: leadWithPromoted(discoverData), isLoading: discoverLoading, priority: true },
    { key: 'home', title: authenticated ? 'Follow Feed' : 'Home Feed', videos: leadWithPromoted(homeData), linkTo: authenticated ? '/follow-feed' : '/home-feed', isLoading: homeLoading, priority: true },
    { key: 'new', title: 'New Content', videos: leadWithPromoted(deduplicateVideos(newContentData || [])), linkTo: '/new', isLoading: newContentLoading },
  ];
  // Interests row (logged-in + has interests): between the follow feed and New.
  if (authenticated && hasInterests) {
    baseSections.splice(2, 0, { key: 'interests', title: 'Interests', videos: leadWithPromoted(interestsData), isLoading: interestsLoading, priority: true });
  }
  if (authenticated) {
    baseSections.push({ key: 'trending', title: 'Trending', videos: leadWithPromoted(trendingData), linkTo: '/trend', isLoading: trendingLoading });
  }
  // A saved tabOrder may still list the retired 'promoted' key — applyTabOrder skips
  // keys with no matching section, so old orders degrade cleanly.
  const naturalSections = baseSections;
  // Computed directly (NOT memoised on the key signature) — a section's `videos`
  // grow as pages load, and memoising on keys alone would freeze the feed at
  // page 1 (the sentinel then stays in view and loops). applyTabOrder is cheap.
  const tabSections = applyTabOrder(naturalSections, tabOrder);

  const safeTab = Math.min(Math.max(activeTab, 0), Math.max(tabSections.length - 1, 0));
  const activeSection = tabSections[safeTab] || null;
  const activeVideos = activeSection?.videos || [];

  // ── Metadata (payout/votes/views/watch) is fetched only for cards near the
  // viewport, not every loaded page — otherwise infinite scroll would fetch
  // metadata for hundreds of off-screen cards. `visibleVideos` = the first few
  // (above the fold, seeded so they never flash empty) + everything the
  // IntersectionObserver has seen scroll near.
  const panelRef = useRef(null);
  const visibleKeys = useVisibleKeys(panelRef, activeSection?.key, activeVideos.length);
  const keyOf = (v) => `${v.author?.username || v.author || v.owner}/${v.permlink}`;
  const visibleVideos = useMemo(
    () => activeVideos.filter((v, i) => i < 8 || visibleKeys.has(keyOf(v))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeVideos, visibleKeys],
  );

  const { getContentForVideo } = useContentBatch(visibleVideos);
  const { isWatched } = useWatchHistory(visibleVideos);
  const { getViewCount } = useViewCounts(visibleVideos);

  const handleRefresh = useCallback(async () => {
    // Pull-to-refresh is an explicit "give me something new" gesture, so it DOES
    // reshuffle — same as hitting reload. Plain navigation never does.
    regenerateFeedSeed();
    await queryClient.invalidateQueries({ queryKey: authenticated ? ["follow-feed", user] : ["home-grouped"] });
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["discover-grouped"] }),
      queryClient.invalidateQueries({ queryKey: ["interests-grouped"] }),
      queryClient.invalidateQueries({ queryKey: ["trending-grouped"] }),
      queryClient.invalidateQueries({ queryKey: ["newcontent-grouped"] }),
    ]);
  }, [queryClient, authenticated, user]);

  // ── Drag-to-reorder the tabs (pointer events → works for mouse + touch) ──
  // DESKTOP (mouse): only the grip handle drags — the tab body just selects, and
  // the grab cursor lives on the handle. TOUCH: no hover, so a drag anywhere on
  // the tab (after a few px) reorders. During the drag we PREVIEW the new order
  // live, hit-testing against the tabs' ORIGINAL midpoints (captured at drag
  // start) so the reordering DOM can't cause the pointer test to flicker.
  const rectsRef = useRef([]);
  const startDrag = (key) => {
    const bar = tabBarRef.current;
    rectsRef.current = bar
      ? [...bar.querySelectorAll('.home-tab')].map((b) => {
          const r = b.getBoundingClientRect();
          return { key: b.dataset.tabKey, mid: r.left + r.width / 2 };
        })
      : [];
    setDrag({ key, order: rectsRef.current.map((r) => r.key) });
  };

  const previewOrder = (draggedKey, clientX) => {
    const others = rectsRef.current.filter((r) => r.key !== draggedKey);
    let idx = others.length;
    for (let i = 0; i < others.length; i++) { if (clientX < others[i].mid) { idx = i; break; } }
    const order = others.map((r) => r.key);
    order.splice(idx, 0, draggedKey);
    return order;
  };

  const onTabPointerDown = (key) => (e) => {
    if (e.button != null && e.button !== 0) return;
    const onHandle = !!e.target.closest?.('.home-tab-handle');
    const isTouch = e.pointerType === 'touch';
    // handle → drag now; touch body → drag after a small move; mouse body → select only.
    const mode = onHandle ? 'immediate' : (isTouch ? 'threshold' : 'select');
    dragRef.current = { key, startX: e.clientX, startY: e.clientY, mode, moved: false };
    if (mode === 'immediate') { startDrag(key); e.preventDefault(); }
  };
  const onTabPointerMove = (e) => {
    const d = dragRef.current;
    if (!d || d.mode === 'select') return;
    if (!d.moved) {
      if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < 8) return;
      d.moved = true;
      if (d.mode === 'threshold') startDrag(d.key);
    }
    const order = previewOrder(d.key, e.clientX);
    setDrag((s) => (s ? { ...s, order } : s));
  };
  const onTabPointerUp = () => {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d) return;
    if (drag?.order && (d.moved || d.mode === 'immediate')) {
      const order = drag.order;
      setTabOrder(order);
      saveTabOrder(order);
      const activeKey = activeSection?.key;
      const ni = activeKey ? order.indexOf(activeKey) : -1;
      setDrag(null);
      if (ni >= 0) setActiveTab(ni);
      return;
    }
    setDrag(null);
    // No real drag → treat as a tab select.
    const i = tabSections.findIndex((s) => s.key === d.key);
    if (i >= 0) setActiveTab(i);
  };
  // Global listeners while a pointer is down on a tab.
  useEffect(() => {
    window.addEventListener('pointermove', onTabPointerMove);
    window.addEventListener('pointerup', onTabPointerUp);
    return () => {
      window.removeEventListener('pointermove', onTabPointerMove);
      window.removeEventListener('pointerup', onTabPointerUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag, tabSections, activeSection]);

  // Live-previewed tab order during a drag (falls back to the committed order).
  const displaySections = useMemo(() => {
    if (!drag?.order) return tabSections;
    const byKey = new Map(tabSections.map((s) => [s.key, s]));
    const out = drag.order.map((k) => byKey.get(k)).filter(Boolean);
    return out.length === tabSections.length ? out : tabSections;
  }, [tabSections, drag]);

  // Infinite query backing each paginated section (promoted isn't paginated).
  const queryByKey = { home: homeQ, discover: discoverQ, interests: interestsQ, trending: trendingQ, new: newQ };

  const renderPanel = (s) => {
    if (!s) return null;
    if (s.isLoading && (!s.videos || s.videos.length === 0)) {
      return <div className="home-tab-skeletons">{Array.from({ length: 12 }).map((_, i) => <CardSkeleton key={i} />)}</div>;
    }
    if (!s.videos || s.videos.length === 0) {
      return <div className="home-tab-empty">Nothing to show here yet.</div>;
    }
    const q = queryByKey[s.key];
    return (
      <>
        <Card3
          videos={s.videos}
          loading={false}
          getContentForVideo={getContentForVideo}
          isWatched={isWatched}
          getViewCount={getViewCount}
          priority={s.priority}
        />
        {q && (
          <InfiniteSentinel
            hasMore={!!q.hasNextPage}
            loading={q.isFetchingNextPage}
            onLoadMore={q.fetchNextPage}
          />
        )}
        {(!q || !q.hasNextPage) && s.linkTo && (
          <div className="home-tab-viewall"><Link to={s.linkTo} className="view-all">View all</Link></div>
        )}
      </>
    );
  };

  return (
    <PullToRefresh onRefresh={handleRefresh}>
    <div className="home-grouped-container home-tabbed" data-card-size={homeCardSize || 'large'}>
      <ShortsStories />
      <OpenPodsLiveStrip />

      <div className={`home-tabs home-tabs--bar${drag ? ' is-dragging' : ''}`} role="tablist" ref={tabBarRef}>
        {displaySections.map((s) => (
          <button
            key={s.key}
            type="button"
            role="tab"
            data-tab-key={s.key}
            aria-selected={s.key === activeSection?.key}
            className={`home-tab${s.key === activeSection?.key ? ' active' : ''}${drag?.key === s.key ? ' dragging' : ''}`}
            onPointerDown={onTabPointerDown(s.key)}
          >
            <span className="home-tab-handle" aria-hidden="true" title="Drag to reorder"><GripVertical size={14} /></span>
            <span className="home-tab-icon">{iconsByTitle[s.title]}</span>
            <span className="home-tab-label">{s.title}</span>
          </button>
        ))}
      </div>

      <div className="home-tab-panel" role="tabpanel" ref={panelRef}>
        {renderPanel(activeSection)}
      </div>
    </div>
    </PullToRefresh>
  );
};


export default HomeGrouped;