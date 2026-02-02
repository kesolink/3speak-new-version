/**
 * Hive Blockchain API Service for Shorts
 * 
 * Uses axios for API calls
 */

import axios from "axios";

/* -----------------------------
   Hive RPC setup
------------------------------ */

const HIVE_API_URL = "https://api.hive.blog";
const SHORTS_API = "https://tags.3speak.tv/shorts";

/* -----------------------------
   Hive RPC helper
------------------------------ */

async function hiveRpc(method, params) {
  try {
    const response = await axios.post(HIVE_API_URL, {
      jsonrpc: "2.0",
      method,
      params,
      id: 1
    });

    if (response.data.error) {
      throw new Error(response.data.error.message);
    }

    return response.data.result;
  } catch (error) {
    console.error(`Hive RPC error (${method}):`, error);
    throw error;
  }
}

/* -----------------------------
   Shorts list
------------------------------ */

export async function fetchShortsList(page = 1, limit = 20, app = "snapie") {
  const url = `${SHORTS_API}?page=${page}&limit=${limit}&app=${app}`;
  const response = await axios.get(url);
  console.log('Fetching shorts list data:', response.data);
  return response.data;
}

/* -----------------------------
   Hive data fetchers
------------------------------ */

export async function getPostDetails(author, permlink) {
  return await hiveRpc("bridge.get_post", { author, permlink });
}

export async function getComments(author, permlink) {
  return await hiveRpc("bridge.get_discussion", { author, permlink });
}

export async function getAccounts(accounts) {
  return await hiveRpc("condenser_api.get_accounts", [accounts]);
}

/* -----------------------------
   Utils
------------------------------ */

/**
 * Parse embed_url to extract author and permlink
 * embed_url format: "@author/permlink" (e.g., "@ismeris/20260129t125012354z")
 */
export function parseEmbedUrl(embedUrl) {
  if (!embedUrl) return { author: null, permlink: null };

  const cleaned = embedUrl.startsWith('@') ? embedUrl.slice(1) : embedUrl;
  const parts = cleaned.split('/');

  if (parts.length >= 2) {
    return {
      author: parts[0],
      permlink: parts[1]
    };
  }

  return { author: null, permlink: null };
}

export function parseUserAvatar(account) {
  if (!account) {
    return "https://images.hive.blog/u/null/avatar";
  }

  try {
    const meta =
      typeof account.posting_json_metadata === "string"
        ? JSON.parse(account.posting_json_metadata)
        : account.posting_json_metadata;

    if (meta?.profile?.profile_image) {
      return meta.profile.profile_image;
    }

    const jsonMeta =
      typeof account.json_metadata === "string"
        ? JSON.parse(account.json_metadata)
        : account.json_metadata;

    if (jsonMeta?.profile?.profile_image) {
      return jsonMeta.profile.profile_image;
    }
  } catch (_) { }

  return `https://images.hive.blog/u/${account.name}/avatar`;
}

export function formatNumber(num) {
  if (!num) return "0";
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + "M";
  if (num >= 1_000) return (num / 1_000).toFixed(1) + "K";
  return num.toString();
}

export function timeAgo(dateString) {
  if (!dateString) return "Just now";

  const seconds = Math.floor(
    (Date.now() - new Date(dateString + "Z")) / 1000
  );

  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  if (seconds < 2592000) return `${Math.floor(seconds / 604800)}w ago`;
  if (seconds < 31536000) return `${Math.floor(seconds / 2592000)}mo ago`;
  return `${Math.floor(seconds / 31536000)}y ago`;
}

/* -----------------------------
   Short aggregation
------------------------------ */

export async function fetchCompleteShortData(shortItem) {
  const {
    owner,
    permlink: playerPermlink,
    thumbnail_url,
    views,
    createdAt,
    embed_url,
    embed_title
  } = shortItem;

  const { author: embedAuthor, permlink: hivePermlink } = parseEmbedUrl(embed_url);
  const author = embedAuthor || owner;

  const base = {
    id: `${author}-${playerPermlink}`,
    author,
    permlink: playerPermlink,
    hivePermlink: hivePermlink,
    embedUrl: embed_url,
    thumbnailUrl: thumbnail_url,
    views: views || 0,
    createdAt,
    timeAgo: timeAgo(createdAt),
    title: embed_title || "",
    caption: embed_title || "",
    user: {
      username: `@${author}`,
      avatar: `https://images.hive.blog/u/${author}/avatar`,
      isSubscribed: false
    },
    stats: {
      likes: 0,
      dislikes: 0,
      comments: 0,
      shares: 0,
      remixes: 0,
      payout: "0.00"
    },
    comments: [],
    commentsLoaded: false,
    isLiked: false,
    isDisliked: false
  };

  try {
    if (hivePermlink) {
      const post = await getPostDetails(author, hivePermlink);
      console.log('Fetching post details data:', post);

      if (post) {
        base.title = post.title || base.title;
        base.caption = post.title || base.caption;
        base.stats.comments = post.children || 0;
        base.stats.likes = post.stats?.total_votes || post.active_votes?.length || 0;
        base.stats.payout = post.payout || post.pending_payout_value || "0.00";

        if (post.author_reputation) {
          base.user.reputation = post.author_reputation;
        }
      }
    }
  } catch (err) {
    console.warn(`Failed to enrich short ${author}/${hivePermlink}:`, err.message);
  }

  return base;
}

/* -----------------------------
   Fetch comments for a post
------------------------------ */

export async function fetchPostComments(author, hivePermlink) {
  try {
    // Use condenser_api.get_content_replies like the CommentSection component
    const replies = await hiveRpc("condenser_api.get_content_replies", [author, hivePermlink]);

    if (!replies || replies.length === 0) return [];

    // Load nested comments recursively
    const commentsWithChildren = await loadNestedComments(replies);

    return commentsWithChildren;
  } catch (err) {
    console.error('Error fetching comments:', err);
    return [];
  }
}

// Recursively load nested comments
async function loadNestedComments(comments, loggedInUser = null) {
  const result = await Promise.all(
    comments.map(async (comment) => {
      // Fetch child comments
      let children = [];
      try {
        const childReplies = await hiveRpc("condenser_api.get_content_replies", [comment.author, comment.permlink]);
        if (childReplies && childReplies.length > 0) {
          children = await loadNestedComments(childReplies, loggedInUser);
        }
      } catch (err) {
        console.warn(`Failed to fetch children for ${comment.author}/${comment.permlink}`);
      }

      // Check if user has voted
      const has_voted = loggedInUser
        ? comment.active_votes?.some(v => v.voter === loggedInUser) ?? false
        : false;

      return {
        id: `${comment.author}-${comment.permlink}`,
        author: comment.author,
        permlink: comment.permlink,
        body: comment.body,
        createdAt: comment.created,
        timeAgo: timeAgo(comment.created),
        netVotes: comment.net_votes || 0,
        activeVotes: comment.active_votes || [],
        children: children,
        childrenCount: children.length,
        has_voted,
        stats: {
          num_likes: comment.active_votes?.filter((v) => v.percent > 0).length || 0,
          num_dislikes: comment.active_votes?.filter((v) => v.percent < 0).length || 0,
          total_hive_reward: parseFloat(comment.pending_payout_value) || 0
        },
        user: {
          username: `@${comment.author}`,
          avatar: `https://images.hive.blog/u/${comment.author}/avatar`
        }
      };
    })
  );

  return result;
}

/* -----------------------------
   Bulk shorts fetch
------------------------------ */

export async function fetchShortsWithDetails(page = 1, limit = 10) {
  const shortsList = await fetchShortsList(page, limit);

  if (!shortsList?.shorts) {
    throw new Error("Failed to fetch shorts list");
  }

  const shorts = await Promise.all(
    shortsList.shorts.map((s) =>
      fetchCompleteShortData(s).catch((err) => {
        console.warn(`Error fetching short data for ${s.embed_url}:`, err);

        const { author, permlink: hivePermlink } = parseEmbedUrl(s.embed_url);
        const finalAuthor = author || s.owner;

        return {
          id: `${finalAuthor}-${s.permlink}`,
          author: finalAuthor,
          permlink: s.permlink,
          hivePermlink: hivePermlink,
          embedUrl: s.embed_url,
          thumbnailUrl: s.thumbnail_url,
          views: s.views || 0,
          createdAt: s.createdAt,
          timeAgo: timeAgo(s.createdAt),
          title: s.embed_title || "",
          caption: s.embed_title || "",
          user: {
            username: `@${finalAuthor}`,
            avatar: `https://images.hive.blog/u/${finalAuthor}/avatar`,
            isSubscribed: false
          },
          stats: { likes: 0, dislikes: 0, comments: 0, shares: 0, remixes: 0, payout: "0.00" },
          comments: [],
          commentsLoaded: false,
          isLiked: false,
          isDisliked: false
        };
      })
    )
  );

  return {
    success: true,
    page: shortsList.page,
    total: shortsList.total,
    totalPages: shortsList.totalPages,
    shorts
  };
}

/* -----------------------------
   3Speak helpers
------------------------------ */

export function get3SpeakEmbedUrl(embedUrl, layout = "mobile", controls = true) {
  if (!embedUrl) return null;

  const cleanedPath = embedUrl.startsWith('@') ? embedUrl.slice(1) : embedUrl;
  const controlsParam = controls ? '' : '&controls=0';
  return `https://play.3speak.tv/embed?v=${cleanedPath}&mode=iframe&layout=${layout}${controlsParam}`;
}

export function build3SpeakEmbedUrl(author, permlink, layout = "mobile", controls = true) {
  if (!author || !permlink) return null;

  const controlsParam = controls ? '' : '&controls=0';
  return `https://play.3speak.tv/embed?v=${author}/${permlink}&mode=iframe&layout=${layout}${controlsParam}`;
}

/* -----------------------------
   Default export
------------------------------ */

export default {
  fetchShortsList,
  getPostDetails,
  getComments,
  getAccounts,
  parseEmbedUrl,
  parseUserAvatar,
  formatNumber,
  timeAgo,
  fetchCompleteShortData,
  fetchShortsWithDetails,
  fetchPostComments,
  get3SpeakEmbedUrl,
  build3SpeakEmbedUrl,
  HIVE_API_URL,
  SHORTS_API
};