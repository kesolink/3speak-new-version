import { Link, useLocation } from "react-router-dom";
import { MdOutlineHome, MdOutlineSearch, MdOutlineDownload, MdGraphicEq, MdMic } from "react-icons/md";
import { IoAddCircleOutline, IoPower, IoCloudUploadSharp, IoShareOutline } from "react-icons/io5";
import { IoMdPerson } from "react-icons/io";
import { HiInformationCircle } from "react-icons/hi";
import { GiAstronautHelmet } from "react-icons/gi";
import { RiWallet3Fill } from "react-icons/ri";
import { Clapperboard } from "lucide-react";
import { useAppStore } from "../../lib/store";
import LabeledToggle from "../LabeledToggle/LabeledToggle";
import ShortsIcon from "../icons/ShortsIcon";
import useOpenPodsCount from "../../hooks/useOpenPodsCount";
import { FEATURE_EDITOR } from "../../utils/config";
import { APP_VERSION } from "../../version";
import { getHiveUrl } from "../../utils/hiveNode";
import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import PremiumBadge from "../PremiumBadge/PremiumBadge";
import { toast } from "sonner";
import "./BottomNav.scss";

const BottomNav = ({ openLoginModal }) => {
  const location = useLocation();
  const { authenticated, user, showNsfw, setShowNsfw, theme, toggleTheme, sidebarHidden, setSidebarHidden } = useAppStore();
  const livePodsCount = useOpenPodsCount();
  const path = location.pathname;
  const [menuOpen, setMenuOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const menuRef = useRef(null);
  const uploadRef = useRef(null);

  const isActive = (route) => path === route;
  const isShortsActive = path.startsWith("/shorts");

  // PWA install prompt
  const [installPrompt, setInstallPrompt] = useState(null);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true;

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async (e) => {
    e.preventDefault();
    setMenuOpen(false);
    if (installPrompt) {
      installPrompt.prompt();
      await installPrompt.userChoice;
      setInstallPrompt(null);
    }
  };

  // Detect iOS Safari (no beforeinstallprompt, needs manual instructions)
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

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

  // (Hide-on-scroll behavior was removed — the bar is now always visible.)

  // Close menus on route change
  useEffect(() => {
    setMenuOpen(false);
    setUploadOpen(false);
  }, [path]);

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

  const showInstallOption = !isStandalone && (installPrompt || isIOS);

  const handleProfileClick = (e) => {
    e.preventDefault();
    if (!authenticated) {
      // If install is available, show a mini menu; otherwise just open login
      if (showInstallOption) {
        setMenuOpen((prev) => !prev);
        setUploadOpen(false);
      } else {
        openLoginModal();
      }
    } else {
      setMenuOpen((prev) => !prev);
      setUploadOpen(false);
    }
  };

  return createPortal(
    <nav className={`bottom-nav${path === '/watch' ? ' bottom-nav--watch' : ''}`} ref={menuRef}>
      <Link to="/" className={`bottom-nav-item ${isActive("/") ? "active" : ""}`}>
        <MdOutlineHome className="bottom-nav-icon" />
        <span>Home</span>
      </Link>

      <Link to="/audio" className={`bottom-nav-item ${isActive("/audio") ? "active" : ""}`}>
        <MdGraphicEq className="bottom-nav-icon" />
        <span>Audio</span>
      </Link>

      <Link to="/shorts" className={`bottom-nav-item ${isShortsActive ? "active" : ""}`}>
        <ShortsIcon className="bottom-nav-icon" outlineWidth={isShortsActive ? 40 : 30} />
        <span>Shorts</span>
      </Link>

      <Link to="/openpods" className={`bottom-nav-item ${isActive("/openpods") ? "active" : ""}`}>
        <span className="bottom-nav-icon-wrap">
          <MdMic className="bottom-nav-icon" />
          {livePodsCount > 0 && (
            <span className="bottom-nav-live-dot" aria-label={`${livePodsCount} live`} />
          )}
        </span>
        <span>OpenPods</span>
      </Link>

      <a href="#" className={`bottom-nav-item ${menuOpen ? "active" : ""}`} onClick={handleProfileClick}>
        {authenticated ? (
          <span className="bottom-nav-avatar-wrap">
            <img
              src={`https://images.hive.blog/u/${user}/avatar/small`}
              alt={user}
              className="bottom-nav-avatar"
            />
            <PremiumBadge username={user} size={10} className="bottom-nav-avatar-premium" />
          </span>
        ) : (
          <div className="bottom-nav-avatar-placeholder">
            <GiAstronautHelmet />
          </div>
        )}
        <span>{authenticated ? "Profile" : "Login"}</span>
      </a>

      {menuOpen && authenticated && (
        <div className="bottom-nav-menu">
          <div className="bottom-nav-menu-header">
            <span className="bottom-nav-menu-avatar-wrap">
              <img src={`https://images.hive.blog/u/${user}/avatar/small`} alt={user} className="bottom-nav-menu-avatar" />
              <PremiumBadge username={user} size={12} className="bottom-nav-menu-avatar-premium" />
            </span>
            <span className="bottom-nav-menu-user">
              {user}
              <PremiumBadge username={user} size={13} />
            </span>
          </div>
          <div className="bottom-nav-menu-divider" />
          <Link to={`/p/${user}`} className="bottom-nav-menu-item" onClick={() => setMenuOpen(false)}>
            <IoMdPerson className="bottom-nav-menu-icon" /> My Channel
          </Link>
          <Link to={`/wallet/${user}`} className="bottom-nav-menu-item" onClick={() => setMenuOpen(false)}>
            <RiWallet3Fill className="bottom-nav-menu-icon" /> Wallet
          </Link>
          <div className="bottom-nav-menu-item bottom-nav-menu-toggle">
            <LabeledToggle
              leftLabel="Hide NSFW"
              rightLabel="Show NSFW"
              value={showNsfw}
              onChange={(v) => setShowNsfw(v)}
              ariaLabel="Toggle NSFW content"
            />
          </div>
          <div className="bottom-nav-menu-item bottom-nav-menu-toggle">
            <LabeledToggle
              leftLabel="Light mode"
              rightLabel="Dark mode"
              value={theme === 'dark'}
              onChange={(wantDark) => {
                if ((theme === 'dark') !== wantDark) toggleTheme();
              }}
              ariaLabel="Toggle theme"
            />
          </div>
          <div className="bottom-nav-menu-item bottom-nav-menu-toggle">
            <LabeledToggle
              leftLabel="Show sidebar"
              rightLabel="Hide sidebar"
              value={!!sidebarHidden}
              onChange={(hide) => setSidebarHidden(hide)}
              ariaLabel="Toggle sidebar visibility"
            />
          </div>
          <div className="bottom-nav-menu-divider" />
          <Link to="/about" className="bottom-nav-menu-item" onClick={() => setMenuOpen(false)}>
            <HiInformationCircle className="bottom-nav-menu-icon" /> About 3Speak
          </Link>
          {!isStandalone && (installPrompt || isIOS) && (
            <>
              <div className="bottom-nav-menu-divider" />
              {installPrompt ? (
                <a href="#" className="bottom-nav-menu-item bottom-nav-install" onClick={handleInstallClick}>
                  <MdOutlineDownload className="bottom-nav-menu-icon" /> Install App
                </a>
              ) : isIOS ? (
                <a href="#" className="bottom-nav-menu-item bottom-nav-install" onClick={(e) => { e.preventDefault(); setMenuOpen(false); toast('Tap the Share button in Safari, then "Add to Home Screen"', { icon: '📲' }); }}>
                  <MdOutlineDownload className="bottom-nav-menu-icon" />
                  <span className="bottom-nav-install-label">Install App</span>
                  <span className="bottom-nav-install-hint">via <IoShareOutline style={{ verticalAlign: 'middle', fontSize: 14 }} /> Share</span>
                </a>
              ) : null}
            </>
          )}
          <div className="bottom-nav-menu-divider" />
          <a href="#" className="bottom-nav-menu-item" onClick={(e) => { e.preventDefault(); setMenuOpen(false); openLoginModal(); }}>
            <IoPower className="bottom-nav-menu-icon" /> Change account
          </a>
          <div className="bottom-nav-menu-footer">
            <span>App version: v{APP_VERSION}</span>
            <span>Hive node: {getHiveUrl()}</span>
          </div>
        </div>
      )}

      {menuOpen && !authenticated && showInstallOption && (
        <div className="bottom-nav-menu">
          {installPrompt ? (
            <a href="#" className="bottom-nav-menu-item bottom-nav-install" onClick={handleInstallClick}>
              <MdOutlineDownload className="bottom-nav-menu-icon" /> Install App
            </a>
          ) : isIOS ? (
            <div className="bottom-nav-menu-item bottom-nav-install bottom-nav-ios-hint">
              <MdOutlineDownload className="bottom-nav-menu-icon" />
              <span>Tap <strong>Share</strong> then <strong>Add to Home Screen</strong></span>
            </div>
          ) : null}
          <div className="bottom-nav-menu-divider" />
          <a href="#" className="bottom-nav-menu-item" onClick={(e) => { e.preventDefault(); setMenuOpen(false); openLoginModal(); }}>
            <IoMdPerson className="bottom-nav-menu-icon" /> Login
          </a>
        </div>
      )}
    </nav>,
    document.body
  );
};

export default BottomNav;
