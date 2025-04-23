import React, { useEffect, useState } from 'react'
import "./ProfileNav.scss"
import { useAppStore } from '../../lib/store';
import { useGetMyQuery } from '../../hooks/getUserDetails';
import { MdCloudUpload, MdKeyboardArrowDown, MdOutlineKeyboardArrowUp } from "react-icons/md";
import { ImPower } from "react-icons/im";
import { Link, useNavigate } from 'react-router-dom';
import { FaDiscord, FaLanguage} from 'react-icons/fa';
import { IoPower } from 'react-icons/io5';
import { FaCheckToSlot, FaJxl, FaSquareXTwitter, FaUserGroup } from 'react-icons/fa6';
import { TiThList } from "react-icons/ti";
import { IoMdPerson } from 'react-icons/io';
import { RiWallet3Fill } from 'react-icons/ri';
import logo from "../../assets/image/3S_logo.svg";
import { SiTelegram } from "react-icons/si";

function ProfileNav({isVisible, onclose}) {
  const navigate = useNavigate()
  const {  LogOut, user, switchAccount } = useAppStore();
  const [showDropdown, setShowDropdown] = useState(false);
    const getUserProfile = useGetMyQuery()?.profile;
    const [accountList, setAccountList] = useState([]);
      
        useEffect(()=>{
          const getAccountlist = JSON.parse(localStorage.getItem("accountsList")) || [];
          setAccountList(getAccountlist)
        },[])
    console.log(getUserProfile)

    const handlewallletNavigation = ()=>{
      navigate(`/wallet/${user}`)
    }
    const handleSwitchAccount = (user)=>{
    switchAccount(user)
    navigate("/")

  }

  return (
    <div className={`profilenav-container ${isVisible ? 'visible' : ''}`} onClick={onclose}>
        <div className="profile-wrap" onClick={(e) => e.stopPropagation()}>
          
           <div className='pro-top-wrap'style={{ backgroundImage: `url(https://images.hive.blog/u/${user}/cover)`, backgroundSize: "cover", backgroundPosition: "center",}}> 
            {/* <img className='' src={getUserProfile?.images?.cover} alt="" /> */}
            <img className='avatar-img' src={`https://images.hive.blog/u/${user}/avatar`}  alt="" />
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
          <div className="wrap" onClick={()=>{handlewallletNavigation(); onclose()}}>
            <RiWallet3Fill className="icon" /> <span>Wallet</span>
          </div>
          <div  className="wrap dropdown-parent" onClick={() => setShowDropdown(!showDropdown)}>
            <FaUserGroup className="icon" /> <span>Switch User</span>
            {showDropdown && accountList.length > 0 &&(<div className="dropdown-menu">
              <span className='close-btn' onClick={() => setShowDropdown(!showDropdown)}>x</span>
              {accountList.map((list, index)=>(
                <div key={index} className="list" onClick={(e)=>{e.stopPropagation(); handleSwitchAccount(list.username); setShowDropdown(!showDropdown)}}> <img src={`https://images.hive.blog/u/${list.username}/avatar`} alt="" /> <span>{list.username}</span></div>
              ))}
            </div>)}
          </div> 
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