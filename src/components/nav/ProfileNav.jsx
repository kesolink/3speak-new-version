import React, { useEffect, useRef, useState } from 'react'
import "./ProfileNav.scss"
import '../../page/Login/KeyChainLogin.scss';
import { useAppStore } from '../../lib/store';
import { useGetMyQuery } from '../../hooks/getUserDetails';
import { MdCloudUpload, MdKeyboardArrowDown, MdOutlineKeyboardArrowUp } from "react-icons/md";
import { ImPower } from "react-icons/im";
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FaDiscord, FaLanguage } from 'react-icons/fa';
import { IoPower } from 'react-icons/io5';
import { FaCheckToSlot, FaJxl, FaSquareXTwitter } from 'react-icons/fa6';
import { TiThList } from "react-icons/ti";
import { IoMdPerson } from 'react-icons/io';
import { RiWallet3Fill } from 'react-icons/ri';
import logo from "../../assets/image/3S_logo.svg";
import logoDark from '../../assets/image/3S_logodark.png';
import { SiTelegram } from "react-icons/si";
import { getVotePower } from '../../utils/hiveUtils';
import { BiChevronDown, BiChevronUp } from 'react-icons/bi';
import UploadLinks from '../UploadLinks';




function ProfileNav({ isVisible, onclose, toggleAddAccount, openLoginModal }) {
  const location = useLocation();
  const navigate = useNavigate()
  const { user, theme, showNsfw, setShowNsfw } = useAppStore();
  const [votingPower, setVotingPower] = useState(0);
  const [rc, setRc] = useState(0);
  const [uploadOpen, setUploadOpen] = useState(false);

  const handlewallletNavigation = () => {
    navigate(`/wallet/${user}`)
  }

  const fetchVotePower = async (user) => {
    try {
      const result = await getVotePower(user);
      if (result) {
        const { vp, rcPercent } = result;
        setRc(rcPercent.toFixed(2));
        setVotingPower((vp / 100).toFixed(2));
      }
    } catch (err) {
      console.error('Error fetching account:', err);
    }
  }
  useEffect(() => {
    if (!user) return;
    fetchVotePower(user);
  }, []);

  return (

    <div className={`profilenav-container ${isVisible ? 'visible' : ''}`} onClick={onclose}>
      <div className="profile-wrap" onClick={(e) => e.stopPropagation()}>

        <div className='pro-top-wrap'style={{ backgroundImage: `url(https://images.hive.blog/u/${user}/cover)`, backgroundSize: "cover", backgroundPosition: "center",}}> 
            {/* <img className='' src={getUserProfile?.images?.cover} alt="" /> */}
            <img className='avatar-img' src={`https://images.hive.blog/u/${user}/avatar`}  alt="" />
            <span className='username'>{user}</span>
            <div className="power-wrap">
            <div className="wrap-in">
              <div className="wrap">
                <MdOutlineKeyboardArrowUp />
                <span>{votingPower}% {" "} VP</span>
              </div>
              <div className="tooltip">
                Voting Power
                <div className="tooltip-arrow"></div>
              </div>
            </div>
            <div className="wrap-in">
              <div className="wrap">
              <MdKeyboardArrowDown />
              <span>{rc}% {" "} RC</span>
              </div>
              <div className="tooltip">
                Resource Credit
                <div className="tooltip-arrow"></div>
              </div>
              </div>

            </div>
           </div>
        <div className="list-wrap">
          <Link to="/profile" className="wrap" onClick={onclose}>
            <IoMdPerson className="icon" /> <span>My Channel</span>
          </Link>
          {/* <Link className="wrap" onClick={onclose}>
            <TiThList className="icon" /> <span>Playlist</span>
          </Link> */}
          <div className="upload-dropdown">
            <div className="wrap" onClick={() => setUploadOpen(!uploadOpen)}>
              <MdCloudUpload className="icon" /> <span>Upload</span>
              {uploadOpen ? <BiChevronUp className="upload-chevron" /> : <BiChevronDown className="upload-chevron" />}
            </div>
            {uploadOpen && (
              <div className="upload-subitems">
                <UploadLinks linkClass="wrap sub-item" onClick={onclose} />
              </div>
            )}
          </div>

          <a className="wrap" onClick={() => { handlewallletNavigation(); onclose() }}>
            <RiWallet3Fill className="icon" /> <span>Wallet</span>
          </a>
          {/* <Link className="wrap">
            <FaLanguage className="icon" /> <span>Language Settings</span>
          </Link> */}
          <div className="wrap nsfw-toggle-wrap" onClick={() => setShowNsfw(!showNsfw)}>
            <span>Show NSFW</span>
            <div className={`nsfw-toggle ${showNsfw ? 'on' : ''}`}>
              <div className="nsfw-toggle-thumb" />
            </div>
          </div>
          <a className="wrap" onClick={() => { onclose(); openLoginModal(); }}>
            <IoPower className="icon" /> <span>Change account</span>
          </a>

           </div>
           <hr className="profile-divider" />
           <div className="logo-wrap">
          {theme === "light" ? <img className="logo" src={logo} alt="3Speak Logo" /> :
            <img className="logo" src={logoDark} alt="3Speak Logo" />}
           </div>
        <div className="support-wrap">
          <a href="https://discord.com/invite/NSFS2VGj83" className="social-link" target="_blank" rel="noopener noreferrer">
            <FaDiscord size={30} />
          </a>
          <a href="https://x.com/3speaktv?utm_source=3speak.tv " className="social-link" target="_blank" rel="noopener noreferrer">
            <FaSquareXTwitter size={30} />
          </a>
          <a href="https://t.me/threespeak?utm_source=3speak.tv" className="social-link" target="_blank" rel="noopener noreferrer">
            <SiTelegram size={30} />
          </a>

        </div>
           
           <span className='close-btn' onClick={onclose}>X</span>

        
      </div>
    </div>
  )
}

export default ProfileNav