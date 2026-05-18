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

// Butter Auth sessions only carry posting authority. When an active-key op is
// attempted under a Butter Auth login we don't fail — we hand the operations
// to a registered modal handler that lets the user complete the signature
// themselves (Hive Keychain wallet, or a pasted private active key). The
// handler resolves with { success, result } or rejects if the user cancels.
let activeAuthHandler = null;
export const setActiveAuthHandler = (fn) => { activeAuthHandler = fn; };

const requestButrauthActiveSign = async (operations) => {
  if (typeof activeAuthHandler !== 'function') {
    throw new Error('Active key operations need a Hive wallet. Please reload and try again.')
  }
  // Handler shows the modal and returns the broadcast result, or throws on cancel.
  return activeAuthHandler(operations)
}

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
  if (isManteAuthLogin()) {
    const voter = localStorage.getItem('user_id')
    return broadcastViaManteAuth([['vote', { voter, author, permlink, weight }]])
  }
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
  // Transfers are an active-key op — a Butter Auth session can't sign them.
  // Route through the same active-auth modal handler as broadcastWithAioha.
  if (isManteAuthLogin()) {
    const from = localStorage.getItem('user_id')
    const formatted = `${Number(amount).toFixed(3)} ${currency}`
    return requestButrauthActiveSign([
      ['transfer', { from, to, amount: formatted, memo: memo || '' }]
    ])
  }
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
  if (isManteAuthLogin()) {
    const follower = localStorage.getItem('user_id')
    const json = JSON.stringify(['follow', {
      follower,
      following: target,
      what: follow ? ['blog'] : []
    }])
    return broadcastViaManteAuth([['custom_json', {
      required_auths: [],
      required_posting_auths: [follower],
      id: 'follow',
      json
    }]])
  }
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
  if (isManteAuthLogin() && keyType === KeyTypes.Posting) {
    const user = localStorage.getItem('user_id')
    return broadcastViaManteAuth([['custom_json', {
      required_auths: [],
      required_posting_auths: [user],
      id,
      json
    }]])
  }
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
  if (isManteAuthLogin()) {
    const author = localStorage.getItem('user_id')
    const ops = [['comment', {
      parent_author: parentAuthor,
      parent_permlink: parentPermlink,
      author,
      permlink,
      title,
      body,
      json_metadata: JSON.stringify(jsonMetadata)
    }]]
    if (options) {
      ops.push(['comment_options', { author, permlink, ...options }])
    }
    return broadcastViaManteAuth(ops)
  }
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

// Generic broadcast for raw operations
// ManteAuth only supports posting-level ops — active key ops (transfers, etc.) will fail
export const broadcastWithAioha = async (operations, keyType = KeyTypes.Active) => {
  if (isManteAuthLogin() && keyType === KeyTypes.Posting) {
    return broadcastViaManteAuth(operations)
  }
  if (isManteAuthLogin() && keyType === KeyTypes.Active) {
    // Posting-only Butter Auth session — let the user sign this active op
    // with their own wallet / active key via the modal handler.
    return requestButrauthActiveSign(operations)
  }
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

// ManteAuth proxy broadcast via 3speak backend service
// Auth happens via httpOnly cookie set during /api/manteauth/exchange — no token in JS.
const THREESPEAK_API = import.meta.env.VITE_THREESPEAK_API || '/api'

// Honors the VITE_ENABLE_BUTRAUTH=false flag — when disabled, treat ManteAuth
// state as absent so no manteauth-specific code paths run.
export const isManteAuthLogin = () => {
  if (import.meta.env.VITE_ENABLE_BUTRAUTH === 'false') return false;
  return localStorage.getItem('manteauth_login') === 'true'
}

export const broadcastViaManteAuth = async (operations) => {
  const res = await fetch(`${THREESPEAK_API}/broadcast`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ operations })
  })
  const data = await res.json()
  if (!res.ok || !data.success) {
    throw new Error(data.error || data.message || 'Broadcast failed')
  }
  return { success: true, result: data.result }
}

// Check if user is logged in (aioha or ManteAuth)
export const isLoggedIn = () => {
  return aioha.isLoggedIn() || isManteAuthLogin();
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
