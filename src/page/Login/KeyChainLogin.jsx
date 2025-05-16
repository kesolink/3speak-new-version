import React, { useEffect, useState } from 'react';
import './KeyChainLogin.scss';
import axios from "axios";
import logo from '../../assets/image/3S_logo.svg';
import keychainImg from '../../assets/image/keychain.png';
import { useNavigate } from 'react-router-dom';
import { LOCAL_STORAGE_ACCESS_TOKEN_KEY, LOCAL_STORAGE_USER_ID_KEY } from '../../hooks/localStorageKeys';
import { useAppStore } from '../../lib/store';
import { MdSwitchAccount } from 'react-icons/md';
import { LuLogOut } from 'react-icons/lu';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
// import { has3SpeakPostAuth } from '../../utils/hiveUtils';
function KeyChainLogin() {
  const client = axios.create({});
  const { initializeAuth, setActiveUser, switchAccount, clearAccount } = useAppStore();
  const studioEndPoint = "https://studio.3speak.tv";
  const [username, setUsername] = useState('');
  const [accessToken, setAccessToken] = useState("");
  const [accountList, setAccountList] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const getAccountlist = JSON.parse(localStorage.getItem("accountsList")) || [];
    setAccountList(getAccountlist);
  }, []);


//   async function checkPostAuth(username) {
//     const hasAuth = await has3SpeakPostAuth(username);
//     if (hasAuth) {
//         console.log(`${username} has post authorization for 3Speak.`);
//     } else {
//         console.log(`${username} has NOT granted post authorization to 3Speak.`);
//     }
// }

  async function logMe() {
    if(!username){
      toast.error("Username is required to proceed.")
      return
    }
    try {
      let response = await client.get(
        `${studioEndPoint}/mobile/login?username=${username}`,
        {
          withCredentials: false,
          headers: {
            "Content-Type": "application/json",
          },
        }
      ); 
      console.log(`Response: ${JSON.stringify(response)}`);
      const memo = response.data.memo;
      console.log(`Memo - ${response.data.memo}`);
      const keychain = window.hive_keychain;
      keychain.requestVerifyKey(
        username,
        memo,
        "Posting",
        (response) => {
          if (response.success === true) {
            const decodedMessage = response.result.replace("#", "");
            console.log(`Decrypted ${decodedMessage}\n\n`);
            setAccessToken(decodedMessage);
            window.localStorage.setItem(LOCAL_STORAGE_ACCESS_TOKEN_KEY, decodedMessage);
              window.localStorage.setItem(LOCAL_STORAGE_USER_ID_KEY, username);
              initializeAuth()
              // setActiveUser()
              navigate("/");
              // checkPostAuth("some-hive-user");

          }
        }
      );

    } catch (err) {
      console.log(err);
      throw err;
    }
  }

  const handleSwitchAccount = (user) => {
    switchAccount(user);
    navigate("/");
  };

  const removeAccount = (user) => {
    clearAccount(user);
    const refreshed = JSON.parse(localStorage.getItem("accountsList")) || [];
    setAccountList(refreshed);
  };

  
  return (
    <div className="login-container">
      <div className="container-wrapper">
        <div className="main-login-keywrapper">
          <img src={logo} alt="3Speak Logo" />
          <span>Login with your username</span>

          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase())}
          />

          <div className="wrap keychain-down" onClick={logMe}>
            <img src={keychainImg} alt="keychain" />
            <span>Login with Keychain</span>
          </div>

          <div className="wrap-signup keychain-space">
            <span>Don't have an account?</span>
            <span className="last">Sign up now!</span>
          </div>

          {accountList.length > 0 && (
            <div className="switch-acct-wrapper">
              <h3>Login As</h3>
              <div className="list-acct-wrap">
                {accountList.map((list, idx) => (
                  <div key={idx} className='wrap' onClick={() => handleSwitchAccount(list.username)}>
                    <img src={`https://images.hive.blog/u/${list.username}/avatar`} alt={list.username} />
                    <span>{list.username}</span>
                    <LuLogOut size={12} onClick={(e) => { e.stopPropagation(); removeAccount(list.username); }} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default KeyChainLogin;
