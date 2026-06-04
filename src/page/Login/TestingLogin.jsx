import { useState, useEffect } from 'react';
import { getHiveUrl } from '../../utils/hiveNode';
import axios from 'axios';
import { AIOHA } from '@aioha/aioha';
import './TestingLogin.scss';
import { HIVE_API_URL } from '../../utils/config';

export default function TestingLogin({
  appName = 'My Hive App',
  logoUrl = '',
  onSuccess,
  onError
}) {
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [challenge, setChallenge] = useState('');
  const [aioha] = useState(new AIOHA());

  useEffect(() => {
    generateChallenge();
  }, []);

  const generateChallenge = async () => {
    try {
      setIsLoading(true);
      // In production, you might get this from your backend
      setChallenge(generateRandomString(64));
    } catch (err) {
      setError('Failed to generate challenge');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const generateRandomString = (length) => {
    const chars = '0123456789abcdef';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const handleSignIn = async () => {
    if (!username) {
      setError('Please enter your Hive username');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const proof = Date.now().toString();
      const publicKey = await getPublicKey(username);

      if (!publicKey) {
        throw new Error('Could not retrieve public key for user');
      }

      const response = await sendAuthRequest({
        challenge,
        proof,
        publicKey,
        username,
      });

      const successData = {
        username,
        publicKey,
        token: response.token,
      };

      if (onSuccess) {
        onSuccess(successData);
      }
    } catch (err) {
      const errorMsg = err.message || 'Sign in failed';
      setError(errorMsg);
      if (onError) {
        onError(errorMsg);
      }
      console.error('Sign in error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const getPublicKey = async (username) => {
    try {
      const response = await axios.post(getHiveUrl(), {
        jsonrpc: '2.0',
        method: 'condenser_api.get_accounts',
        params: [[username]],
        id: 1,
      });

      if (response.data.result?.[0]?.posting?.key_auths?.[0]?.[0]) {
        return response.data.result[0].posting.key_auths[0][0];
      }
      throw new Error('Public key not found for user');
    } catch (err) {
      console.error('Failed to get public key:', err);
      throw new Error('Failed to retrieve user public key');
    }
  };

  const sendAuthRequest = async (authData) => {
    try {
      const response = await axios.post(
        'https://studio.3speak.tv/mobile/login',
        authData,
        {
          headers: {
            'Accept': '*/*',
            'Content-Type': 'application/json',
            'Origin': window.location.origin,
          },
        }
      );

      if (!response.data.success) {
        throw new Error(response.data.message || 'Authentication failed');
      }

      return response.data;
    } catch (err) {
      if (axios.isAxiosError(err)) {
        throw new Error(err.response?.data?.message || err.message);
      }
      throw err;
    }
  };

  return (
    <div className="hive-auth-container">
      {logoUrl && <img src={logoUrl} alt={appName} className="hive-auth-logo" />}
      <h2 className="hive-auth-title">Sign in to {appName}</h2>
      
      {error && <div className="hive-auth-error">{error}</div>}

      <div className="hive-auth-input-group">
        <label htmlFor="hive-username">Hive Username</label>
        <input
          type="text"
          id="hive-username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Enter your Hive username"
          disabled={isLoading}
          className="hive-auth-input"
        />
      </div>

      <button
        onClick={handleSignIn}
        disabled={isLoading || !username}
        className="hive-auth-button"
      >
        {isLoading ? (
          <>
            <span className="hive-auth-spinner"></span>
            Signing in...
          </>
        ) : (
          'Sign in with Hive'
        )}
      </button>

      <div className="hive-auth-footer">
        <p>You'll be redirected to HiveAuth for authentication</p>
      </div>
    </div>
  );
}