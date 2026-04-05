import { useState, useEffect, useMemo } from 'react';
import { useParams, Navigate, Link } from 'react-router-dom';
import axios from 'axios';
import BlogContent from '../components/playVideo/BlogContent';
import CommentSection from '../components/playVideo/CommentSection';
import BarLoader from '../components/Loader/BarLoader';
import AuthorBadge from '../components/AuthorBadge/AuthorBadge';
import PayoutAmount from '../components/PayoutAmount/PayoutAmount';
import { HIVE_API_URL } from '../utils/config';
import { prefetch3SpeakDetection, get3SpeakStatus } from '../utils/threeSpeakDetection';
import { LuTimer } from 'react-icons/lu';
import './PostView.scss';

function formatRelativeTime(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString + (dateString.endsWith('Z') ? '' : 'Z'));
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  const m = Math.floor(diff / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}

function PostView() {
  const params = useParams();
  // Strip any leading "@" defensively — some old links may include it
  const author = (params.author || '').replace(/^@/, '');
  const permlink = params.permlink || '';
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [is3Speak, setIs3Speak] = useState(() => get3SpeakStatus(`${author}/${permlink}`));

  // Fetch the post via bridge.get_post
  useEffect(() => {
    if (!author || !permlink) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        // Try bridge.get_post first (richer response), fall back to
        // condenser_api.get_content which is more permissive and always
        // works for both posts and comments.
        let p = null;
        try {
          const res = await axios.post(HIVE_API_URL, {
            jsonrpc: '2.0',
            method: 'bridge.get_post',
            params: { author, permlink, observer: '' },
            id: 1,
          });
          if (!res.data?.error) p = res.data?.result || null;
        } catch { /* fall through */ }

        if (!p || !p.author) {
          const res2 = await axios.post(HIVE_API_URL, {
            jsonrpc: '2.0',
            method: 'condenser_api.get_content',
            params: [author, permlink],
            id: 1,
          });
          if (res2.data?.error) throw new Error(res2.data.error.message);
          p = res2.data?.result || null;
        }

        if (cancelled) return;
        if (!p || !p.author) throw new Error('Post not found');
        setPost(p);
      } catch (err) {
        if (!cancelled) setError(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [author, permlink]);

  // Determine 3Speak status — use cache if available, otherwise infer from
  // the loaded post's metadata.
  useEffect(() => {
    if (!author || !permlink) return;
    const key = `${author}/${permlink}`;
    const cached = get3SpeakStatus(key);
    if (typeof cached === 'boolean') {
      setIs3Speak(cached);
      return;
    }
    // Trigger a fetch so the cache populates (the detection util handles it)
    prefetch3SpeakDetection([key]);

    // Also infer locally from the fetched post to avoid waiting on a second RPC
    if (post) {
      let meta = {};
      try {
        meta = typeof post.json_metadata === 'string'
          ? JSON.parse(post.json_metadata || '{}')
          : (post.json_metadata || {});
      } catch { /* ignore */ }
      const app = (meta.app || '').toLowerCase();
      const tags = Array.isArray(meta.tags) ? meta.tags.map((t) => String(t).toLowerCase()) : [];
      const sourceMap = meta.video?.info?.sourceMap;
      const detected = (
        post.category === 'hive-181335' ||
        app.startsWith('3speak') ||
        tags.includes('threespeak') ||
        tags.includes('3speak') ||
        (Array.isArray(sourceMap) && sourceMap.some((s) => typeof s?.url === 'string' && s.url.includes('3speak')))
      );
      setIs3Speak(detected);
    }
  }, [author, permlink, post]);

  // Build a videoDetails-shaped object so CommentSection can consume it.
  const videoDetails = useMemo(() => {
    if (!post) return null;
    const payout = parseFloat(post.payout || 0) || (
      parseFloat(post.total_payout_value) +
      parseFloat(post.curator_payout_value) +
      parseFloat(post.pending_payout_value || '0')
    );
    return {
      title: post.title,
      body: post.body,
      author: {
        id: post.author,
        username: post.author,
        profile: { name: post.author, images: { avatar: `https://images.hive.blog/u/${post.author}/avatar` } },
      },
      stats: {
        num_comments: post.children || 0,
        num_votes: post.stats?.total_votes || post.active_votes?.length || 0,
        total_hive_reward: payout || 0,
      },
      created_at: post.created,
      community: post.category ? { _id: post.category, title: post.community_title || post.category } : null,
      tags: (() => {
        try {
          const m = typeof post.json_metadata === 'string' ? JSON.parse(post.json_metadata) : post.json_metadata;
          return Array.isArray(m?.tags) ? m.tags : [];
        } catch { return []; }
      })(),
    };
  }, [post]);

  // If this IS a 3Speak video, redirect to /watch
  if (is3Speak === true) {
    return <Navigate to={`/watch?v=${author}/${permlink}`} replace />;
  }

  if (loading) return <BarLoader />;

  if (error || !post) {
    return (
      <div className="post-view-page">
        <div className="post-view-error">
          <p>Could not load this post.</p>
          <Link to="/notifications">← Back to notifications</Link>
        </div>
      </div>
    );
  }

  const tags = videoDetails?.tags?.slice(0, 7) || [];
  const isComment = !!post.parent_author;

  return (
    <div className="post-view-page">
      {isComment && post.parent_author && (
        <Link
          to={`/post/${post.parent_author}/${post.parent_permlink}`}
          className="post-view-parent-link"
        >
          ← Reply to @{post.parent_author}/{post.parent_permlink}
        </Link>
      )}

      <h1 className="post-view-title">{post.title || '(untitled reply)'}</h1>

      <div className="post-view-author-row">
        <AuthorBadge author={post.author} showFollow />
        {videoDetails.community && (
          <Link to={`/c/${videoDetails.community._id}`} className="post-view-community">
            in {videoDetails.community.title}
          </Link>
        )}
      </div>

      <div className="post-view-meta-row">
        <span className="post-view-meta-item">
          <LuTimer /> {formatRelativeTime(post.created)}
        </span>
        <span className="post-view-meta-item">
          <PayoutAmount amount={videoDetails.stats.total_hive_reward} size={13} />
        </span>
        <span className="post-view-meta-item">
          {videoDetails.stats.num_votes} votes
        </span>
        <span className="post-view-meta-item">
          {videoDetails.stats.num_comments} comments
        </span>
      </div>

      {tags.length > 0 && (
        <div className="post-view-tags">
          {tags.map((t) => (
            <Link key={t} to={`/t/${t}`} className="post-view-tag">#{t}</Link>
          ))}
        </div>
      )}

      <div className="post-view-body">
        <BlogContent author={author} permlink={permlink} description={post.body} defaultExpanded />
      </div>

      <div className="post-view-comments">
        <CommentSection
          videoDetails={videoDetails}
          author={author}
          permlink={permlink}
          setIsVoted={() => {}}
        />
      </div>
    </div>
  );
}

export default PostView;
