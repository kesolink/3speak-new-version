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
} from "react-icons/md";
import { LuNewspaper } from "react-icons/lu";
import { FaFire, FaRegSmile } from "react-icons/fa";
import { IoCloudUploadSharp } from "react-icons/io5";
import { Link } from "react-router-dom";

const Sidebar = ({ sidebar }) => {
  console.log(sidebar);
  return (
    <div className={`sidebar ${sidebar ? "" : "small-sidebar"}`}>
      <div className="shortcut-links">
        <Link to="/" className="side-link">
          <MdOutlineDashboard className="icon" /> <span>Home</span>
        </Link>
        <Link to="/upload" className="side-link">
          <IoCloudUploadSharp className="icon" /> <span>Upload Video</span>
        </Link>
        <Link to="/firstupload" className="side-link">
          <FaRegSmile className="icon" /> <span>First Uploads</span>
        </Link>

        <Link to="/trend" className="side-link">
          <FaFire className="icon" /> <span>Trending Content</span>
        </Link>
        <Link to="/new" className="side-link">
          <LuNewspaper className="icon" /> <span>New Content</span>
        </Link>
        <Link to="/communities" className="side-link">
          <MdOutlineDynamicFeed className="icon" /> <span>Communities</span>
        </Link>
        <Link to="/leaderboard" className="side-link">
          <MdOutlineLeaderboard className="icon" /> <span>Leaderboard</span>
        </Link>
        <div className="side-link">
          <HiInformationCircle className="icon" /> <span>About 3speak</span>
        </div>

        <hr />
      </div>
      <div className="subscibed-list">
        <h3>Download</h3>
        <div className="side-link">
          <img src={apple_icon} alt="" className="store-icon" />{" "}
          <span>Apple Store</span>
        </div>
        <div className="side-link">
          <img src={play_store} alt="" className="store-icon" />{" "}
          <span>Play Store</span>
        </div>
        <div className="side-link">
          <PiUserSwitchBold className="icon" /> <span>Switch Account</span>
        </div>
        
      </div>
    </div>
  );
};

export default Sidebar;
