import { useState, useRef, useCallback, useEffect } from 'react';
import './PullToRefresh.scss';

const THRESHOLD = 70;
const MAX_PULL = 120;

const PullToRefresh = ({ onRefresh, children }) => {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(null);
  const containerRef = useRef(null);

  const handleTouchStart = useCallback((e) => {
    if (refreshing) return;
    if (window.scrollY > 5) return; // only trigger at top
    startY.current = e.touches[0].clientY;
  }, [refreshing]);

  const handleTouchMove = useCallback((e) => {
    if (startY.current == null || refreshing) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy < 0) { startY.current = null; return; }
    // Diminishing pull distance
    const distance = Math.min(dy * 0.5, MAX_PULL);
    setPullDistance(distance);
  }, [refreshing]);

  const handleTouchEnd = useCallback(async () => {
    if (startY.current == null) return;
    startY.current = null;
    if (pullDistance >= THRESHOLD && !refreshing) {
      setRefreshing(true);
      setPullDistance(THRESHOLD);
      try { await onRefresh(); } catch (_) {}
      setRefreshing(false);
    }
    setPullDistance(0);
  }, [pullDistance, refreshing, onRefresh]);

  // Only show on mobile
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.matchMedia('(max-width: 1024px)').matches);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  if (!isMobile) return children;

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div
        className={`ptr-indicator ${refreshing ? 'ptr-refreshing' : ''}`}
        style={{ height: pullDistance > 10 ? pullDistance : 0, opacity: pullDistance > 10 ? Math.min(pullDistance / THRESHOLD, 1) : 0 }}
      >
        <div className={`ptr-spinner ${pullDistance >= THRESHOLD || refreshing ? 'ptr-active' : ''}`}>
          <svg viewBox="0 0 24 24" width="24" height="24">
            <path d="M17.65 6.35A7.958 7.958 0 0 0 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" fill="currentColor" />
          </svg>
        </div>
      </div>
      {children}
    </div>
  );
};

export default PullToRefresh;
