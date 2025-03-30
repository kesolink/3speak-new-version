import { GiToggles } from "react-icons/gi";
import logo from "../../assets/image/3S_logo.svg";
import "./nav.scss";
import { CiSearch } from "react-icons/ci";
import Sidebar from "../Sidebar/Sidebar";
import { Link, NavLink } from "react-router-dom";
import { useAppStore } from "../../lib/store";
import { useGetMyQuery } from "../../hooks/getUserDetails";
import { IoIosNotifications } from "react-icons/io";
import { AiOutlineClose} from "react-icons/ai";
import { IoCloudUploadSharp } from "react-icons/io5";
import { MdOutlineDashboard, MdOutlineDynamicFeed, MdOutlineLeaderboard } from "react-icons/md";
import { FaFire, FaRegSmile } from "react-icons/fa";
import { LuNewspaper } from "react-icons/lu";
import { HiInformationCircle } from "react-icons/hi";
import { PiUserSwitchBold } from "react-icons/pi";
import { RiProfileLine } from "react-icons/ri";
import apple_icon from "../../assets/image/app-store.png"
import play_store from "../../assets/image/playstore.png"
import { useState } from "react";
function Nav({ setSideBar, toggleProfileNav }) {
  const { authenticated, LogOut } = useAppStore();
  const [nav, setNav] = useState(false)

  const getUserProfile = useGetMyQuery()?.profile;
  console.log("User profile", getUserProfile);
  // console.log(getUserProfile.images.avatar);
  const handleNav = () =>{
    setNav((prev) => !prev);
    console.log(nav)
   }



  return (
    <nav className="nav-container">
      <div className="nav-left flex-dev">
        <GiToggles size={25} className="menu-icon" onClick={() => setSideBar((prev) => (prev === false ? true : false))}/>
        <img className="logo" src={logo} alt="" />
      </div>
      
      <div className="phone-nav-left" >
        <GiToggles size={25} className="menu-icon" onClick={handleNav}/>
        <img className="logo" src={logo} alt="" />
      </div>
      <div className="nav-middle flex-dev">
        <div className="search-box">
          <input type="text" placeholder="Search community" />
          <CiSearch className="search-icon" />
        </div>
      </div>
      <div className={nav ? "side-nav" : "side-nav-else"}>
      <AiOutlineClose className="close-nav" onClick={handleNav}/> 

      <div >
            <div className="shortcut-links">
              <Link to="/" className="side-link-n" onClick={handleNav}>
                <MdOutlineDashboard className="icon" /> <span>Home</span>
              </Link>
              <Link to="/upload" className="side-link-n" onClick={handleNav}>
                <IoCloudUploadSharp className="icon" /> <span>Upload Video</span>
              </Link>
              <Link to="/firstupload" className="side-link-n" onClick={handleNav}>
                <FaRegSmile className="icon"/> <span>First Uploads</span>
              </Link>
              
              <Link to="/trend" className="side-link-n" onClick={handleNav}>
                <FaFire className="icon" /> <span>Trending Content</span>
              </Link> 
              <Link to="/new" className="side-link-n" onClick={handleNav}>
                <LuNewspaper className="icon" /> <span>New Content</span>
              </Link>
              <Link to="/communities" className="side-link-n" onClick={handleNav}>
                <MdOutlineDynamicFeed className="icon" /> <span>Communities</span>
              </Link>
              <Link to="/leaderboard" className="side-link-n" onClick={handleNav}>
                <MdOutlineLeaderboard className="icon" /> <span>Leaderboard</span>
              </Link>
              <div className="side-link-n" onClick={handleNav}>
                <HiInformationCircle className="icon" /> <span>About 3speak</span>
              </div>
      
              <hr />
            </div>
            <div className="subscibed-list">
              <h3>Download</h3>
              <div className="side-link-n">
                <img src={apple_icon} alt=""className="store-icon" /> <span>Apple Store</span>
              </div>
              <div className="side-link-n">
              <img src={play_store} alt=""className="store-icon" /> <span>Play Store</span>
              </div>
              <div className="side-link-n">
                <PiUserSwitchBold className="icon"  /> <span>Switch Account</span>
              </div>
              
            </div>
          </div>
      </div>




      {authenticated ? (
        <div className="nav-right flex-div">
          <span>{getUserProfile?.username}</span>
          {/* <IoIosNotifications size={20} /> */}
          
          <img src={getUserProfile?.images?.avatar} alt="" onClick={toggleProfileNav} />
          {/* <div className="dropdown-menu">
            <Link className="list">My Channel</Link>
            <Link className="list">Upload Video</Link>
            <Link className="list">PlayList</Link>
            <Link to="/wallet" className="list" >Wallet</Link>
            <Link className="list" >Logout</Link>
          </div> */}
        </div>
      ) : (
        <>
          <Link to="/login">
            <button>LOG IN</button>
          </Link>
        </>
      )}
    </nav>
  );
}

export default Nav;
