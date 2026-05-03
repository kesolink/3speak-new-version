import { useEffect, useState } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { useAppStore } from '../lib/store';
import { getUersContent } from '../utils/hiveUtils';
import BlogContent from '../components/playVideo/BlogContent';
import CommentSection from '../components/playVideo/CommentSection';
import UpvoteCount from '../components/UpvoteCount/UpvoteCount';
import CommentVoteTooltip from '../components/tooltip/CommentVoteTooltip';
import './PostView.scss';

function parseAudioPermlink(audioUrl) {
  try {
    const u = new URL(audioUrl);
    const a = u.searchParams.get('a'); // "user/permlink"
    return a ? { base: u.origin, perm: a } : null;
  } catch { return null; }
}

export default function PostView() {
  const { user, permlink } = useParams();
  const { state } = useLocation();
  const { authenticated, user: currentUser } = useAppStore();

  const prefilled = state?.author === user && state?.permlink === permlink ? state : null;

  const [post, setPost]         = useState(prefilled ? {
    title:          prefilled.title,
    author:         prefilled.author,
    permlink:       prefilled.permlink,
    created:        prefilled.created,
    active_votes:   [],
    _prefilledBody: prefilled.body,
    _tags:          prefilled.tags,
    _thumbnailUrl:  prefilled.thumbnailUrl,
    _audioUrl:      prefilled.audioUrl,
  } : null);
  const [loading, setLoading]   = useState(!prefilled);
  const [notFound, setNotFound] = useState(false);
  const [thumbnailUrl, setThumbnailUrl] = useState(prefilled?.thumbnailUrl || null);

  // Vote state
  const [isVoted, setIsVoted]       = useState(false);
  const [voteCount, setVoteCount]   = useState(0);
  const [showTooltip, setShowTooltip] = useState(false);
  const [weight, setWeight]         = useState(100);
  const [voteValue, setVoteValue]   = useState(0);
  const [accountData, setAccountData] = useState(null);

  useEffect(() => {
    if (prefilled || !user || !permlink) return;
    setLoading(true);
    getUersContent(user, permlink)
      .then(data => {
        if (!data || !data.author) { setNotFound(true); return; }
        setPost(data);
        setVoteCount(data.active_votes?.length || 0);
        if (currentUser) {
          setIsVoted(data.active_votes?.some(v => v.voter === currentUser) || false);
        }
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [user, permlink]);

  // Fetch thumbnail from audio backend for OpenPod posts
  useEffect(() => {
    if (!post || thumbnailUrl) return;
    const parsedMeta = (() => {
      try {
        return typeof post.json_metadata === 'string'
          ? JSON.parse(post.json_metadata)
          : (post.json_metadata || {});
      } catch { return {}; }
    })();
    // Use json_metadata.audio (direct visits) or _audioUrl (fresh-publish state)
    const audioSrc = parsedMeta.audio || post._audioUrl;
    if (!audioSrc) return;
    const parsed = parseAudioPermlink(audioSrc);
    if (!parsed) return;
    fetch(`${parsed.base}/api/audio?a=${parsed.perm}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.thumbnail_url) setThumbnailUrl(data.thumbnail_url); })
      .catch(() => {});
  }, [post]);

  if (loading) {
    return <div className="post-view"><div className="post-view__status">Loading post…</div></div>;
  }
  if (notFound) {
    return <div className="post-view"><div className="post-view__status">Post not found.</div></div>;
  }

  const parsedMeta = (() => {
    try {
      return typeof post.json_metadata === 'string'
        ? JSON.parse(post.json_metadata)
        : (post.json_metadata || {});
    } catch { return {}; }
  })();

  const tags = post._tags || parsedMeta.tags || [];
  const resolvedThumbnail = thumbnailUrl || parsedMeta.image?.[0] || null;

  return (
    <div className="post-view">
      {resolvedThumbnail && (
        <img src={resolvedThumbnail} alt={post.title} className="post-view__thumbnail" />
      )}

      <div className="post-view__inner">
        <h1 className="post-view__title">{post.title}</h1>

        <div className="post-view__meta">
          <img
            src={`https://images.hive.blog/u/${post.author}/avatar/small`}
            alt={post.author}
            className="post-view__avatar"
          />
          <div>
            <span className="post-view__author">@{post.author}</span>
            {post.created && (
              <span className="post-view__date">
                {' · '}{new Date(post.created.endsWith('Z') ? post.created : post.created + 'Z').toLocaleDateString(undefined, {
                  year: 'numeric', month: 'short', day: 'numeric',
                })}
              </span>
            )}
          </div>
        </div>

        {tags.length > 0 && (
          <div className="post-view__tags">
            {tags.map(tag => <span key={tag} className="post-view__tag">{tag}</span>)}
          </div>
        )}

        <div className="post-view__body">
          {post._prefilledBody
            ? <BlogContent description={post._prefilledBody} alwaysExpanded />
            : <BlogContent author={post.author} permlink={post.permlink} alwaysExpanded />
          }
        </div>

        <div className="post-view__actions">
          <UpvoteCount
            count={voteCount}
            voted={isVoted}
            onClick={() => setShowTooltip(v => !v)}
            size={16}
          />
          {authenticated && showTooltip && (
            <CommentVoteTooltip
              showTooltip={showTooltip}
              setShowTooltip={setShowTooltip}
              author={post.author}
              permlink={post.permlink}
              weight={weight}
              setWeight={setWeight}
              voteValue={voteValue}
              setVoteValue={setVoteValue}
              accountData={accountData}
              setAccountData={setAccountData}
              compact
              onVoteSuccess={(a, p, isNewVote) => {
                setIsVoted(true);
                if (isNewVote) setVoteCount(c => c + 1);
                setShowTooltip(false);
              }}
            />
          )}
        </div>

        <CommentSection
          author={post.author}
          permlink={post.permlink}
          videoDetails={post}
        />
      </div>
    </div>
  );
}
