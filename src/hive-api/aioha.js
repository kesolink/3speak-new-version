import { Aioha, Asset, KeyTypes, Providers } from '@aioha/aioha'
import { IS_VSC_TESTNET, VSC_NET_ID } from '../utils/vscContract.js'
import { ENABLE_METAMASK_SNAP } from '../utils/config.js'

const HIVE_API = IS_VSC_TESTNET ? 'https://testnet.techcoderx.com' : 'https://api.hive.blog'
const CHAIN_ID = IS_VSC_TESTNET
  ? '18dcf0a285365fc58b71f18b3d3fec954aa0c141c44e4e5cb4cf777b9eab274e'
  : 'beeab0de00000000000000000000000000000000000000000000000000000000'

// Manual Aioha setup so we can conditionally register MetaMask Snap
const aioha = new Aioha(HIVE_API)
aioha.registerKeychain()
aioha.registerLedger()
aioha.registerPeakVault()
if (ENABLE_METAMASK_SNAP) {
  aioha.registerMetaMaskSnap()
}
aioha.registerHiveAuth({ name: '3Speak', description: '3Speak - Decentralized Video Platform' })
aioha.registerHiveSigner({
  app: import.meta.env.VITE_HIVESIGNER_APP,
  callbackURL: window.location.origin + '/hivesigner.html',
  scope: ['login', 'vote', 'comment', 'follow', 'transfer'],
})
aioha.setApi(HIVE_API)
aioha.loadAuth()
aioha.vscSetNetId(VSC_NET_ID)
if (typeof aioha.setChainId === 'function') {
  aioha.setChainId(CHAIN_ID)
}

// Store for HiveAuth waiting callbacks
let hiveAuthCallbacks = {
  onWaiting: null,
  onComplete: null
};

// Set HiveAuth waiting callbacks (called from React component)
export const setHiveAuthCallbacks = (onWaiting, onComplete) => {
  hiveAuthCallbacks.onWaiting = onWaiting;
  hiveAuthCallbacks.onComplete = onComplete;
};

// Check if current provider is HiveAuth
export const isHiveAuthProvider = () => {
  return aioha.getCurrentProvider() === Providers.HiveAuth;
};

// Wrapper to handle HiveAuth waiting state
const withHiveAuthWaiting = async (operation, message = 'Waiting for approval...') => {
  const isHiveAuth = isHiveAuthProvider();

  if (isHiveAuth && hiveAuthCallbacks.onWaiting) {
    hiveAuthCallbacks.onWaiting(message);
  }

  try {
    const result = await operation();
    return result;
  } finally {
    if (isHiveAuth && hiveAuthCallbacks.onComplete) {
      hiveAuthCallbacks.onComplete();
    }
  }
};

// Helper function to vote on content
export const voteWithAioha = async (author, permlink, weight = 10000) => {
  return withHiveAuthWaiting(async () => {
    try {
      const result = await aioha.vote(author, permlink, weight);
      if (result.success) {
        return { success: true, result: result.result };
      } else {
        throw new Error(result.error || 'Vote failed');
      }
    } catch (error) {
      console.error('Vote error:', error);
      throw error;
    }
  }, 'Approve vote on HiveAuth...');
};

// Helper function to transfer HIVE or HBD
export const transferWithAioha = async (to, amount, currency, memo = '') => {
  return withHiveAuthWaiting(async () => {
    try {
      const result = await aioha.transfer(to, amount, currency, memo);
      if (result.success) {
        return { success: true, result: result.result };
      } else {
        throw new Error(result.error || 'Transfer failed');
      }
    } catch (error) {
      console.error('Transfer error:', error);
      throw error;
    }
  }, 'Approve transfer on HiveAuth...');
};

// Helper function to follow/unfollow a user
export const followWithAioha = async (target, follow = true) => {
  return withHiveAuthWaiting(async () => {
    try {
      let result;
      if (follow) {
        result = await aioha.follow(target);
      } else {
        // Unfollow via custom_json (aioha has no unfollow method)
        const json = JSON.stringify(['follow', {
          follower: aioha.getCurrentUser(),
          following: target,
          what: []
        }]);
        result = await aioha.customJSON(KeyTypes.Posting, 'follow', json, 'Unfollow @' + target);
      }
      if (result.success) {
        return { success: true, result: result.result };
      } else {
        throw new Error(result.error || 'Follow/Unfollow failed');
      }
    } catch (error) {
      console.error('Follow error:', error);
      throw error;
    }
  }, follow ? 'Approve follow on HiveAuth...' : 'Approve unfollow on HiveAuth...');
};

// Helper function for custom_json operations
export const customJsonWithAioha = async (keyType, id, json, displayTitle = '') => {
  return withHiveAuthWaiting(async () => {
    try {
      const result = await aioha.customJSON(keyType, id, json, displayTitle);
      if (result.success) {
        return { success: true, result: result.result };
      } else {
        throw new Error(result.error || 'Custom JSON failed');
      }
    } catch (error) {
      console.error('Custom JSON error:', error);
      throw error;
    }
  }, 'Approve action on HiveAuth...');
};

// Helper function to post a comment
export const commentWithAioha = async (parentAuthor, parentPermlink, permlink, title, body, jsonMetadata = {}, options = null) => {
  return withHiveAuthWaiting(async () => {
    try {
      const result = await aioha.comment(parentAuthor, parentPermlink, permlink, title, body, JSON.stringify(jsonMetadata), options);
      if (result.success) {
        return { success: true, result: result.result };
      } else {
        throw new Error(result.error || 'Comment failed');
      }
    } catch (error) {
      console.error('Comment error:', error);
      throw error;
    }
  }, 'Approve comment on HiveAuth...');
};

// Generic broadcast for raw operations (e.g., account_create, custom operations)
export const broadcastWithAioha = async (operations, keyType = KeyTypes.Active) => {
  return withHiveAuthWaiting(async () => {
    try {
      const result = await aioha.signAndBroadcastTx(operations, keyType);
      if (result.success) {
        return { success: true, result: result.result };
      } else {
        throw new Error(result.error || 'Broadcast failed');
      }
    } catch (error) {
      console.error('Broadcast error:', error);
      throw error;
    }
  }, 'Approve transaction on HiveAuth...');
};

// Check if user is logged in
export const isLoggedIn = () => {
  return aioha.isLoggedIn();
};

// Get current user
export const getCurrentUser = () => {
  return aioha.getCurrentUser();
};

// Get current provider
export const getCurrentProvider = () => {
  return aioha.getCurrentProvider();
};

export { Asset, KeyTypes };
export default aioha;
