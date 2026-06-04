import React, { useEffect, useState } from "react";
import { getHiveClient } from '../../utils/hiveNode';
import { useParams } from "react-router-dom";
import { Client } from "@hiveio/dhive";
import "./CommunityPage.scss";
import axios from "axios";
import { FEED_URL, HIVE_API_NODES } from '../../utils/config'
import { useInfiniteQuery } from "@tanstack/react-query";
import Card3 from "../Cards/Card3";
import CardSkeleton from "../Cards/CardSkeleton";
import Com_PageSke_Loader from "./Com_PageSke_Loader";
import ProfileHeader from "../ProfileHeader/ProfileHeader";
import HiveMarkdown from "../HiveMarkdown/HiveMarkdown";
import { useContentBatch } from "../../hooks/useContentBatch";
import { useWatchHistory } from "../../hooks/useWatchHistory";
import useViewCounts from "../../hooks/useViewCounts";

// Hive client
const client = getHiveClient();

function CommunityPage() {
  const { communityName: id } = useParams();
  const [dataMain, setDataMain] = useState(null);
  const [trend, setTrend] = useState(false); // false = new (default), true = trending

  // Fetch community info
  const fetchCommunityData = async (id) => {
    try {
      const communityData = await client.call("bridge", "get_community", {
        name: id,
        observer: "",
      });
      setDataMain(communityData);
    } catch (error) {
      console.error("Error fetching community data:", error);
    }
  };

  useEffect(() => {
    if (id) fetchCommunityData(id);
  }, [id]);

  // ---------------------------
  // FETCH COMMUNITY VIDEOS
  // ---------------------------
  const fetchVideos = async ({ pageParam = 0 }) => {
    const LIMIT = 100; // checker caps page size at 100
    // checker's /feeds/community/:id/{trending,new} is 1-based; our infinite
    // query supplies 0-indexed pageParam.
    const page = (Number(pageParam) || 0) + 1;
    const variant = trend ? 'trending' : 'new';
    const url = `${FEED_URL}/feeds/community/${id}/${variant}?page=${page}&limit=${LIMIT}`;

    const res = await axios.get(url);
    // Checker returns {videos: [...]}; legacy /apiv2 returned {trends: [...]}
    // or a bare array. Support all three so a flip back never breaks the page.
    return res.data.videos || res.data.trends || res.data;
  };

  const {
  data,
  fetchNextPage,
  hasNextPage,
  isFetchingNextPage,
  isLoading,
  isError,
} = useInfiniteQuery({
  queryKey: ["communityFeed", id, trend],
  queryFn: fetchVideos,
  getNextPageParam: (lastPage, allPages) => {
    // 🧠 Stop fetching if we already got one batch (no real pagination)
    if (!lastPage || lastPage.length === 0) return undefined;

    // If the server returns less than 200 (LIMIT), assume it's the end
    if (lastPage.length < 200) return undefined;

    // Otherwise, stop after first page since API doesn’t support skip
    if (allPages.length >= 1) return undefined;

    return 1; // optional — but we stop anyway
  },
});


  // Infinite scroll
  useEffect(() => {
    const handleScroll = () => {
      if (
        window.innerHeight + window.scrollY >= document.body.offsetHeight - 200 &&
        !isFetchingNextPage &&
        hasNextPage
      ) {
        fetchNextPage();
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [isFetchingNextPage, hasNextPage, fetchNextPage]);

  const videos = data?.pages.flat() || [];

  // Batch fetch content data
  const { getContentForVideo } = useContentBatch(videos);

  // Batch check watch history
  const { isWatched } = useWatchHistory(videos);

  // Batch fetch view counts
  const { getViewCount } = useViewCounts(videos);

  return (
    <div className="community-page-wrap">
      <ProfileHeader
        username={id}
        name={dataMain?.title || id}
        bio={dataMain?.about}
      />

      {dataMain?.description ? (
        <HiveMarkdown body={dataMain.description} className="community-description" collapsible />
      ) : null}

      <hr />

      {/* Trend / New Switch */}
      <div className="search-tren-wrapper">
        {/* <div className="search-wrapper">
          <input type="text" placeholder="Search communities..." />
        </div> */}
        <div className="trend-btn-wrap">
          <span
            className={!trend ? "active" : ""}
            onClick={() => setTrend(false)}
          >
            New
          </span>
          <span
            className={trend ? "active" : ""}
            onClick={() => setTrend(true)}
          >
            Trending
          </span>
        </div>
      </div>

      {/* Feed Display */}
      {isLoading ? (
        <CardSkeleton />
      ) : isError ? (
        <p>Error fetching videos</p>
      ) : (
        <Card3 videos={videos} loading={isFetchingNextPage} getContentForVideo={getContentForVideo} isWatched={isWatched} getViewCount={getViewCount} />
      )}

      {isFetchingNextPage && <p style={{ textAlign: "center" }}>Loading more...</p>}
    </div>
  );
}

export default CommunityPage;
