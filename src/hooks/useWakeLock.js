import { useEffect, useRef } from 'react';

export function useWakeLock(active) {
  const lockRef = useRef(null);

  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return;

    let released = false;

    navigator.wakeLock.request('screen').then(lock => {
      if (released) { lock.release(); return; }
      lockRef.current = lock;
    }).catch(() => {});

    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && !lockRef.current) {
        navigator.wakeLock.request('screen').then(lock => {
          lockRef.current = lock;
        }).catch(() => {});
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      released = true;
      document.removeEventListener('visibilitychange', handleVisibility);
      if (lockRef.current) {
        lockRef.current.release();
        lockRef.current = null;
      }
    };
  }, [active]);
}
