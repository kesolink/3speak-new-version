import React, { useState, useEffect, useRef, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import "./Community_modal.scss";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
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

// Portal-based detail popup to escape overflow clipping
function CommunityDetailPortal({ community, anchorRef, visible }) {
  const popupRef = useRef(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useLayoutEffect(() => {
    if (!visible || !anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    setPos({
      top: rect.top + window.scrollY - 6,
      left: rect.left + window.scrollX,
    });
  }, [visible, anchorRef]);

  if (!visible || !community.about && !community.subscribers) return null;

  return createPortal(
    <div
      ref={popupRef}
      className="community-badge-detail-portal"
      style={{ top: pos.top, left: pos.left }}
    >
      {community.about && (
        <span className="community-badge-about">{community.about}</span>
      )}
      <span className="community-badge-stats">
        {community.subscribers ? `${community.subscribers.toLocaleString()} subscribers` : ''}
        {community.subscribers && community.num_authors ? ' · ' : ''}
        {community.num_authors ? `${community.num_authors.toLocaleString()} authors` : ''}
      </span>
    </div>,
    document.body
  );
}

function CommunityBadge({ community, onClick }) {
  const badgeRef = useRef(null);
  const [hovered, setHovered] = useState(false);

  return (
    <div
      ref={badgeRef}
      className="community-badge"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <img
        src={`https://images.ecency.com/u/${community.name}/avatar/small`}
        alt=""
      />
      <span className="community-badge-title">{community.title}</span>
      <CommunityDetailPortal
        community={community}
        anchorRef={badgeRef}
        visible={hovered}
      />
    </div>
  );
}

function CommunitieModal({ isOpen, data, close, setCommunity }) {
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

  // Show search results when searching, default data otherwise
  const visibleCommunities =
    debouncedQuery.trim().length >= 2
      ? searchResults
      : (data || []).slice(0, 10);

  if (!isOpen) return null;

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
                <CommunityBadge
                  key={index}
                  community={community}
                  onClick={() => {
                    setCommunity(community);
                    close();
                  }}
                />
              ))
            ) : (
              !isLoading &&
              debouncedQuery.trim().length >= 2 && <p>No communities found.</p>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

export default CommunitieModal;
