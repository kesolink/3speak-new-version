import { useEffect, useState, useRef } from 'react';
import './Login.scss';
import logo from '../../assets/image/3S_logo.svg';
import keychain from '../../assets/image/keychain.png';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
// import dhive from "@hiveio/dhive";
import hive from '@hiveio/hive-js';
import { useAppStore } from '../../lib/store';
import { LOCAL_STORAGE_ACCESS_TOKEN_KEY, LOCAL_STORAGE_USER_ID_KEY } from '../../hooks/localStorageKeys';
import { LuLogOut } from 'react-icons/lu';
import { useTVMode } from '../../context/TVModeContext';
// import hive from '@hiveio/hive-js/dist/hivejs.min.js';

// import { Buffer } from 'buffer'

// import { AuthActions } from '../../hooks/auth/AuthActions';
// import { Providers } from "@aioha/aioha";

// pill== 5JxrS6DFUWGRu87XyNhUETGuEJdnG1weKcLE3SPFWBst4fnxyPN




function Login() {
  const { initializeAuth, setActiveUser, switchAccount, clearAccount } = useAppStore();
  const { isTVMode, notifyNavigationState } = useTVMode();
  const [username, setUsername] = useState('');
  const [postingKey, setPostingKey] = useState('');
  const studioEndPoint = "https://studio.3speak.tv";
  const client = axios.create({});
  const navigate = useNavigate();
  const [accountList, setAccountList] = useState([]);
  const usernameInputRef = useRef(null);

    useEffect(()=>{
      const getAccountlist = JSON.parse(localStorage.getItem("accountsList")) || [];
      setAccountList(getAccountlist)
    },[])

  // Notify parent that we're NOT at root (back should navigate, not exit)
  useEffect(() => {
    if (isTVMode) {
      notifyNavigationState(false);
    }
  }, [isTVMode, notifyNavigationState]);

  // Auto-focus username input in TV mode
  useEffect(() => {
    if (isTVMode && usernameInputRef.current) {
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        usernameInputRef.current?.focus();
      }, 100);
    }
  }, [isTVMode]);

  // Also focus on mount for TV mode
  useEffect(() => {
    // Delay to let TV mode detection happen
    const timer = setTimeout(() => {
      if (usernameInputRef.current) {
        usernameInputRef.current.focus();
      }
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  async function logMe() {
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
       
        let access_token = hive.memo.decode(postingKey, memo);
        // let access_token = dhive?.memo.decode(postingKey, memo);
        console.log(access_token)
        const decodedMessage = access_token.replace("#", "");
        const existing = JSON.parse(localStorage.getItem("accountsList")) || [];
          
            // Avoid duplicates
            const filtered = existing.filter(acc => acc.username !== username);
          
            const updated = [...filtered, { username, access_token: decodedMessage }];
        // console.log(`Decrypted ${access_token}\n\n`);
        // window.localStorage.setItem(LOCAL_STORAGE_ACCESS_TOKEN_KEY, access_token);
                      window.localStorage.setItem(LOCAL_STORAGE_USER_ID_KEY, username);
                      localStorage.setItem("accountsList", JSON.stringify(updated));
                      // localStorage.setItem("activeAccount", username);
                      initializeAuth()
                      setActiveUser()
                      navigate("/");
      } catch (err) {
        console.log(err);
        throw err;
      }
    }

    // 

  // const handleLogin = (e) => {
  //   e.preventDefault();
  //   if (username && postingKey) {
  //     AuthActions.login(Providers.Hive, username, postingKey);  // Call login with username and posting key
  //   } else {
  //     alert('Please enter both username and posting key');
  //   }
  // };

  const handleSwitchAccount = (user)=>{
    switchAccount(user)
    navigate("/")

  }
  const removeAccount = (user)=> {
    clearAccount(user)
    const refreshed = JSON.parse(localStorage.getItem("accountsList")) || [];
  setAccountList(refreshed);
  }

 

  return (
    <div className="login-container">
      <div className="container-wrapper">
        <div className="main-login-keywrapper">
          <img src={logo} alt="" />
          <span>Login with your username and private key</span>

          <input
            ref={usernameInputRef}
            type="text"
            inputMode="text"
            autoComplete="username"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <input
            type="text"
            placeholder="Posting key"
            value={postingKey}
            onChange={(e) => setPostingKey(e.target.value)}
          />

          <span className='private-text'>We don't store your private keys.</span>

          <button onClick={logMe} >Login</button>

          <div className="or-wrap">
            <div className="or-divider">
              <span>or</span>
            </div>
          </div>

          <Link to="/keychain" className="wrap">
            <img src={keychain} alt="" />
            <span>Login with Keychain</span>
          </Link>

          <div className="wrap-signup">
            <span>Don't have an account?</span><span className="last">Sign up now!</span>
          </div>
          {accountList.length > 0 &&<div className="switch-acct-wrapper">
            <h3>Login As</h3>        
              <div className="list-acct-wrap">
                      {accountList.map((list, idex)=>(
                        <div key={idex} className='wrap' onClick={()=>handleSwitchAccount(list.username)}>   
                        <img src={`https://images.hive.blog/u/${list.username}/avatar`} alt="" /> <span>{list.username}</span> 
                        <LuLogOut size={12}  onClick={(e) => {e.stopPropagation();  removeAccount(list.username);}} />
                        </div>
                      ))}
                    
                    </div>
                    </div>}
          </div>
      </div>
    </div>
  );
}

export default Login;
