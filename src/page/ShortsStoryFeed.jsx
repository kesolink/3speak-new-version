import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import ShortsStories, { useShortsStories } from "../components/ShortsStories/ShortsStories";
import VideoShort from "./Short";
import { useAppStore } from "../lib/store";
import "./ShortsStoryFeed.scss";

/**
 * ShortsStoryFeed — wrapper page that combines the creator stories bar
 * with the existing shorts player.  Lives at /shorts/stories and keeps
 * the original /shorts algorithm untouched.
 *
 * Creator navigation:
 *  • Desktop — left / right arrow keys
 *  • Mobile  — horizontal swipe (stories bar is hidden; swipe navigates)
 */
const ShortsStoryFeed = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAppStore();

  const feedUser = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get("user") || null;
  }, [location.search]);

  const { creators } = useShortsStories();
  const creatorsRef = useRef(creators);
  creatorsRef.current = creators;
  const feedUserRef = useRef(feedUser);
  feedUserRef.current = feedUser;

  // Swipe animation state
  const [swipeDir, setSwipeDir] = useState(null); // 'left' | 'right' | null
  const swipeTimerRef = useRef(null);

  const triggerSwipeAnim = useCallback((direction) => {
    if (swipeTimerRef.current) clearTimeout(swipeTimerRef.current);
    setSwipeDir(direction);
    swipeTimerRef.current = setTimeout(() => {
      setSwipeDir(null);
      swipeTimerRef.current = null;
    }, 350);
  }, []);

  // Navigate to a specific creator
  const navigateToCreator = useCallback(
    (username) => {
      navigate(`/shorts/stories?user=${username}`, { replace: true });
    },
    [navigate]
  );

  // Navigate to previous / next creator in the list
  const navigateToAdjacentCreator = useCallback(
    (direction) => {
      const all = creatorsRef.current;
      if (!all || all.length === 0) return;

      const list = all.filter((c) => c.username !== user);
      if (list.length === 0) return;

      const current = feedUserRef.current;
      const idx = current ? list.findIndex((c) => c.username === current) : -1;

      let next;
      if (direction === "right") {
        next = idx < list.length - 1 ? idx + 1 : 0;
      } else {
        next = idx > 0 ? idx - 1 : list.length - 1;
      }

      triggerSwipeAnim(direction);
      navigateToCreator(list[next].username);
    },
    [user, navigateToCreator, triggerSwipeAnim]
  );

  // Desktop arrow-key navigation between creators
  useEffect(() => {
    const onKey = (e) => {
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || document.activeElement?.isContentEditable) return;

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        e.stopImmediatePropagation();
        navigateToAdjacentCreator("left");
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        e.stopImmediatePropagation();
        navigateToAdjacentCreator("right");
      }
    };

    // Use capture phase so this fires before Short.jsx's bubble-phase listener
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [navigateToAdjacentCreator]);

  // Mobile horizontal swipe for creator navigation
  const touchXRef = useRef(null);
  const touchYRef = useRef(null);

  const onTouchStart = useCallback((e) => {
    // Ignore swipes that start inside the stories scroll container
    if (e.target.closest('.stories-scroll-container')) {
      touchXRef.current = null;
      return;
    }
    touchXRef.current = e.touches[0].clientX;
    touchYRef.current = e.touches[0].clientY;
  }, []);

  const onTouchEnd = useCallback(
    (e) => {
      if (touchXRef.current == null) return;
      const endX = e.changedTouches[0].clientX;
      const endY = e.changedTouches[0].clientY;
      const dx = endX - touchXRef.current;
      const dy = endY - touchYRef.current;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      // Only treat as horizontal swipe if X distance is dominant
      if (absDx > 50 && absDx > absDy * 1.5 && creatorsRef.current.length > 0) {
        navigateToAdjacentCreator(dx > 0 ? "left" : "right");
      }

      touchXRef.current = null;
      touchYRef.current = null;
    },
    [navigateToAdjacentCreator]
  );

  return (
    <div
      className="shorts-story-feed"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Desktop: compact bar above player */}
      <ShortsStories
        activeCreator={feedUser}
        onCreatorSelect={navigateToCreator}
        compact
        hiddenOnMobile
      />
      <div className={`shorts-story-feed__player${swipeDir ? ` swipe-${swipeDir}` : ""}`}>
        {/* Mobile: small overlay below top controls */}
        <div className="shorts-story-feed__mobile-stories">
          <ShortsStories
            activeCreator={feedUser}
            onCreatorSelect={navigateToCreator}
            compact
          />
        </div>
        <VideoShort key={feedUser || "__global__"} />
      </div>
    </div>
  );
};

export default ShortsStoryFeed;
