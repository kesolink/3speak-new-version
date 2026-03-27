import { useState, useMemo, useCallback } from 'react';
import CardSkeleton from '../components/Cards/CardSkeleton';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Card3 from '../components/Cards/Card3';
import { TAG_FEED_URL } from '../utils/config';
import { useContentBatch } from '../hooks/useContentBatch';
import { useWatchHistory } from '../hooks/useWatchHistory';
import useViewCounts from '../hooks/useViewCounts';
import PullToRefresh from '../components/PullToRefresh/PullToRefresh';
import { getSinceTimestamp } from '../utils/dateFilters';
import { FeedToolbar, Pagination } from '../components/FeedToolbar/FeedToolbar';
import './TagFeed.scss';

const LIMIT = 20;

function TagFeed() {
  const { tag } = useParams();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);

  const since = useMemo(() => getSinceTimestamp(dateFilter), [dateFilter]);

  const handleTabChange = useCallback((tab) => {
    setActiveTab(tab);
    setCurrentPage(1);
  }, []);

  const handleDateFilterChange = useCallback((key) => {
    setDateFilter(key);
    setCurrentPage(1);
  }, []);

  const { data, isLoading, isFetching, isError } = useQuery({
    queryKey: ['tagFeed', tag, activeTab, since, currentPage],
    queryFn: async () => {
      let url = `${TAG_FEED_URL}/videos/tag/${tag}?page=${currentPage}&limit=${LIMIT}`;
      if (activeTab !== 'all') url += `&type=${activeTab}`;
      if (since) url += `&since=${since}`;
      const res = await axios.get(url);
      return res.data;
    },
    staleTime: 60 * 1000,
  });

  const allItems = data?.videos || [];
  const total = data?.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  const videoItems = useMemo(() => allItems.filter(v => !v.short), [allItems]);
  const shortItems = useMemo(() => allItems.filter(v => v.short), [allItems]);
  const hasBoth = videoItems.length > 0 && shortItems.length > 0;

  const { getContentForVideo } = useContentBatch(allItems);
  const { isWatched } = useWatchHistory(allItems);
  const { getViewCount } = useViewCounts(allItems);

  const handleRefresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['tagFeed', tag] });
  }, [queryClient, tag]);

  const renderVideos = (items) => (
    <Card3
      videos={items}
      error={isError ? 'Failed to load videos' : ''}
      loading={isFetching}
      getContentForVideo={getContentForVideo}
      isWatched={isWatched}
      getViewCount={getViewCount}
    />
  );

  const renderShorts = (items) => (
    <Card3
      videos={items}
      error={isError ? 'Failed to load shorts' : ''}
      loading={isFetching}
      getContentForVideo={getContentForVideo}
      isWatched={isWatched}
      getViewCount={getViewCount}
      linkPrefix="/shorts"
      shortsGrid
    />
  );

  return (
    <PullToRefresh onRefresh={handleRefresh}>
    <div className="firstupload-container">
      <FeedToolbar
        activeTab={activeTab}
        onTabChange={handleTabChange}
        dateFilter={dateFilter}
        onDateFilterChange={handleDateFilterChange}
        page={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
      />

      {isLoading ? (
        <CardSkeleton />
      ) : activeTab === 'shorts' ? (
        renderShorts(allItems)
      ) : activeTab === 'videos' ? (
        renderVideos(allItems)
      ) : (
        <>
          {videoItems.length > 0 && (
            <>
              {hasBoth && <h3 className="tag-feed-section-title">Videos</h3>}
              {renderVideos(videoItems)}
            </>
          )}
          {shortItems.length > 0 && (
            <>
              {hasBoth && <h3 className="tag-feed-section-title">Shorts</h3>}
              {renderShorts(shortItems)}
            </>
          )}
        </>
      )}

      {totalPages > 1 && (
        <div className="tag-feed-pagination-bottom">
          <Pagination page={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
        </div>
      )}
    </div>
    </PullToRefresh>
  );
}

export default TagFeed;
