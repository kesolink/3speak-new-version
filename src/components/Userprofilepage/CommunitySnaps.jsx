import { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { toast } from 'sonner';
import { BiUpvote, BiSolidUpvote, BiCommentDetail } from 'react-icons/bi';
import { fetchSnaps, SNAP_TAG } from '../../lib/snaps';
import { getHiveRenderer } from '../../lib/hiveRenderer';
import { getHiveClient } from '../../utils/hiveNode';
import { voteWithAioha, commentWithAioha } from '../../hive-api/aioha';
import { useAppStore } from '../../lib/store';
import SnapComposer from './SnapComposer';
import BarLoader from '../Loader/BarLoader';
import './CommunitySnaps.scss';

dayjs.extend(relativeTime);

const hiveTime = (t) => (t ? dayjs(/Z$/.test(String(t)) ? t : `${t}Z`).fromNow() : '');

// Body with "read more" — a very long snap is capped at ~10% of the viewport height
// until expanded.
function SnapBody({ body }) {
  const [html, setHtml] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    let alive = true;
    getHiveRenderer()
      .then((render) => { if (alive) { try { setHtml(render(body || '')); } catch { setHtml(''); } } })
      .catch(() => { if (alive) setHtml(''); });
    return () => { alive = false; };
  }, [body]);

  useEffect(() => {
    const el = ref.current;
    if (el && !expanded) setOverflowing(el.scrollHeight > el.clientHeight + 4);
  }, [html, expanded]);

  return (
    <div className="snap-body-wrap">
      <div
        ref={ref}
        className={`snap-body markdown-body${expanded ? ' expanded' : ''}`}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {overflowing && !expanded && (
        <button type="button" className="snap-readmore" onClick={() => setExpanded(true)}>Read more</button>
      )}
    </div>
  );
}

function SnapComment({ comment }) {
  const [html, setHtml] = useState('');
  useEffect(() => {
    let alive = true;
    getHiveRenderer().then((render) => { if (alive) { try { setHtml(render(comment.body || '')); } catch { setHtml(''); } } });
    return () => { alive = false; };
  }, [comment.body]);
  return (
    <li className="snap-comment">
      <div className="snap-comment-head">
        <Link to={`/p/${comment.author}`} className="snap-comment-author">@{comment.author}</Link>
        <span className="snap-comment-time">{hiveTime(comment.created)}</span>
      </div>
      <div className="snap-comment-body markdown-body" dangerouslySetInnerHTML={{ __html: html }} />
    </li>
  );
}

function SnapComments({ owner, permlink, onCommented }) {
  const user = useAppStore((s) => s.user);
  const client = getHiveClient();
  const [reply, setReply] = useState('');
  const [posting, setPosting] = useState(false);

  const { data: comments = [], isLoading, refetch } = useQuery({
    queryKey: ['snap-comments', owner, permlink],
    queryFn: async () => {
      const replies = await client.call('condenser_api', 'get_content_replies', [owner, permlink]);
      return (replies || []).sort((a, b) => new Date(a.created) - new Date(b.created));
    },
    staleTime: 30_000,
  });

  const handleReply = async () => {
    if (!user) { toast.error('Log in to comment'); return; }
    const text = reply.trim();
    if (!text) return;
    setPosting(true);
    try {
      const rp = `re-${permlink}-${Date.now() % 1000000}`.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 250);
      await commentWithAioha(owner, permlink, rp, '', text, { app: '3speak/snap', format: 'markdown' }, null);
      toast.success('Comment posted!');
      setReply('');
      setTimeout(() => { refetch(); onCommented?.(); }, 3000);
    } catch (e) {
      toast.error(e?.message || 'Could not post the comment');
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="snap-comments">
      {user && (
        <div className="snap-reply-box">
          <textarea
            placeholder="Write a comment…"
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            rows={2}
          />
          <button type="button" onClick={handleReply} disabled={posting || !reply.trim()}>
            {posting ? 'Posting…' : 'Reply'}
          </button>
        </div>
      )}
      {isLoading ? (
        <div className="snap-comments-status">Loading comments…</div>
      ) : comments.length === 0 ? (
        <div className="snap-comments-status">No comments yet.</div>
      ) : (
        <ul className="snap-comment-list">
          {comments.map((c) => <SnapComment key={`${c.author}/${c.permlink}`} comment={c} />)}
        </ul>
      )}
    </div>
  );
}

function SnapCard({ snap }) {
  const user = useAppStore((s) => s.user);
  const client = getHiveClient();
  const [showComments, setShowComments] = useState(false);
  const [voting, setVoting] = useState(false);
  const [optimistic, setOptimistic] = useState(null); // { votes, voted }

  // Live votes/comment counts from the chain (the checker only stores the text).
  const { data: meta, refetch } = useQuery({
    queryKey: ['snap-meta', snap.owner, snap.permlink],
    queryFn: async () => {
      const post = await client.call('condenser_api', 'get_content', [snap.owner, snap.permlink]);
      const av = post?.active_votes || [];
      return {
        votes: av.filter((v) => Number(v.percent) > 0).length,
        comments: post?.children ?? 0,
        voted: !!user && av.some((v) => v.voter === user && Number(v.percent) > 0),
      };
    },
    staleTime: 60_000,
  });

  const votes = optimistic?.votes ?? meta?.votes ?? 0;
  const voted = optimistic?.voted ?? meta?.voted ?? false;
  const comments = meta?.comments ?? 0;

  const handleVote = async () => {
    if (!user) { toast.error('Log in to vote'); return; }
    if (voted || voting) return;
    setVoting(true);
    setOptimistic({ votes: votes + 1, voted: true });
    try {
      await voteWithAioha(snap.owner, snap.permlink, 10000);
      toast.success('Upvoted!');
      setTimeout(() => refetch(), 3000);
    } catch (e) {
      setOptimistic(null);
      toast.error(e?.message || 'Vote failed');
    } finally {
      setVoting(false);
    }
  };

  const tags = (snap.tags || []).filter((t) => t && t !== 'nsfw' && t !== SNAP_TAG);

  return (
    <article className="snap-card">
      <div className="snap-card-head">
        <a
          className="snap-time"
          href={`https://peakd.com/@${snap.owner}/${snap.permlink}`}
          target="_blank"
          rel="noopener noreferrer"
          title="View on Hive"
        >
          {hiveTime(snap.created)}
        </a>
      </div>

      <SnapBody body={snap.body} />

      {tags.length > 0 && (
        <div className="snap-tags">
          {tags.map((t) => <Link key={t} to={`/t/${t}`} className="snap-tag">{t}</Link>)}
        </div>
      )}

      <div className="snap-actions">
        <button
          type="button"
          className={`snap-action${voted ? ' voted' : ''}`}
          onClick={handleVote}
          disabled={voting || voted}
          title={voted ? 'Upvoted' : 'Upvote'}
        >
          {voted ? <BiSolidUpvote /> : <BiUpvote />}
          {votes > 0 && <span>{votes}</span>}
        </button>
        <button
          type="button"
          className={`snap-action${showComments ? ' active' : ''}`}
          onClick={() => setShowComments((v) => !v)}
        >
          <BiCommentDetail />
          <span>{comments > 0 ? comments : ''} {showComments ? 'Hide' : 'Comments'}</span>
        </button>
      </div>

      {showComments && (
        <SnapComments owner={snap.owner} permlink={snap.permlink} onCommented={() => refetch()} />
      )}
    </article>
  );
}

/**
 * The profile's "Community" tab. Everyone sees the owner's snaps; only the owner
 * (canPost) gets the composer.
 */
export default function CommunitySnaps({ user, canPost = false }) {
  const [optimistic, setOptimistic] = useState([]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['community-snaps', user],
    queryFn: () => fetchSnaps(user),
    enabled: !!user,
    staleTime: 30_000,
  });

  const snaps = useMemo(() => {
    const fetched = data?.snaps || [];
    const seen = new Set(fetched.map((s) => s.permlink));
    const extra = optimistic.filter((s) => s.owner === user && !seen.has(s.permlink));
    return [...extra, ...fetched];
  }, [data?.snaps, optimistic, user]);

  const onPosted = (snap) => {
    setOptimistic((prev) => [snap, ...prev.filter((s) => s.permlink !== snap.permlink)]);
    setTimeout(() => refetch(), 4000);
    setTimeout(() => refetch(), 12000);
  };

  return (
    <div className="community-snaps">
      {canPost && <SnapComposer onPosted={onPosted} />}

      {isLoading && snaps.length === 0 ? (
        <BarLoader />
      ) : snaps.length === 0 ? (
        <div className="snap-empty">
          {canPost ? 'No community posts yet — share your first update above.' : 'No community posts yet.'}
        </div>
      ) : (
        <div className="snap-list">
          {snaps.map((s) => <SnapCard key={s._id || `${s.owner}/${s.permlink}`} snap={s} />)}
        </div>
      )}
    </div>
  );
}
