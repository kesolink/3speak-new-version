import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

// Feed pages that should restore scroll position when navigating back
const FEED_PATHS = ['/', '/discover', '/trend', '/new', '/firstupload', '/home-feed', '/follow-feed'];

const ScrollToTop = () => {
  const { pathname } = useLocation();
  const prevPathRef = useRef(pathname);

  useEffect(() => {
    const prevPath = prevPathRef.current;
    prevPathRef.current = pathname;

    // Save scroll position of the page we're leaving (if it's a feed page)
    if (FEED_PATHS.includes(prevPath)) {
      sessionStorage.setItem(`scroll:${prevPath}`, String(window.scrollY));
    }

    // Restore scroll position if arriving at a feed page
    if (FEED_PATHS.includes(pathname)) {
      const saved = sessionStorage.getItem(`scroll:${pathname}`);
      if (saved) {
        // Use requestAnimationFrame to ensure DOM has rendered
        requestAnimationFrame(() => {
          window.scrollTo({ top: parseInt(saved, 10), behavior: 'instant' });
        });
        return;
      }
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [pathname]);

  return null;
};

export default ScrollToTop;
