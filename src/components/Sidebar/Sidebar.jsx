import { useState, useEffect } from "react";
import { RiProfileLine } from "react-icons/ri";
import "./Sidebar.scss";
import apple_icon from "../../assets/image/app-store.png";
import play_store from "../../assets/image/playstore.png";
import logo from "../../assets/image/3S_logo.svg";
import logoDark from "../../assets/image/3S_logodark.png";
import { PiUserSwitchBold } from "react-icons/pi";
import { HiInformationCircle } from "react-icons/hi";
import {
  MdOutlineDashboard,
  MdOutlineDynamicFeed,
  MdOutlineLeaderboard,
} from "react-icons/md";
import { CiSearch } from "react-icons/ci";
import { LuNewspaper } from "react-icons/lu";
import { FaFire, FaRegSmile } from "react-icons/fa";
import { IoCloudUploadSharp, IoLogInOutline, IoLogOutOutline } from "react-icons/io5";
import { MdDarkMode, MdLightMode } from "react-icons/md";
import { Link, useNavigate } from "react-router-dom";
import { useAppStore } from "../../lib/store";
import { useTVMode } from "../../context/TVModeContext";
import { useTVKeyboard } from "../../context/TVKeyboardContext";

const Sidebar = ({ sidebar, tvSidebarFocusIndex = -1, setTvSidebarFocusIndex, onTvSidebarNavigate, onTvSidebarAction, onTvLogin, onOpenAbout }) => {
  const { authenticated, theme, toggleTheme, user } = useAppStore();
  const { isTVMode, setSidebarItemCount } = useTVMode();
  const { openKeyboard } = useTVKeyboard();
  const navigate = useNavigate();
  const [tvSearchTerm, setTvSearchTerm] = useState('');

  // Build list of sidebar items based on authentication state
  // Note: Upload Video is hidden in TV mode (not practical for TV apps)
  const sidebarItems = [
    { to: "/", label: "Home", icon: <MdOutlineDashboard className="icon" /> },
    ...(authenticated && !isTVMode ? [{ to: "/studio", label: "Upload Video", icon: <IoCloudUploadSharp className="icon" /> }] : []),
    { to: "/firstupload", label: "First Uploads", icon: <FaRegSmile className="icon" /> },
    { to: "/trend", label: "Trending Content", icon: <FaFire className="icon" /> },
    { to: "/new", label: "New Content", icon: <LuNewspaper className="icon" /> },
    { to: "/communities", label: "Communities", icon: <MdOutlineDynamicFeed className="icon" /> },
    { to: "/about", label: "About 3speak", icon: <HiInformationCircle className="icon" /> },
  ];

  // TV mode: Order is:
  // 0 = Login/Account
  // 1 = Dark/Light Mode
  // 2-8 = Navigation items
  // 9 (last) = Search
  const TV_LOGIN_INDEX = 0;
  const TV_THEME_INDEX = 1;
  const TV_NAV_START_INDEX = 2;
  const TV_SEARCH_INDEX = TV_NAV_START_INDEX + sidebarItems.length;

  // Total focusable items in TV mode: login + theme + nav items + search
  const totalTvItems = 2 + sidebarItems.length + 1;

  // Update the sidebar item count in context
  useEffect(() => {
    if (isTVMode) {
      setSidebarItemCount(totalTvItems);
    }
  }, [isTVMode, totalTvItems, setSidebarItemCount]);

  // Listen for keyboard open event from sidebar navigation hook
  useEffect(() => {
    if (!isTVMode) return;

    const handleOpenKeyboard = () => {
      openKeyboard({
        initialValue: tvSearchTerm,
        placeholder: 'Search users...',
        onChange: setTvSearchTerm,
        onSubmit: (value) => {
          if (value.trim()) {
            navigate(`/p/${value.trim()}`);
            setTvSearchTerm('');
          }
        },
      });
    };

    document.addEventListener('tv-open-keyboard', handleOpenKeyboard);
    return () => document.removeEventListener('tv-open-keyboard', handleOpenKeyboard);
  }, [isTVMode, openKeyboard, tvSearchTerm, navigate]);

  const handleItemClick = (to, e) => {
    // In TV mode, open About modal instead of navigating
    if (isTVMode && to === "/about") {
      e?.preventDefault();
      setShowAboutModal(true);
      return;
    }
    if (isTVMode && onTvSidebarNavigate) {
      onTvSidebarNavigate(to);
    }
  };

  const handleTvActionClick = (actionType) => {
    if (actionType === "toggle-theme") {
      toggleTheme();
    } else if (actionType === "login" || actionType === "account") {
      // Open the Aioha modal for login or account management
      if (onTvLogin) onTvLogin();
    }
  };

  return (
    <div className={`sidebar ${sidebar ? "" : "small-sidebar"}${isTVMode && tvSidebarFocusIndex >= 0 ? ' tv-sidebar-active' : ''}`}>
      {/* TV Mode: Logo at the top with spacer */}
      {isTVMode && (
        <div className="tv-logo-section">
          <img
            src={theme === 'dark' ? logoDark : logo}
            alt="3Speak"
            className="tv-logo"
          />
          <div className="tv-logo-spacer" />
        </div>
      )}

      {/* TV Mode: Login/Account button at top */}
      {isTVMode && (
        <div className="tv-account-section">
          <div
            className={`side-link tv-action-item${tvSidebarFocusIndex === TV_LOGIN_INDEX ? ' tv-focused' : ''}`}
            data-tv-sidebar-focusable="true"
            data-tv-sidebar-index={TV_LOGIN_INDEX}
            onClick={() => handleTvActionClick(authenticated ? "account" : "login")}
          >
            {authenticated ? (
              <>
                <img
                  src={`https://images.hive.blog/u/${user}/avatar`}
                  alt={user}
                  className="tv-account-avatar"
                  style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover', marginRight: 15 }}
                />
                <span>{user || "Account"}</span>
              </>
            ) : (
              <>
                <IoLogInOutline className="icon" />
                <span>Log In</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* TV Mode: Dark/Light mode toggle */}
      {isTVMode && (
        <div className="tv-theme-section">
          <div
            className={`side-link tv-action-item${tvSidebarFocusIndex === TV_THEME_INDEX ? ' tv-focused' : ''}`}
            data-tv-sidebar-focusable="true"
            data-tv-sidebar-index={TV_THEME_INDEX}
            onClick={() => handleTvActionClick("toggle-theme")}
          >
            {theme === 'dark' ? <MdLightMode className="icon" /> : <MdDarkMode className="icon" />}
            <span>{theme === 'dark' ? "Light Mode" : "Dark Mode"}</span>
          </div>
        </div>
      )}

      {/* Navigation links */}
      <div className="shortcut-links">
        {sidebarItems.map((item, index) => {
          // In TV mode, index is offset by 2 (login + theme)
          const tvIndex = isTVMode ? TV_NAV_START_INDEX + index : index;

          // In TV mode, render About as a div (not Link) to show modal
          if (isTVMode && item.to === "/about") {
            return (
              <div
                key={item.to}
                className={`side-link${tvSidebarFocusIndex === tvIndex ? ' tv-focused' : ''}`}
                data-tv-sidebar-focusable="true"
                data-tv-sidebar-index={tvIndex}
                onClick={() => onOpenAbout && onOpenAbout()}
                style={{ cursor: 'pointer' }}
              >
                {item.icon} <span>{item.label}</span>
              </div>
            );
          }

          return (
            <Link
              key={item.to}
              to={item.to}
              className={`side-link${isTVMode && tvSidebarFocusIndex === tvIndex ? ' tv-focused' : ''}`}
              data-tv-sidebar-focusable="true"
              data-tv-sidebar-index={tvIndex}
              onClick={(e) => handleItemClick(item.to, e)}
            >
              {item.icon} <span>{item.label}</span>
            </Link>
          );
        })}

        {!isTVMode && <hr />}
      </div>

      {/* TV Mode: Search field at bottom */}
      {isTVMode && (
        <div className="tv-search-section tv-search-bottom">
          <div
            className={`tv-search-wrapper${tvSidebarFocusIndex === TV_SEARCH_INDEX ? ' tv-focused' : ''}`}
            data-tv-sidebar-focusable="true"
            data-tv-sidebar-index={TV_SEARCH_INDEX}
            onClick={() => openKeyboard({
              initialValue: tvSearchTerm,
              placeholder: 'Search users...',
              onChange: setTvSearchTerm,
              onSubmit: (value) => {
                if (value.trim()) {
                  navigate(`/p/${value.trim()}`);
                  setTvSearchTerm('');
                }
              },
            })}
          >
            <CiSearch className="tv-search-icon" size={20} />
            <div className="tv-search-display">
              {tvSearchTerm || 'Search users...'}
            </div>
          </div>
        </div>
      )}

      {/* Non-TV Mode: Show Download section */}
      {!isTVMode && (
        <div className="subscibed-list">
          <h3>Download</h3>
          <a href="https://apps.apple.com/gb/app/3speak/id1614771373" target="_blank" rel="noopener noreferrer" className="side-link">
            <img src={apple_icon} alt="" className="store-icon" />{" "}
            <span>Apple Store</span>
          </a>
          <a href="https://play.google.com/store/apps/details?id=tv.threespeak.app" target="_blank" rel="noopener noreferrer" className="side-link">
            <img src={play_store} alt="" className="store-icon" />{" "}
            <span>Play Store</span>
          </a>
        </div>
      )}
    </div>
  );
};

export default Sidebar;
