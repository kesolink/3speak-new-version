import React, { useState, useEffect } from "react";
import "./Community_modal.scss";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { Users, PenLine, ChevronDown, Loader2 } from "lucide-react";
import { CHECKER_URL } from "../../utils/config";

// Debounce hook
const useDebounce = (value, delay = 300) => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debounced;
};

// 8071 -> "8.1K", 1200000 -> "1.2M"
const formatCount = (n) => {
  if (n == null) return null;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return n.toLocaleString();
};

// Rules come as one rule per line — turn each non-empty line into a markdown
// bullet (stripping any existing bullet/number marker so we don't double up).
const toBulletList = (text) =>
  String(text || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => `- ${l.replace(/^[-*•]\s*/, "").replace(/^\d+[.)]\s*/, "")}`)
    .join("\n");

// Community about/rules can contain markdown + HTML — render them with the same
// (sanitizing) Hive renderer the post body uses. Lazy-loaded to avoid pulling
// the renderer (and its node polyfills) into the main bundle.
let rendererPromise = null;
const getRenderer = async () => {
  if (!rendererPromise) {
    rendererPromise = import("@snapie/renderer").then(({ createHiveRenderer }) =>
      createHiveRenderer({
        ipfsGateway: "https://hotipfs-3speak-1.b-cdn.net",
        convertHiveUrls: true,
        internalUrlPrefix: "",
        usertagUrlFn: (account) => `/p/${account}`,
        hashtagUrlFn: (tag) => `/t/${tag}`,
      })
    );
  }
  return rendererPromise;
};

function MarkdownText({ text }) {
  const [html, setHtml] = useState("");
  useEffect(() => {
    let alive = true;
    if (!text) { setHtml(""); return; }
    getRenderer()
      .then((render) => { if (alive) { try { setHtml(render(text)); } catch { setHtml(""); } } })
      .catch(() => { if (alive) setHtml(""); });
    return () => { alive = false; };
  }, [text]);
  if (!html) return text ? <p className="community-card-text">{text}</p> : null;
  return <div className="community-card-text markdown-view" dangerouslySetInnerHTML={{ __html: html }} />;
}

function CommunityCard({ community, onSelect }) {
  const [expanded, setExpanded] = useState(false);

  // Full metadata (bio + description + rules) comes from the checker's
  // /community/:name endpoint. Fetched eagerly because the bio shown on the card
  // can't be trusted from search (the shared community collection gets its
  // `about` wiped by another service) — this endpoint is the reliable source.
  const { data: detail, isFetching } = useQuery({
    queryKey: ["community-detail", community.name],
    enabled: !!community.name,
    queryFn: async () => {
      const res = await axios.get(`${CHECKER_URL}/community/${encodeURIComponent(community.name)}`);
      return res.data?.community || null;
    },
    staleTime: 5 * 60_000,
  });

  const subs = community.subscribers ?? detail?.subscribers;
  const authors = community.num_authors ?? detail?.num_authors;
  const bio = community.about || detail?.about;

  return (
    <div className={`community-card${expanded ? " expanded" : ""}`}>
      <div className="community-card-main" onClick={() => onSelect(community)}>
        <img
          className="community-card-avatar"
          src={`https://images.hive.blog/u/${community.name}/avatar`}
          alt=""
          loading="lazy"
          onError={(e) => { e.currentTarget.style.visibility = "hidden"; }}
        />
        <div className="community-card-info">
          <span className="community-card-title">{community.title || community.name}</span>
          <span className="community-card-stats">
            {subs != null && (
              <span className="community-card-stat"><Users size={13} /> {formatCount(subs)}</span>
            )}
            {authors != null && (
              <span className="community-card-stat"><PenLine size={13} /> {formatCount(authors)}</span>
            )}
          </span>
          {bio && <span className="community-card-bio">{bio}</span>}
        </div>
        <button
          type="button"
          className="community-card-toggle"
          aria-label={expanded ? "Hide details" : "Show details"}
          aria-expanded={expanded}
          onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}
        >
          <ChevronDown size={18} className={expanded ? "rot" : ""} />
        </button>
      </div>

      {expanded && (
        <div className="community-card-detail">
          {isFetching && (
            <div className="community-card-loading"><Loader2 size={15} className="spin" /> Loading…</div>
          )}
          {detail?.description && (
            <div className="community-card-section">
              <h4>About</h4>
              <MarkdownText text={detail.description} />
            </div>
          )}
          {detail?.rules && (
            <div className="community-card-section">
              <h4>Rules</h4>
              <MarkdownText text={toBulletList(detail.rules)} />
            </div>
          )}
          {!isFetching && !detail?.description && !detail?.rules && (
            <div className="community-card-loading">No extra info for this community.</div>
          )}
          <button type="button" className="community-card-select" onClick={() => onSelect(community)}>
            Select this community
          </button>
        </div>
      )}
    </div>
  );
}

function CommunitieModal({ isOpen, data, close, setCommunity, selected }) {
  const [searchQuery, setSearchQuery] = useState("");

  const debouncedQuery = useDebounce(searchQuery, 400);

  // Search communities via checker suggest endpoint
  const {
    data: searchResults = [],
    isLoading,
    isFetching,
  } = useQuery({
    queryKey: ["checker-community-suggest", debouncedQuery],
    enabled: isOpen && debouncedQuery.trim().length >= 2,
    queryFn: async () => {
      const res = await axios.get(`${CHECKER_URL}/search/suggest`, {
        params: { q: debouncedQuery.trim() },
      });
      return (res.data?.suggestions || [])
        .filter(s => s.type === 'community')
        .map(s => ({ name: s.name, title: s.title, about: s.about || '', subscribers: s.subscribers || 0, num_authors: s.num_authors || 0 }));
    },
    staleTime: 60_000,
  });

  // Lock the page behind the modal so touch-scrolling moves the modal (the
  // mobile bottom sheet), not the page underneath it.
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [isOpen]);

  // Default (no search) shows a single card: the already-selected community if
  // there is one, otherwise the 3Speak community. The rest appear on search.
  const DEFAULT_COMMUNITY = "hive-181335";
  const searching = debouncedQuery.trim().length >= 2;

  let selectedCommunity = null;
  if (selected) {
    if (typeof selected === "string") {
      selectedCommunity =
        (data || []).find((c) => c.name === selected) ||
        { name: selected, title: selected === DEFAULT_COMMUNITY ? "3Speak" : selected };
    } else if (selected.name) {
      selectedCommunity = selected;
    }
  }

  const defaultCommunity =
    selectedCommunity ||
    (data || []).find((c) => c.name === DEFAULT_COMMUNITY) ||
    { name: DEFAULT_COMMUNITY, title: "3Speak" };
  const visibleCommunities = searching ? searchResults : [defaultCommunity];

  if (!isOpen) return null;

  const onSelect = (community) => {
    setCommunity(community);
    close();
  };

  return (
    <div className={`modal ${isOpen ? "open" : ""}`}>
      <div className="overlay" onClick={close}></div>

      <div className={`modal-content community-modal ${isOpen ? "open" : ""}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Select a Community</h2>
          <button className="close-btn" onClick={close}>×</button>
        </div>

        <div className="modal-body">

          {/* SEARCH INPUT */}
          <div className="search-container">
            <input
              type="text"
              placeholder="Search Communities"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
          </div>

          {/* LOADING */}
          {(isLoading || isFetching) && debouncedQuery.trim().length >= 2 && (
            <div className="loading-message">Searching...</div>
          )}

          {/* LIST */}
          <div className="community-list-wrap">
            {visibleCommunities.length > 0 ? (
              visibleCommunities.map((community, index) => (
                <CommunityCard
                  key={community.name || index}
                  community={community}
                  onSelect={onSelect}
                />
              ))
            ) : (
              !isLoading && searching && <p>No communities found.</p>
            )}
          </div>

          {!searching && (
            <p className="community-search-hint">Search above to find more communities.</p>
          )}

        </div>
      </div>
    </div>
  );
}

export default CommunitieModal;
