import logo from "../../assets/image/3S_logo.svg";
import logoDark from "../../assets/image/3S_logodark.png";
import "./nav.scss";
import { CiSearch } from "react-icons/ci";
import Sidebar from "../Sidebar/Sidebar";
import { Link } from "react-router-dom";
import { useAppStore } from "../../lib/store";
import ThemeToggle from "./ThemeToggle";
import { AiOutlineClose} from "react-icons/ai";
import { IoCloudUploadSharp } from "react-icons/io5";
import { useEffect, useRef, useState } from "react";
import SearchList from "./SearchList";
import SearchList_Sm from "./SearchList_Sm";
import { TiThMenu } from "react-icons/ti";
import UploadLinks from "../UploadLinks";

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
  const [nav, setNav] = useState(false)
  const [searchTerm, setSearchTerm] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const searchBoxRef = useRef(null);
  const [searchTermSm, setSearchTermSm] = useState('');
  const [isDropdownOpensm, setIsDropdownOpensm] = useState(false);
  const searchBoxRefsm = useRef(null);
   const sideNavRef = useRef(null); // Ref for the side nav container
  const menuIconRef = useRef(null); // Ref for the menu toggle button



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
    <nav className="nav-container">
      <div className="nav-left flex-dev">
        <TiThMenu size={25} className="menu-icon" onClick={() => setSideBar((prev) => (prev === false ? true : false))}/>
        <Link to="/"><img className="logo" src={theme === 'dark' ? logoDark : logo} alt="3Speak" /></Link>
      </div>
      
      <div className="phone-nav-left" ref={menuIconRef} >
        <TiThMenu size={25} className="menu-icon" onClick={handleNav} />
        <Link to="/"><img className="logo" src={theme === 'dark' ? logoDark : logo} alt="3Speak" /></Link>
      </div>
      <div className="nav-middle flex-dev">
        <div className="search-wrapper" >
          <span className="search-icon" ref={searchBoxRef}>
            <svg xmlns="http://www.w3.org/2000/svg" className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="7"></circle>
              <path d="m16 16 4 4"></path>
            </svg>
          </span>
          <input onFocus={() => setIsDropdownOpen(true)} value={searchTerm} onChange={(e)=> setSearchTerm(e.target.value.toLowerCase()) } type="search" placeholder="Search users or communities..." className="search-input" />
        </div>




        <SearchList searchTerm={searchTerm} setSearchTerm={setSearchTerm} searchBoxRef={searchBoxRef} isDropdownOpen={isDropdownOpen} setIsDropdownOpen={setIsDropdownOpen} />
      </div>
      <div className={nav ? "side-nav" : "side-nav-else"} ref={sideNavRef}>
      <AiOutlineClose className="close-nav" onClick={handleNav}/>
      <div className="side-nav-search">
        <div className="search-wrap-sm">
          <div className="wrap" ref={searchBoxRefsm}>
            <input onFocus={() => setIsDropdownOpensm(true)} type="text" value={searchTermSm} onChange={(e) => setSearchTermSm(e.target.value.toLowerCase())} placeholder="Search..." />
            <CiSearch size={20} color="green" />
          </div>
          <SearchList_Sm searchTerm={searchTermSm} setSearchTerm={setSearchTermSm} handleNav={handleNav} searchBoxRefsm={searchBoxRefsm} isDropdownOpensm={isDropdownOpensm} setIsDropdownOpensm={setIsDropdownOpensm} />
        </div>
      </div>
      <Sidebar sidebar={true} onNavigate={handleNav} />
      </div>




      {authenticated ? (
        <div className="nav-right flex-div">
          <NavUploadDropdown />
          <ThemeToggle />
          <span>{user}</span>
          {/* <IoIosNotifications size={20} /> */}
          
          <img src={`https://images.hive.blog/u/${user}/avatar`} alt="" onClick={toggleProfileNav} />
          {/* <div className="dropdown-menu">
            <Link className="list">My Channel</Link>
            <Link className="list">Upload Video</Link>
            <Link className="list">PlayList</Link>
            <Link to="/wallet" className="list" >Wallet</Link>
            <Link className="list" >Logout</Link>
          </div> */}
        </div>
      ) : (
        <div className="nav-right flex-div">
          <ThemeToggle />
          <button onClick={openLoginModal}>LOG IN</button>
        </div>
      )}
    </nav>
  );
}

export default Nav;
