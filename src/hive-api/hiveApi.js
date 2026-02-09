/**
 * Hive Blockchain API Service for Shorts
 *
 * Uses axios for API calls
 */

import axios from "axios";
import { HIVE_API_URL } from "../utils/config";

/* -----------------------------
   Hive RPC setup
------------------------------ */
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

export async function fetchShortsList(page = 1, limit = 20) {
  const url = `${SHORTS_API}?page=${page}&limit=${limit}`;
  const response = await axios.get(url);
  console.log('Fetching shorts list data:', response.data);
  return response.data;
}

/* -----------------------------
   Cached shorts list (avoids repeated pagination)
------------------------------ */
let _cachedShorts = null;
let _cachedShortsTime = 0;
let _cachePromise = null;
const SHORTS_CACHE_TTL = 60000; // 1 minute

async function getAllShortsCached() {
  if (_cachedShorts && Date.now() - _cachedShortsTime < SHORTS_CACHE_TTL) return _cachedShorts;
  // Deduplicate: if a fetch is already in progress, share the same promise
  if (_cachePromise) return _cachePromise;
  _cachePromise = (async () => {
    try {
      const all = [];
      let page = 1;
      const limit = 50;
      while (page <= 20) {
        const data = await fetchShortsList(page, limit);
        if (!data?.shorts) break;
        all.push(...data.shorts);
        if (page >= (data.totalPages || 1)) break;
        page++;
      }
      _cachedShorts = all;
      _cachedShortsTime = Date.now();
      return all;
    } finally {
      _cachePromise = null;
    }
  })();
  return _cachePromise;
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

  let cleaned = embedUrl;

  // Handle full URLs like https://3speak.tv/watch?v=author/permlink 
  // or https://play.3speak.tv/embed?v=author/permlink
  if (embedUrl.includes('?v=')) {
    cleaned = embedUrl.split('?v=')[1].split('&')[0];
  } else if (embedUrl.includes('3speak.tv/')) {
    // Handle formats like https://3speak.tv/author/permlink
    const urlParts = embedUrl.split('3speak.tv/')[1].split('/');
    if (urlParts.length >= 2) {
      cleaned = `${urlParts[0]}/${urlParts[1]}`;
    }
  }

  // Remove leading @ if present
  if (cleaned.startsWith('@')) {
    cleaned = cleaned.slice(1);
  }

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

export async function fetchCompleteShortData(shortItem, loggedInUser = null) {
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

        // Determine if the logged-in user has voted on the post
        if (loggedInUser) {
          try {
            const userVoted = post.active_votes?.some(v => v.voter === loggedInUser) ?? false;
            base.isLiked = userVoted;
            // Check for negative percent to mark as disliked
            const userVote = post.active_votes?.find(v => v.voter === loggedInUser);
            base.isDisliked = userVote ? (userVote.percent < 0) : false;
          } catch (_) {
            base.isLiked = false;
            base.isDisliked = false;
          }
        }

        if (post.author_reputation) {
          base.user.reputation = post.author_reputation;
        }

        // Check if this short is a reaction with a parentTimestamp
        const jm = typeof post.json_metadata === 'string'
          ? JSON.parse(post.json_metadata || '{}')
          : (post.json_metadata || {});

        if (jm.parentTimestamp != null && post.parent_author) {
          base.parentTimestamp = jm.parentTimestamp;
          try {
            const immediateParent = await getPostDetails(post.parent_author, post.parent_permlink);
            if (immediateParent) {
              let rootPost = immediateParent;
              let intermediateChain = [];

              // If the immediate parent is a comment (not the root video), capture it
              if (immediateParent.parent_author) {
                const bodyExcerpt = (immediateParent.body || '').split('\n').filter(l => l.trim()).slice(0, 2).join('\n');
                if (bodyExcerpt) {
                  base.parentComment = {
                    author: immediateParent.author,
                    body: bodyExcerpt,
                  };
                }

                // Check if the immediate parent is itself a short (video reaction)
                const parentJm = typeof immediateParent.json_metadata === 'string'
                  ? JSON.parse(immediateParent.json_metadata || '{}')
                  : (immediateParent.json_metadata || {});
                if (parentJm.video?.url || parentJm.video?.platform === '3speak') {
                  try {
                    const parentShortEntry = await findShortByEmbedUrl(immediateParent.author, immediateParent.permlink);
                    if (parentShortEntry) {
                      base.parentShort = {
                        author: parentShortEntry.owner,
                        permlink: parentShortEntry.permlink,
                      };
                    }
                  } catch (e) {
                    console.warn('Failed to look up parent short:', e.message);
                  }
                }

                // Walk up the chain to find the root video, collecting the chain
                const parentDur = parentJm.video?.info?.duration || parentJm.video?.duration || 0;
                const parentBody = (immediateParent.body || '').split('\n').filter(l => l.trim() && !l.startsWith('<sup>') && !l.startsWith('http')).slice(0, 3).join('\n');

                const reactionChain = [{
                  author: immediateParent.author,
                  permlink: immediateParent.permlink,
                  title: immediateParent.title || '',
                  body: parentBody,
                  duration: parentDur,
                  type: parentJm.video ? 'video' : 'comment',
                  thumbnail: parentJm?.image?.[0] || null,
                }];
                let current = immediateParent;
                let depth = 0;
                while (current.parent_author && depth < 10) {
                  current = await getPostDetails(current.parent_author, current.parent_permlink);
                  if (!current) break;
                  if (current.parent_author) {
                    const cJm = typeof current.json_metadata === 'string'
                      ? JSON.parse(current.json_metadata || '{}') : (current.json_metadata || {});
                    const dur = cJm.video?.info?.duration || cJm.video?.duration || 0;
                    const cBody = (current.body || '').split('\n').filter(l => l.trim() && !l.startsWith('<sup>') && !l.startsWith('http')).slice(0, 3).join('\n');

                    reactionChain.unshift({
                      author: current.author,
                      permlink: current.permlink,
                      title: current.title || '',
                      body: cBody,
                      duration: dur,
                      type: cJm.video ? 'video' : 'comment',
                      thumbnail: cJm?.image?.[0] || null,
                    });
                  }
                  depth++;
                }
                if (current) rootPost = current;
                // Store intermediates for later — root will be prepended below
                intermediateChain = reactionChain;
              }

              // Store the root video
              if (rootPost && !rootPost.parent_author) {
                const rootJm = typeof rootPost.json_metadata === 'string'
                  ? JSON.parse(rootPost.json_metadata || '{}')
                  : (rootPost.json_metadata || {});
                base.parentVideo = {
                  author: rootPost.author,
                  permlink: rootPost.permlink,
                  title: rootPost.title,
                  created: rootPost.created,
                  duration: rootJm?.video?.info?.duration || rootJm?.video?.duration || 0,
                  thumbnail: rootJm?.image?.[0] || null,
                  stats: {
                    total_hive_reward: rootPost.payout || rootPost.pending_payout_value || 0,
                    num_votes: rootPost.stats?.total_votes || rootPost.active_votes?.length || 0,
                  }
                };

                // Build complete chain: [root, ...intermediates]
                const rootDur = rootJm?.video?.info?.duration || rootJm?.video?.duration || 0;
                const rootBody = (rootPost.body || '').split('\n').filter(l => l.trim() && !l.startsWith('<sup>') && !l.startsWith('http')).slice(0, 3).join('\n');
                const rootEntry = {
                  author: rootPost.author,
                  permlink: rootPost.permlink,
                  title: rootPost.title || '',
                  body: rootBody,
                  duration: rootDur,
                  type: 'video',
                  thumbnail: rootJm?.image?.[0] || null,
                  isRoot: true,
                };
                base.reactionChain = [rootEntry, ...intermediateChain];

                // Resolve internal player permlinks for video-type chain steps
                try {
                  const allShorts = await getAllShortsCached();
                  for (const step of base.reactionChain) {
                    if (step.type === 'video' && !step.isRoot) {
                      const target = `@${step.author}/${step.permlink}`;
                      const found = allShorts.find(s => s.embed_url === target);
                      if (found) {
                        step.shortAuthor = found.owner;
                        step.shortPermlink = found.permlink;
                      }
                    }
                  }
                } catch (e) {
                  console.warn('Failed to resolve chain step permlinks:', e.message);
                }
              }
            }
          } catch (err) {
            console.warn('Failed to fetch parent video:', err.message);
          }
        }

        // Load direct child reactions (replies to this short that are themselves shorts)
        try {
          const replies = await hiveRpc("condenser_api.get_content_replies", [post.author, post.permlink]);
          if (replies?.length > 0) {
            const allShorts = await getAllShortsCached();
            const childReactions = [];
            for (const reply of replies) {
              const rJm = typeof reply.json_metadata === 'string'
                ? JSON.parse(reply.json_metadata || '{}') : (reply.json_metadata || {});
              if (rJm.video?.url || rJm.video?.platform === '3speak') {
                const target = `@${reply.author}/${reply.permlink}`;
                const found = allShorts.find(s => s.embed_url === target);
                if (found) {
                  childReactions.push({
                    author: reply.author,
                    permlink: reply.permlink,
                    shortAuthor: found.owner,
                    shortPermlink: found.permlink,
                    title: reply.title || '',
                    type: 'video',
                    thumbnail: rJm?.image?.[0] || null,
                    duration: rJm.video?.info?.duration || rJm.video?.duration || 0,
                  });
                }
              }
            }
            if (childReactions.length > 0) base.childReactions = childReactions;
          }
        } catch (err) {
          console.warn('Failed to load child reactions:', err.message);
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

export async function fetchPostComments(author, hivePermlink, loggedInUser = null) {
  try {
    // Use condenser_api.get_content_replies like the CommentSection component
    const replies = await hiveRpc("condenser_api.get_content_replies", [author, hivePermlink]);

    if (!replies || replies.length === 0) return [];

    // Load nested comments recursively
    const commentsWithChildren = await loadNestedComments(replies, loggedInUser);

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
   Find a short by its Hive embed_url (e.g. "@author/permlink")
------------------------------ */

export async function findShortByEmbedUrl(author, hivePermlink) {
  const target = `@${author}/${hivePermlink}`;
  let page = 1;
  const limit = 50;
  const maxPages = 10;

  while (page <= maxPages) {
    const data = await fetchShortsList(page, limit);
    if (!data?.shorts) break;

    const found = data.shorts.find(s => s.embed_url === target);
    if (found) return found;

    if (page >= (data.totalPages || 1)) break;
    page++;
  }

  return null;
}

/* -----------------------------
   Find a short by player permlink
------------------------------ */

export async function findShortByPermlink(permlink) {
  let page = 1;
  const limit = 50;
  const maxPages = 10;

  while (page <= maxPages) {
    const data = await fetchShortsList(page, limit);
    if (!data?.shorts) break;

    const found = data.shorts.find(s => s.permlink === permlink);
    if (found) return found;

    if (page >= (data.totalPages || 1)) break;
    page++;
  }

  return null;
}

/* -----------------------------
   Bulk shorts fetch
------------------------------ */

export async function fetchShortsWithDetails(page = 1, limit = 10, loggedInUser = null) {
  const shortsList = await fetchShortsList(page, limit);

  if (!shortsList?.shorts) {
    throw new Error("Failed to fetch shorts list");
  }

  const shorts = await Promise.all(
    shortsList.shorts.map((s) =>
      fetchCompleteShortData(s, loggedInUser).catch((err) => {
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
  findShortByPermlink,
  findShortByEmbedUrl,
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