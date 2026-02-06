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
import { Link } from "react-router-dom";
import { useAppStore } from "../../lib/store";
import { SiYoutubeshorts } from "react-icons/si";

const Sidebar = ({ sidebar }) => {
  const { authenticated, user } = useAppStore();
  // console.log(sidebar);
  return (
    <div className={`sidebar ${sidebar ? "" : "small-sidebar"}`}>
      <div className="shortcut-links">
        <Link to="/" className="side-link" title="Home">
          <MdOutlineDashboard className="icon" /> <span>Home</span>
        </Link>
       {authenticated && <Link to="/studio" className="side-link" title="Upload Video">
          <IoCloudUploadSharp className="icon" /> <span>Upload Video</span>
        </Link>}
        {authenticated && <Link to="/profile?tab=playlists" className="side-link" title="My Playlists">
          <MdPlaylistPlay className="icon" /> <span>My Playlists</span>
        </Link>}
        <Link to="/firstupload" className="side-link" title="First Uploads">
          <FaRegSmile className="icon" /> <span>First Uploads</span>
        </Link>

        <Link to="/trend" className="side-link" title="Trending Content">
          <FaFire className="icon" /> <span>Trending Content</span>
        </Link>
        <Link to="/new" className="side-link" title="New Content">
          <LuNewspaper className="icon" /> <span>New Content</span>
        </Link>
        <Link to="/shorts" className="side-link" title="Shorts">
          <SiYoutubeshorts className="icon" /> <span>Shorts</span>
        </Link>
        <Link to="/communities" className="side-link" title="Communities">
          <MdOutlineDynamicFeed className="icon" /> <span>Communities</span>
        </Link>
        {/* <Link to="/leaderboard" className="side-link">
          <MdOutlineLeaderboard className="icon" /> <span>Leaderboard</span>
        </Link> */}
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
        {/* <div className="side-link">
          <PiUserSwitchBold className="icon" /> <span>Switch Account</span>
        </div> */}
        
      </div>
    </div>
  );
};

export default Sidebar;
