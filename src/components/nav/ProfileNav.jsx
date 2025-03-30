import React from 'react'
import "./ProfileNav.scss"
import { useAppStore } from '../../lib/store';
import { useGetMyQuery } from '../../hooks/getUserDetails';
import { MdCloudUpload, MdKeyboardArrowDown, MdOutlineKeyboardArrowUp } from "react-icons/md";
import { ImPower } from "react-icons/im";
import { Link } from 'react-router-dom';
import { FaDiscord, FaLanguage} from 'react-icons/fa';
import { IoPower } from 'react-icons/io5';
import { FaCheckToSlot, FaJxl, FaSquareXTwitter, FaUserGroup } from 'react-icons/fa6';
import { TiThList } from "react-icons/ti";
import { IoMdPerson } from 'react-icons/io';
import { RiWallet3Fill } from 'react-icons/ri';
import logo from "../../assets/image/3S_logo.svg";
import { SiTelegram } from "react-icons/si";

function ProfileNav({isVisible, onclose}) {
  const {  LogOut, user } = useAppStore();
    const getUserProfile = useGetMyQuery()?.profile;
    console.log(getUserProfile)

  return (
    <div className={`profilenav-container ${isVisible ? 'visible' : ''}`} onClick={onclose}>
        <div className="profile-wrap" onClick={(e) => e.stopPropagation()}>
          
           <div className='pro-top-wrap'style={{ backgroundImage: `url(https://images.hive.blog/u/${user}/cover)`, backgroundSize: "cover", backgroundPosition: "center",}}> 
            {/* <img className='' src={getUserProfile?.images?.cover} alt="" /> */}
            <img className='avatar-img' src={`https://images.hive.blog/u/${user}/avatar`} alt="" />
            <span className='username'>{user}</span>
            <div className="power-wrap">
              <div className="wrap">
              <MdOutlineKeyboardArrowUp />
              <span>100%</span>
              </div>
              <div className="wrap">
              <MdKeyboardArrowDown />
              <span>100%</span>
              </div>
              <div className="wrap">
              <ImPower />
              <span>100%</span>
              </div>
            </div>
           </div>
           <div className="list-wrap">
          <Link to="/profile"  className="wrap" onClick={onclose}>
            <IoMdPerson className="icon" /> <span>My Channel</span>
          </Link>
          <Link  className="wrap" onClick={onclose}>
            <TiThList className="icon" /> <span>Playlist</span>
          </Link>
          <Link  to="/upload" className="wrap" onClick={onclose}>
            <MdCloudUpload className="icon" /> <span>Upload Video</span>
          </Link>
          <Link to="/wallet" className="wrap" onClick={onclose}>
            <RiWallet3Fill className="icon" /> <span>Wallet</span>
          </Link>
          {/* <Link  className="wrap">
            <FaJxl className="icon" /> <span>Proposals</span>
          </Link> */}
          {/* <Link  className="wrap">
            <FaCheckToSlot className="icon" /> <span>witnesses</span>
          </Link> */}
          {/* <Link  className="wrap">
            <FaRegSmile className="icon" /> <span>Switch User</span>
          </Link> */}
          <Link  className="wrap">
            <FaUserGroup className="icon" /> <span>Switch User</span>
          </Link>
          <Link  className="wrap">
            <FaLanguage className="icon" /> <span>Language Settings</span>
          </Link>
          <Link to={"/login"} onClick={()=>{LogOut();onclose()}} className="wrap">
            <IoPower className="icon" /> <span>Logout</span>
          </Link>
           </div>
           <div className="logo-wrap">
           <img className="logo" src={logo} alt="" />
           </div>
           <div className="support-wrap">
           <FaDiscord />
           <SiTelegram />
           <FaSquareXTwitter />
           </div>
           
           <span className='close-btn' onClick={onclose}>X</span>
        </div>
    </div>
  )
}

export default ProfileNav