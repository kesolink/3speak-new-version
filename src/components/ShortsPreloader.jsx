import { useEffect } from 'react';
import { preloadShorts } from '../hive-api/hiveApi';

/**
 * Invisible component that kicks off shorts preloading as soon as the app mounts.
 * By the time the user navigates to /shorts, the first batch is usually ready.
 */
function ShortsPreloader() {
  useEffect(() => {
    preloadShorts(10);
  }, []);

  return null;
}

export default ShortsPreloader;
