import { useState } from 'react';
import './Login.scss';
import logo from '../../assets/image/3S_logo.svg';
import keychain from '../../assets/image/keychain.png';
import { Link } from 'react-router-dom';
import axios from 'axios';
// import dhive from "@hiveio/dhive";
import hive from '@hiveio/hive-js';
// import hive from '@hiveio/hive-js/dist/hivejs.min.js';

// import { Buffer } from 'buffer'

// import { AuthActions } from '../../hooks/auth/AuthActions';
// import { Providers } from "@aioha/aioha";




function Login() {
  const [username, setUsername] = useState('');
  const [postingKey, setPostingKey] = useState('');
  const studioEndPoint = "https://studio.3speak.tv";
  const client = axios.create({});

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
        access_token = access_token.replace("#", "");
        console.log(`Decrypted ${access_token}\n\n`);
      //   setAccessToken(access_token);
      } catch (err) {
        console.log(err);
        throw err;
      }
    }

    // 5JxrS6DFUWGRu87XyNhUETGuEJdnG1weKcLE3SPFWBst4fnxyPN

  // const handleLogin = (e) => {
  //   e.preventDefault();
  //   if (username && postingKey) {
  //     AuthActions.login(Providers.Hive, username, postingKey);  // Call login with username and posting key
  //   } else {
  //     alert('Please enter both username and posting key');
  //   }
  // };

 

  return (
    <div className="login-container">
      <div className="container-wrapper">
        <div className="main-login-keywrapper">
          <img src={logo} alt="" />
          <span>Login with your username and private key</span>

          <input
            type="text"
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
        </div>
      </div>
    </div>
  );
}

export default Login;
