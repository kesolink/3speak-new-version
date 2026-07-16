import { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { toast } from 'sonner';
import { BiCommentDetail } from 'react-icons/bi';
import { fetchSnaps, SNAP_TAG } from '../../lib/snaps';
import { getHiveRenderer } from '../../lib/hiveRenderer';
import { getHiveClient } from '../../utils/hiveNode';
import { commentWithAioha } from '../../hive-api/aioha';
import { useAppStore } from '../../lib/store';
import SnapComposer from './SnapComposer';
import UpvoteCount from '../UpvoteCount/UpvoteCount';
import CommentVoteTooltip from '../tooltip/CommentVoteTooltip';
import BarLoader from '../Loader/BarLoader';
import './CommunitySnaps.scss';

dayjs.extend(relativeTime);

const hiveTime = (t) => (t ? dayjs(/Z$/.test(String(t)) ? t : `${t}Z`).fromNow() : '');

async function fetchReplies(author, permlink) {
  const replies = await getHiveClient().call('condenser_api', 'get_content_replies', [author, permlink]);
  return (replies || []).sort((a, b) => new Date(a.created) - new Date(b.created));
}

// Body with "read more"/"show less" — a very long snap is capped at ~10% of the
// viewport, but only when it actually overflows (no fade on short posts).
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
    const measure = () => {
      const el = ref.current;
      // scrollHeight is the full content height regardless of the max-height clamp.
      if (el) setOverflowing(el.scrollHeight > window.innerHeight * 0.1 + 8);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [html]);

  const clamped = overflowing && !expanded;
  return (
    <div className="snap-body-wrap">
      <div
        ref={ref}
        className={`snap-body markdown-body${clamped ? ' clamped' : ''}`}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {overflowing && (
        <button type="button" className="snap-readmore" onClick={() => setExpanded((e) => !e)}>
          {expanded ? 'Show less' : 'Read more'}
        </button>
      )}
    </div>
  );
}

// Reply composer — reused for the snap itself and for any comment (nested replies).
function ReplyBox({ parentAuthor, parentPermlink, onPosted, autoFocus = false }) {
  const user = useAppStore((s) => s.user);
  const [reply, setReply] = useState('');
  const [posting, setPosting] = useState(false);
  if (!user) return null;

  const submit = async () => {
    const text = reply.trim();
    if (!text) return;
    setPosting(true);
    try {
      const rp = `re-${parentPermlink}-${Date.now() % 1000000}`.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 250);
      await commentWithAioha(parentAuthor, parentPermlink, rp, '', text, { app: '3speak/snap', format: 'markdown' }, null);
      toast.success('Comment posted!');
      setReply('');
      setTimeout(() => onPosted?.(), 3000);
    } catch (e) {
      toast.error(e?.message || 'Could not post the comment');
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="snap-reply-box">
      <textarea
        placeholder="Write a comment…"
        value={reply}
        onChange={(e) => setReply(e.target.value)}
        rows={2}
        autoFocus={autoFocus}
      />
      <button type="button" onClick={submit} disabled={posting || !reply.trim()}>
        {posting ? 'Posting…' : 'Reply'}
      </button>
    </div>
  );
}

// A single comment — recursive, so replies-on-replies work.
function SnapComment({ comment }) {
  const user = useAppStore((s) => s.user);
  const [html, setHtml] = useState('');
  const [replying, setReplying] = useState(false);
  const [showReplies, setShowReplies] = useState(false);
  const childCount = comment.children ?? 0;

  useEffect(() => {
    let alive = true;
    getHiveRenderer().then((render) => { if (alive) { try { setHtml(render(comment.body || '')); } catch { setHtml(''); } } });
    return () => { alive = false; };
  }, [comment.body]);

  const { data: children = [], refetch } = useQuery({
    queryKey: ['snap-replies', comment.author, comment.permlink],
    queryFn: () => fetchReplies(comment.author, comment.permlink),
    enabled: showReplies,
    staleTime: 30_000,
  });

  return (
    <li className="snap-comment">
      <div className="snap-comment-head">
        <Link to={`/p/${comment.author}`} className="snap-comment-author">@{comment.author}</Link>
        <span className="snap-comment-time">{hiveTime(comment.created)}</span>
      </div>
      <div className="snap-comment-body markdown-body" dangerouslySetInnerHTML={{ __html: html }} />
      <div className="snap-comment-actions">
        {user && (
          <button type="button" onClick={() => setReplying((v) => !v)}>{replying ? 'Cancel' : 'Reply'}</button>
        )}
        {childCount > 0 && (
          <button type="button" onClick={() => setShowReplies((v) => !v)}>
            {showReplies ? 'Hide replies' : `${childCount} ${childCount > 1 ? 'replies' : 'reply'}`}
          </button>
        )}
      </div>
      {replying && (
        <ReplyBox
          parentAuthor={comment.author}
          parentPermlink={comment.permlink}
          autoFocus
          onPosted={() => { setReplying(false); setShowReplies(true); refetch(); }}
        />
      )}
      {showReplies && children.length > 0 && (
        <ul className="snap-comment-list nested">
          {children.map((c) => <SnapComment key={`${c.author}/${c.permlink}`} comment={c} />)}
        </ul>
      )}
    </li>
  );
}

function SnapComments({ owner, permlink, onCommented }) {
  const { data: comments = [], isLoading, refetch } = useQuery({
    queryKey: ['snap-comments', owner, permlink],
    queryFn: () => fetchReplies(owner, permlink),
    staleTime: 30_000,
  });

  return (
    <div className="snap-comments">
      <ReplyBox parentAuthor={owner} parentPermlink={permlink} onPosted={() => { refetch(); onCommented?.(); }} />
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

  // Vote-dialog state (the reused CommentVoteTooltip owns the actual vote).
  const [showVote, setShowVote] = useState(false);
  const [weight, setWeight] = useState(100);
  const [voteValue, setVoteValue] = useState('0.00');
  const [accountData, setAccountData] = useState(null);

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

  const votes = meta?.votes ?? 0;
  const voted = meta?.voted ?? false;
  const comments = meta?.comments ?? 0;
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
        <div className="snap-vote">
          <UpvoteCount count={votes} voted={voted} onClick={() => setShowVote((v) => !v)} size={13} />
          {showVote && (
            <CommentVoteTooltip
              author={snap.owner}
              permlink={snap.permlink}
              showTooltip={showVote}
              setShowTooltip={setShowVote}
              weight={weight}
              setWeight={setWeight}
              voteValue={voteValue}
              setVoteValue={setVoteValue}
              accountData={accountData}
              setAccountData={setAccountData}
              setActiveTooltipPermlink={() => {}}
              onVoteSuccess={() => refetch()}
              enableViewerTag={false}
              postCreatedAt={snap.created}
            />
          )}
        </div>
        <button
          type="button"
          className={`snap-action${showComments ? ' active' : ''}`}
          onClick={() => setShowComments((v) => !v)}
        >
          <BiCommentDetail />
          <span>{comments}</span>
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
