import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const ScrollToTop = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    // Skip scroll-to-top on Discover when returning with saved search state
    if (pathname === '/discover') {
      try {
        const raw = sessionStorage.getItem('discover-search-state');
        if (raw) {
          const state = JSON.parse(raw);
          if (state.searchTerm?.trim() && state.scrollY > 0) return;
        }
      } catch {}
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [pathname]);

  return null;
};

export default ScrollToTop;
