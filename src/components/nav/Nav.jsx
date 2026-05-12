import logo from "../../assets/image/3S_logo.svg";
import logoDark from "../../assets/image/3S_logodark.png";
import "./nav.scss";
import Sidebar from "../Sidebar/Sidebar";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useAppStore } from "../../lib/store";
import { AiOutlineClose} from "react-icons/ai";
import { IoCloudUploadSharp } from "react-icons/io5";
import { useEffect, useRef, useState } from "react";
import NavSearch from "./NavSearch";
import useOpenPodsCount from "../../hooks/useOpenPodsCount";
import { TiThMenu } from "react-icons/ti";
import { MdOutlineSearch, MdGraphicEq, MdMic, MdPlaylistPlay, MdWatchLater, MdHistory, MdKeyboardArrowDown } from "react-icons/md";
import { useMyPlaylists } from "../../hooks/useMyPlaylists";
import ShortsIcon from "../icons/ShortsIcon";
import UploadLinks from "../UploadLinks";
import NotificationBell from "./NotificationBell";
import PremiumBadge from "../PremiumBadge/PremiumBadge";

function NavPlaylistsDropdown({ user }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const { data: playlists = [] } = useMyPlaylists({ enabled: !!user });
  const watchLater = playlists.find((p) => p.name === 'Watch Later');
  const watchLaterLink = watchLater ? `/playlist/${watchLater.id}` : '/profile?tab=playlists';

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div className="nav-playlists-wrapper" ref={ref}>
      <button type="button" className={`nav-tab nav-playlists-trigger${open ? ' open' : ''}`} onClick={() => setOpen((v) => !v)}>
        <MdPlaylistPlay className="nav-tab-icon" />
        <span>Playlists</span>
        <MdKeyboardArrowDown className={`nav-playlists-chevron${open ? ' open' : ''}`} size={16} />
      </button>
      {open && (
        <div className="nav-playlists-flyout" onClick={() => setOpen(false)}>
          <Link to={watchLaterLink} className="nav-playlists-flyout-item">
            <MdWatchLater className="nav-playlists-flyout-icon" />
            <span>Watch Later{watchLater?.items?.length > 0 ? ` (${watchLater.items.length})` : ''}</span>
          </Link>
          {user && (
            <Link to={`/watched/${user}`} className="nav-playlists-flyout-item">
              <MdHistory className="nav-playlists-flyout-icon" />
              <span>Watch History</span>
            </Link>
          )}
          <Link to="/profile?tab=playlists" className="nav-playlists-flyout-item">
            <MdPlaylistPlay className="nav-playlists-flyout-icon" />
            <span>All Playlists</span>
          </Link>
        </div>
      )}
    </div>
  );
}

function NavUploadDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div className="nav-upload-wrapper" ref={ref}>
      <div className="nav-upload-btn" onClick={() => setOpen(!open)} title="Upload">
        <IoCloudUploadSharp size={18} />
        <span className="nav-upload-label">Upload</span>
      </div>
      {open && (
        <div className="nav-upload-flyout" onClick={() => setOpen(false)}>
          <UploadLinks linkClass="nav-upload-flyout-item" iconClass="nav-upload-flyout-icon" />
        </div>
      )}
    </div>
  );
}

function Nav({ setSideBar, toggleProfileNav, openLoginModal }) {
  const { authenticated, LogOut, user, initializeTheme, theme } = useAppStore();
  const sidebarHidden = useAppStore((s) => s.sidebarHidden);
  const livePodsCount = useOpenPodsCount();
  const location = useLocation();
  const [nav, setNav] = useState(false)
   const sideNavRef = useRef(null); // Ref for the side nav container
  const menuIconRef = useRef(null); // Ref for the menu toggle button
  const [navHidden, setNavHidden] = useState(false);
  const lastScrollY = useRef(0);
  const navContainerRef = useRef(null);

  // Measure nav height and set CSS variables globally
  useEffect(() => {
    const el = navContainerRef.current;
    if (!el) return;
    const updateHeight = () => {
      const h = `${el.offsetHeight}px`;
      el.style.setProperty('--nav-height', h);
      document.documentElement.style.setProperty('--nav-height', h);
    };
    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  // Expose nav hidden state as CSS variable
  useEffect(() => {
    document.documentElement.style.setProperty('--nav-top-offset', navHidden ? '0px' : 'var(--nav-height, 50px)');
  }, [navHidden]);

  // Auto-hide top nav on scroll (mobile)
  // In landscape on watch page: hidden by default, show on scroll down
  // Normal mobile: hide on scroll down, show on scroll up
  useEffect(() => {
    const landscapeQuery = window.matchMedia('(orientation: landscape) and (max-height: 500px)');
    const isLandscapeWatch = () => location.pathname === '/watch' && landscapeQuery.matches;

    // Set initial state for landscape watch
    if (isLandscapeWatch()) setNavHidden(true);

    const onScroll = () => {
      const currentY = window.scrollY;
      if (isLandscapeWatch()) {
        // Landscape watch: show when scrolling down (past video), hide when scrolling up
        if (currentY > lastScrollY.current && currentY > 80) {
          setNavHidden(false);
        } else {
          setNavHidden(true);
        }
      } else {
        // Normal: hide on scroll down, show on scroll up
        if (currentY > lastScrollY.current && currentY > 80) {
          setNavHidden(true);
        } else {
          setNavHidden(false);
        }
      }
      lastScrollY.current = currentY;
    };

    // Re-evaluate when orientation changes
    const onOrientationChange = () => {
      if (isLandscapeWatch()) {
        setNavHidden(true);
      } else {
        setNavHidden(false);
      }
    };
    landscapeQuery.addEventListener('change', onOrientationChange);

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      landscapeQuery.removeEventListener('change', onOrientationChange);
    };
  }, [location.pathname]);



  const handleNav = () =>{
    setNav((prev) => !prev);
   }

   // Initialize theme on mount
   useEffect(() => {
    initializeTheme();
   }, []);

   useEffect(() => {
  const handleClickOutside = (e) => {
    // Check if:
    // 1. Nav is open
    // 2. Click is outside side nav
    // 3. Click is outside menu icon (if ref exists)
    if (nav && 
        sideNavRef.current && 
        !sideNavRef.current.contains(e.target) && 
        (!menuIconRef.current || !menuIconRef.current.contains(e.target))) {
      setNav(false);
    }
  };

  document.addEventListener('click', handleClickOutside, true);

  return () => {
    document.removeEventListener('click', handleClickOutside, true);
  };
}, [nav]);





  return (
    <nav ref={navContainerRef} className={`nav-container${navHidden ? ' nav-hidden' : ''}`}>
      <div className="nav-left flex-dev">
        {!sidebarHidden && (
          <TiThMenu size={25} className="menu-icon" onClick={() => setSideBar((prev) => (prev === false ? true : false))}/>
        )}
        <Link to="/"><img className="logo" src={theme === 'dark' ? logoDark : logo} alt="3Speak" /></Link>
      </div>

      <div className="nav-tabs flex-dev">
        <NavLink to="/shorts" className={({ isActive }) => `nav-tab${isActive ? ' active' : ''}`}>
          <ShortsIcon className="nav-tab-icon" outlineWidth={30} /> <span>Shorts</span>
        </NavLink>
        <NavLink to="/audio" className={({ isActive }) => `nav-tab${isActive ? ' active' : ''}`}>
          <MdGraphicEq className="nav-tab-icon" /> <span>Audio</span>
        </NavLink>
        <NavLink to="/openpods" className={({ isActive }) => `nav-tab${isActive ? ' active' : ''}`}>
          <MdMic className="nav-tab-icon" /> <span>OpenPods</span>
          {livePodsCount > 0 && (
            <span className="nav-tab-live-dot" title={`${livePodsCount} live`} aria-label={`${livePodsCount} live`} />
          )}
        </NavLink>
        {authenticated && <NavPlaylistsDropdown user={user} />}
      </div>

      <div className="phone-nav-left" ref={menuIconRef} >
        {!sidebarHidden && (
          <TiThMenu size={25} className="menu-icon" onClick={handleNav} />
        )}
        <Link to="/"><img className="logo" src={theme === 'dark' ? logoDark : logo} alt="3Speak" /></Link>
      </div>
      <div className={nav ? "side-nav" : "side-nav-else"} ref={sideNavRef}>
      <AiOutlineClose className="close-nav" onClick={handleNav}/>
      <Sidebar sidebar={true} onNavigate={handleNav} />
      </div>

      {authenticated ? (
        <div className="nav-right flex-div">
          <NavSearch />
          <Link to="/discover" className="nav-mobile-discover" title="Discover">
            <MdOutlineSearch size={18} />
            <span className="nav-mobile-discover-label">Discover</span>
          </Link>
          <NavUploadDropdown />
          <NotificationBell />
          <span className="nav-avatar-wrap" onClick={toggleProfileNav}>
            <img src={`https://images.hive.blog/u/${user}/avatar`} alt="" />
            <PremiumBadge username={user} size={14} className="nav-avatar-premium" />
          </span>
        </div>
      ) : (
        <div className="nav-right flex-div">
          <NavSearch />
          <Link to="/discover" className="nav-mobile-discover" title="Discover">
            <MdOutlineSearch size={18} />
            <span className="nav-mobile-discover-label">Discover</span>
          </Link>
          <button onClick={openLoginModal}>LOG IN</button>
        </div>
      )}
    </nav>
  );
}

export default Nav;
