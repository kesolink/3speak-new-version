import { initAioha, Asset, KeyTypes, Providers } from '@aioha/aioha'
import { getHiveUrl, ensureHealthyNode } from '../utils/hiveNode.js'

const aioha = initAioha({
  hiveauth: {
    name: '3Speak',
    description: '3Speak - Decentralized Video Platform'
  },
  hivesigner: {
    app: import.meta.env.VITE_HIVESIGNER_APP,
    callbackURL: window.location.origin + '/hivesigner.html',
    scope: ['login', 'vote', 'comment', 'follow', 'transfer'],
  }
})

// Start on the best static guess, then upgrade to the probed healthy node.
aioha.setApi(getHiveUrl())
ensureHealthyNode().then((u) => { try { aioha.setApi(u) } catch { /* ignore */ } })

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

// Extract a human-readable reason from aioha's `result.error` (which may be a
// string, an object with .message, or a nested Hive node error). Falls back to
// a default label when aioha returns success:false with nothing useful.
const extractAiohaError = (result, fallback) => {
  if (!result) return fallback;
  const e = result.error;
  if (typeof e === 'string' && e.trim()) return e;
  if (e && typeof e === 'object') {
    if (typeof e.message === 'string' && e.message.trim()) return e.message;
    try { return JSON.stringify(e); } catch { /* ignore */ }
  }
  if (typeof result.message === 'string' && result.message.trim()) return result.message;
  return `${fallback} (no error returned by aioha)`;
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
        console.error('Vote rejected, full aioha result:', result);
        throw new Error(extractAiohaError(result, 'Vote failed'));
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
        console.error('Transfer rejected, full aioha result:', result);
        throw new Error(extractAiohaError(result, 'Transfer failed'));
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
        console.error('Follow/Unfollow rejected, full aioha result:', result);
        throw new Error(extractAiohaError(result, 'Follow/Unfollow failed'));
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
        console.error('Custom JSON rejected, full aioha result:', result);
        throw new Error(extractAiohaError(result, 'Custom JSON failed'));
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
        console.error('Comment rejected, full aioha result:', result);
        throw new Error(extractAiohaError(result, 'Comment failed'));
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
        console.error('Broadcast rejected, full aioha result:', result);
        throw new Error(extractAiohaError(result, 'Broadcast failed'));
      }
    } catch (error) {
      console.error('Broadcast error:', error);
      throw error;
    }
  }, 'Approve transaction on HiveAuth...');
};

// Sign an arbitrary message with the given key (used for image-upload challenges).
export const signMessageWithAioha = async (message, keyType = KeyTypes.Posting, displayTitle = 'Approve image upload signature') => {
  return withHiveAuthWaiting(async () => {
    try {
      const result = await aioha.signMessage(message, keyType);
      if (result.success && result.result) {
        return { success: true, result: result.result };
      }
      console.error('Sign message rejected, full aioha result:', result);
      throw new Error(extractAiohaError(result, 'Sign message failed'));
    } catch (error) {
      console.error('Sign message error:', error);
      throw error;
    }
  }, displayTitle);
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
