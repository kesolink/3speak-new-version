import { useEffect } from 'react';
import { preloadShorts } from '../hive-api/hiveApi';
import { useAppStore } from '../lib/store';

/**
 * Invisible component that kicks off shorts preloading as soon as the app mounts.
 * By the time the user navigates to /shorts, the first batch is usually ready.
 */
function ShortsPreloader() {
  const { user } = useAppStore();

  useEffect(() => {
    preloadShorts(10, user);
  }, []);

  return null;
}

export default ShortsPreloader;
