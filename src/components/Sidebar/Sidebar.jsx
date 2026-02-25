import { RiProfileLine } from "react-icons/ri";
import "./Sidebar.scss";
import apple_icon from "../../assets/image/app-store.png";
import play_store from "../../assets/image/playstore.png";
import { PiUserSwitchBold } from "react-icons/pi";
import { HiInformationCircle } from "react-icons/hi";
import {
  MdOutlineDashboard,
  MdOutlineDynamicFeed,
  MdOutlineLeaderboard,
  MdPlaylistPlay,
} from "react-icons/md";
import { LuNewspaper } from "react-icons/lu";
import { FaFire, FaRegSmile } from "react-icons/fa";
import { IoCloudUploadSharp } from "react-icons/io5";
import { RiRssFill } from "react-icons/ri";
import { BiChevronRight } from "react-icons/bi";
import { BsCollectionPlay } from "react-icons/bs";
import { Link } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import { useAppStore } from "../../lib/store";
import ShortsIcon from "../icons/ShortsIcon";
import UploadLinks from "../UploadLinks";
import { COMPACT_SIDEBAR } from "../../utils/config";

const SidebarDropdown = ({ icon: Icon, label, children, sidebar }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const compact = sidebar === false;

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    if (open && !compact) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, compact]);

  return (
    <div
      className={`sidebar-dropdown ${open ? "open" : ""}`}
      ref={ref}
      onMouseEnter={compact ? () => setOpen(true) : undefined}
      onMouseLeave={compact ? () => setOpen(false) : undefined}
    >
      <div
        className="side-link dropdown-toggle"
        onClick={compact ? undefined : () => setOpen(!open)}
        title={label}
      >
        <Icon className="icon" />
        <span>{label}</span>
        <BiChevronRight className="chevron" />
      </div>
      {open && <div className="flyout-menu" onClick={() => setOpen(false)}>{children}</div>}
    </div>
  );
};

const Sidebar = ({ sidebar }) => {
  const { authenticated, user } = useAppStore();

  return (
    <div className={`sidebar ${sidebar ? "" : "small-sidebar"}`}>
      <div className="shortcut-links">
        <Link to="/" className="side-link" title="Home">
          <MdOutlineDashboard className="icon" /> <span>Home</span>
        </Link>
        <Link to="/shorts" className="side-link" title="Shorts">
          <ShortsIcon className="icon" outlineWidth={30} /> <span>Shorts</span>
        </Link>
       {authenticated && (
          <SidebarDropdown icon={IoCloudUploadSharp} label="Upload" sidebar={sidebar}>
            <UploadLinks linkClass="side-link" />
          </SidebarDropdown>
        )}

        {COMPACT_SIDEBAR ? (
          <SidebarDropdown icon={BsCollectionPlay} label="Feeds" sidebar={sidebar}>
            <Link to="/firstupload" className="side-link" title="First Uploads">
              <FaRegSmile className="icon" /> <span>First Uploads</span>
            </Link>
            <Link to="/new" className="side-link" title="New Content">
              <LuNewspaper className="icon" /> <span>New Content</span>
            </Link>
            {authenticated && (
              <Link to="/follow-feed" className="side-link" title="Follow Feed">
                <RiRssFill className="icon" /> <span>Follow Feed</span>
              </Link>
            )}
            <Link to="/trend" className="side-link" title="Trending Content">
              <FaFire className="icon" /> <span>Trending Content</span>
            </Link>
          </SidebarDropdown>
        ) : (
          <>
            <Link to="/firstupload" className="side-link" title="First Uploads">
              <FaRegSmile className="icon" /> <span>First Uploads</span>
            </Link>
            <Link to="/trend" className="side-link" title="Trending Content">
              <FaFire className="icon" /> <span>Trending Content</span>
            </Link>
            <Link to="/new" className="side-link" title="New Content">
              <LuNewspaper className="icon" /> <span>New Content</span>
            </Link>
          </>
        )}

        {authenticated && <Link to="/profile?tab=playlists" className="side-link" title="Playlists">
          <MdPlaylistPlay className="icon" /> <span>Playlists</span>
        </Link>}

        <Link to="/communities" className="side-link" title="Communities">
          <MdOutlineDynamicFeed className="icon" /> <span>Communities</span>
        </Link>
        <Link to="/about" className="side-link" title="About 3speak">
          <HiInformationCircle className="icon" /> <span>About 3speak</span>
        </Link>

        <hr />
      </div>
      <div className="subscibed-list">
        <h3>Download</h3>
        <a href="https://apps.apple.com/gb/app/3speak/id1614771373" target="_blank" rel="noopener noreferrer" className="side-link" title="Apple Store">
          <img src={apple_icon} alt="" className="store-icon" />{" "}
          <span>Apple Store</span>
        </a>
        <a href="https://play.google.com/store/apps/details?id=tv.threespeak.app" target="_blank" rel="noopener noreferrer" className="side-link" title="Play Store">
          <img src={play_store} alt="" className="store-icon" />{" "}
          <span>Play Store</span>
        </a>
      </div>
    </div>
  );
};

export default Sidebar;
