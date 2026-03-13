import { Link, useLocation, useNavigate } from "react-router-dom";
import { MdOutlineHome, MdOutlineSearch } from "react-icons/md";
import { IoAddCircleOutline, IoPower, IoCloudUploadSharp } from "react-icons/io5";
import { IoMdPerson } from "react-icons/io";
import { RiWallet3Fill } from "react-icons/ri";
import { Clapperboard } from "lucide-react";
import { useAppStore } from "../../lib/store";
import ShortsIcon from "../icons/ShortsIcon";
import { FEATURE_EDITOR } from "../../utils/config";
import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import "./BottomNav.scss";

// Swipeable tab routes in order
const SWIPE_TABS = ["/", "/shorts", "/discover"];

const BottomNav = ({ openLoginModal }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { authenticated, user, showNsfw, setShowNsfw } = useAppStore();
  const path = location.pathname;
  const [menuOpen, setMenuOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const menuRef = useRef(null);
  const uploadRef = useRef(null);

  const isActive = (route) => path === route;
  const isShortsActive = path.startsWith("/shorts");

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
      if (uploadRef.current && !uploadRef.current.contains(e.target)) {
        setUploadOpen(false);
      }
    };
    if (menuOpen || uploadOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen, uploadOpen]);

  // Close menus on route change
  useEffect(() => {
    setMenuOpen(false);
    setUploadOpen(false);
  }, [path]);

  // Swipe between main tabs (mobile)
  const touchStartRef = useRef(null);
  const touchStartYRef = useRef(null);

  const handleSwipeNav = useCallback((direction) => {
    const currentIdx = SWIPE_TABS.indexOf(path);
    if (currentIdx === -1) return; // not on a swipeable tab

    if (direction === 'left' && currentIdx < SWIPE_TABS.length - 1) {
      navigate(SWIPE_TABS[currentIdx + 1]);
    } else if (direction === 'right' && currentIdx > 0) {
      navigate(SWIPE_TABS[currentIdx - 1]);
    }
  }, [path, navigate]);

  useEffect(() => {
    const isMobile = window.matchMedia('(max-width: 1024px)').matches;
    if (!isMobile) return;

    const onTouchStart = (e) => {
      // Don't capture swipes inside horizontal scroll containers or the bottom nav
      if (e.target.closest('.bottom-nav, .video-scroll-container-horizontal, .stories-scroll-container, .short-main')) return;
      touchStartRef.current = e.touches[0].clientX;
      touchStartYRef.current = e.touches[0].clientY;
    };

    const onTouchEnd = (e) => {
      if (touchStartRef.current == null) return;
      const dx = e.changedTouches[0].clientX - touchStartRef.current;
      const dy = e.changedTouches[0].clientY - touchStartYRef.current;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      // Only treat as horizontal swipe if X distance > 80px and dominant
      if (absDx > 80 && absDx > absDy * 1.8) {
        handleSwipeNav(dx > 0 ? 'right' : 'left');
      }
      touchStartRef.current = null;
      touchStartYRef.current = null;
    };

    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchend', onTouchEnd);
    };
  }, [handleSwipeNav]);

  const handleUploadClick = (e) => {
    e.preventDefault();
    if (!authenticated) {
      openLoginModal();
    } else {
      setUploadOpen((prev) => !prev);
      setMenuOpen(false);
    }
  };

  const handleEditorClick = (e) => {
    e.preventDefault();
    setUploadOpen(false);
    window.dispatchEvent(new CustomEvent('open-shorts-editor'));
  };

  const handleProfileClick = (e) => {
    e.preventDefault();
    if (!authenticated) {
      openLoginModal();
    } else {
      setMenuOpen((prev) => !prev);
      setUploadOpen(false);
    }
  };

  return createPortal(
    <nav className="bottom-nav" ref={menuRef}>
      <Link to="/" className={`bottom-nav-item ${isActive("/") ? "active" : ""}`}>
        <MdOutlineHome className="bottom-nav-icon" />
        <span>Home</span>
      </Link>

      <Link to="/shorts" className={`bottom-nav-item ${isShortsActive ? "active" : ""}`}>
        <ShortsIcon className="bottom-nav-icon" outlineWidth={isShortsActive ? 40 : 30} />
        <span>Shorts</span>
      </Link>

      <div className="bottom-nav-upload-wrap" ref={uploadRef}>
        <a href="#" className={`bottom-nav-item upload-item ${uploadOpen ? "active" : ""}`} onClick={handleUploadClick}>
          <IoAddCircleOutline className="bottom-nav-icon upload-icon" />
          <span>Upload</span>
        </a>
        {uploadOpen && authenticated && (
          <div className="bottom-nav-menu bottom-nav-upload-menu">
            <Link to="/studio" className="bottom-nav-menu-item" onClick={() => setUploadOpen(false)}>
              <IoCloudUploadSharp className="bottom-nav-menu-icon" /> Long-form Video
            </Link>
            <Link to="/embed-studio?from=shorts" className="bottom-nav-menu-item" onClick={() => setUploadOpen(false)}>
              <ShortsIcon className="bottom-nav-menu-icon" outlineWidth={30} /> Shorts Video
            </Link>
            {FEATURE_EDITOR && (
              <a href="#" className="bottom-nav-menu-item" onClick={handleEditorClick}>
                <Clapperboard className="bottom-nav-menu-icon" size={18} /> Shorts Editor
              </a>
            )}
          </div>
        )}
      </div>

      <Link to="/discover" className={`bottom-nav-item ${isActive("/discover") ? "active" : ""}`}>
        <MdOutlineSearch className="bottom-nav-icon" />
        <span>Explore</span>
      </Link>

      <a href="#" className={`bottom-nav-item ${menuOpen ? "active" : ""}`} onClick={handleProfileClick}>
        {authenticated ? (
          <img
            src={`https://images.hive.blog/u/${user}/avatar/small`}
            alt={user}
            className="bottom-nav-avatar"
          />
        ) : (
          <div className="bottom-nav-avatar-placeholder" />
        )}
        <span>{authenticated ? "Profile" : "Login"}</span>
      </a>

      {menuOpen && authenticated && (
        <div className="bottom-nav-menu">
          <div className="bottom-nav-menu-header">
            <img src={`https://images.hive.blog/u/${user}/avatar/small`} alt={user} className="bottom-nav-menu-avatar" />
            <span className="bottom-nav-menu-user">{user}</span>
          </div>
          <div className="bottom-nav-menu-divider" />
          <Link to={`/p/${user}`} className="bottom-nav-menu-item" onClick={() => setMenuOpen(false)}>
            <IoMdPerson className="bottom-nav-menu-icon" /> My Channel
          </Link>
          <Link to={`/wallet/${user}`} className="bottom-nav-menu-item" onClick={() => setMenuOpen(false)}>
            <RiWallet3Fill className="bottom-nav-menu-icon" /> Wallet
          </Link>
          <div className="bottom-nav-menu-item nsfw-toggle-wrap" onClick={() => setShowNsfw(!showNsfw)}>
            <span className="nsfw-label">Show NSFW</span>
            <div className={`nsfw-toggle ${showNsfw ? 'on' : ''}`}>
              <div className="nsfw-toggle-thumb" />
            </div>
          </div>
          <div className="bottom-nav-menu-divider" />
          <a href="#" className="bottom-nav-menu-item" onClick={(e) => { e.preventDefault(); setMenuOpen(false); openLoginModal(); }}>
            <IoPower className="bottom-nav-menu-icon" /> Change account
          </a>
        </div>
      )}
    </nav>,
    document.body
  );
};

export default BottomNav;
