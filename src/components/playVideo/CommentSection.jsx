import React, { useEffect, useState, useRef, useCallback } from 'react';
import './CommentSection.scss';
import './BlogContent.scss';
import { BiDislike } from 'react-icons/bi';
import { ImSpinner9 } from 'react-icons/im';
import { TailChase } from 'ldrs/react';
import { MdVideocam } from 'react-icons/md';
import dayjs from 'dayjs';
import { useAppStore } from '../../lib/store';
import { Client } from '@hiveio/dhive';
import UpvoteTooltip from '../tooltip/UpvoteTooltip';
import CommentVoteTooltip from '../tooltip/CommentVoteTooltip';
import {  toast } from 'sonner'
import { estimate, getVotePower } from '../../utils/hiveUtils';
import { filterByReputation } from '../../utils/reputation';
import Button from '../Button/Button';
import AuthorBadge from '../AuthorBadge/AuthorBadge';
import UpvoteCount from '../UpvoteCount/UpvoteCount';
import PayoutAmount from '../PayoutAmount/PayoutAmount';
import { commentWithAioha } from '../../hive-api/aioha';
import { HIVE_API_NODES } from '../../utils/config';
import TimeAgo from '../TimeAgo/TimeAgo';

const client = new Client(HIVE_API_NODES);

// Lazy-loaded renderer to avoid Node.js polyfill issues at bundle time
let rendererPromise = null;
const getRenderer = async () => {
  if (!rendererPromise) {
    rendererPromise = import('@snapie/renderer').then(({ createHiveRenderer }) => {
      return createHiveRenderer({
        ipfsGateway: 'https://ipfs-3speak.b-cdn.net',
        convertHiveUrls: true,
        usertagUrlFn: (account) => `/p/${account}`,
        hashtagUrlFn: (tag) => `/t/${tag}`,
      });
    });
  }
  return rendererPromise;
};

function formatTimeInput(seconds) {
  if (!seconds || isNaN(seconds)) return '0:00';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function parseTimeInput(str) {
  if (!str) return 0;
  const parts = str.split(':').map(Number);
  if (parts.some(isNaN)) return null;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 1) return parts[0];
  return null;
}

function CommentSection({ videoDetails, author, permlink, currentTime, duration }) {
  const { user } = useAppStore();
  const [commentInfo, setCommentInfo] = useState('');
  const [replyText, setReplyText] = useState("");
  const [activeReply, setActiveReply] = useState(null);
  const [replyToComment, setReplyToComment] = useState(null);
  const [commentList, setCommentList] = useState([]);
  const [loadingComments, setLoadingComments] = useState(true);
  const [selectedPost, setSelectedPost] = useState({ author: '', permlink: '' });
  const [showTooltip, setShowTooltip] = useState(false);
  const [activeTooltipPermlink, setActiveTooltipPermlink] = useState(null);
  const accessToken = localStorage.getItem("access_token");
    const [weight, setWeight] = useState(100);
    const [voteValue, setVoteValue] = useState(0.0);
      const [accountData, setAccountData] = useState(null);
  // Cache for rendered comment bodies
  const [renderedBodies, setRenderedBodies] = useState({});

  // Timeline position state — auto-follows playhead unless manually edited
  const [timelineInput, setTimelineInput] = useState('0:00');
  const [timelineOverride, setTimelineOverride] = useState(false);
  const prevTimeRef = useRef(0);

  // Auto-update timeline input from playhead position (unless user overrode it)
  useEffect(() => {
    if (timelineOverride) return;
    const rounded = Math.floor(currentTime || 0);
    if (rounded !== prevTimeRef.current) {
      prevTimeRef.current = rounded;
      setTimelineInput(formatTimeInput(rounded));
    }
  }, [currentTime, timelineOverride]);

  const handleTimelineInputChange = useCallback((e) => {
    setTimelineInput(e.target.value);
    setTimelineOverride(true);
  }, []);

  const handleTimelineInputBlur = useCallback(() => {
    // Validate and normalize on blur
    const parsed = parseTimeInput(timelineInput);
    if (parsed === null || (duration && parsed > duration)) {
      // Invalid or out of range — reset to current playhead
      setTimelineInput(formatTimeInput(Math.floor(currentTime || 0)));
      setTimelineOverride(false);
    } else {
      setTimelineInput(formatTimeInput(parsed));
    }
  }, [timelineInput, currentTime, duration]);

  // Reset override when user focuses back on textarea (start following again)
  const handleTextareaFocus = useCallback(() => {
    setTimelineOverride(false);
  }, []);


      

  useEffect(() => {
    const fetchComments = async () => {
      setLoadingComments(true);
      try {
        const replies = await client.call('condenser_api', 'get_content_replies', [author, permlink]);
        const commentsWithChildren = await loadNestedComments(replies);
        // Filter out spam accounts (negative reputation)
        const filteredComments = await filterByReputation(commentsWithChildren);
        setCommentList(filteredComments);
        
        // Pre-render all comment bodies (createHiveRenderer returns a function directly)
        const render = await getRenderer();
        const rendered = {};
        const renderComment = (comment) => {
          if (comment?.body) {
            try {
              rendered[comment.permlink] = render(comment.body);
            } catch (err) {
              rendered[comment.permlink] = '';
            }
          }
          if (comment.children) {
            comment.children.forEach(renderComment);
          }
        };
        filteredComments.forEach(renderComment);
        setRenderedBodies(rendered);
      } catch (error) {
        console.error('Failed to fetch comments from Hive:', error);
      } finally {
        setLoadingComments(false);
      }
    };

    fetchComments();
  }, [author, permlink]);

  useEffect(() => {
  
      const fetchAccountData = async () => {
        try {
          const result = await getVotePower(user);
          if (result) {
            const { account } = result;
            setAccountData(account);
            calculateVoteValue(account, weight);
          }
        } catch (err) {
          console.error('Error fetching account:', err);
        }
      };
  
      fetchAccountData();
    }, []);


    const calculateVoteValue = async (account, percent) => {
        try{
          const data = await estimate(account, percent)
          setVoteValue(data)
        }catch(err){
          console.log(err)
    
        } 
      };

  const loadNestedComments = async (comments) => {
    const result = await Promise.all(
      comments.map(async (comment) => {
        const children = await client.call('condenser_api', 'get_content_replies', [comment.author, comment.permlink]);
        const has_voted = comment.active_votes?.some(v => v.voter === user) ?? false;
        return {
          author: {
            username: comment.author,
            profile: {
              images: {
                avatar: `https://images.hive.blog/u/${comment.author}/avatar`,
              },
            },
          },
          permlink: comment.permlink,
          created_at: comment.created,
          body: comment.body,
          stats: {
            num_likes: comment.active_votes?.filter((v) => v.percent > 0).length || 0,
            num_dislikes: comment.active_votes?.filter((v) => v.percent < 0).length || 0,
            total_hive_reward: parseFloat(comment.pending_payout_value),
          },
          has_voted,
          children: await loadNestedComments(children),
        };
      })
    );
    return result;
  };

  const processedBody = (content, permlink) => {
    if (!content) return '';
    // Use pre-rendered body if available
    if (permlink && renderedBodies[permlink]) {
      return renderedBodies[permlink];
    }
    // Fallback - return raw content (will be rendered on next fetch)
    return content;
  };

  const handlePostComment = async () => {
    const textToPost = replyToComment ? replyText : commentInfo;

    if (!textToPost.trim()) return;

    // Determine if we're replying to the main post or a comment
    const isReplyingToMainPost = !replyToComment;

    const parent_author = isReplyingToMainPost ? author : replyToComment.author.username;
    const parent_permlink = isReplyingToMainPost ? permlink : replyToComment.permlink;
    const new_permlink = `re-${parent_permlink}-${Date.now()}`;

    try {
      // Use aioha for comment broadcasting (works with all providers: Keychain, HiveAuth, etc.)
      const result = await commentWithAioha(
        parent_author,
        parent_permlink,
        new_permlink,
        '', // title (empty for comments)
        textToPost,
        { app: '3speak/new-version' } // json_metadata
      );

      if (result.success) {
        toast.success('Comment posted successfully!');
        const newComment = {
          author: {
            username: user,
            profile: {
              images: {
                avatar: `https://images.hive.blog/u/${user}/avatar`,
              },
            },
          },
          permlink: new_permlink,
          created_at: new Date().toISOString(),
          body: textToPost,
          stats: {
            num_likes: 0,
            num_dislikes: 0,
            total_hive_reward: 0,
          },
          children: [],
        };

        if (isReplyingToMainPost) {
          setCommentList(prev => [newComment, ...prev]);
        } else {
          const addReply = (comments) =>
            comments.map((comment) => {
              if (comment.permlink === parent_permlink) {
                return {
                  ...comment,
                  children: [...(comment.children || []), newComment],
                };
              } else if (comment.children) {
                return {
                  ...comment,
                  children: addReply(comment.children),
                };
              }
              return comment;
            });

          setCommentList(prev => addReply(prev));
        }

        setCommentInfo('');
        setReplyText('');
        setActiveReply(null);
        setReplyToComment(null);
      } else {
        toast.error('Comment failed, please try again');
      }
    } catch (err) {
      console.error('Comment failed:', err);
      toast.error(err.message || 'Comment failed, please try again');
    }
  };

  // const handleVote = (username, permlink, weight = 10000) => {
  //   if (window.hive_keychain) {
  //     window.hive_keychain.requestBroadcast(
  //       user,
  //       [
  //         [
  //           'vote',
  //           {
  //             voter: user,
  //             author: username,
  //             permlink,
  //             weight,
  //           },
  //         ],
  //       ],
  //       'Posting',
  //       (response) => {
  //         if (response.success) {
  //           alert('Vote successful!');
  //         } else {
  //           alert(`Vote failed: ${response.message}`);
  //         }
  //       }
  //     );
  //   } else {
  //     alert('Hive Keychain is not installed. Please install the extension.');
  //   }
  // };

  const toggleTooltip = (author, permlink, index) => {
    // console.log('Toggle Tooltip:', author, permlink, index);
    setSelectedPost({ author, permlink });
    setShowTooltip(prev => !prev || activeTooltipPermlink !== permlink);
    setActiveTooltipPermlink((prev) => (prev === permlink ? null : permlink));
  };

  // Count total comments including nested children
  const countComments = (comments) => {
    if (!comments || comments.length === 0) return 0;
    return comments.reduce((sum, c) => sum + 1 + countComments(c.children || []), 0);
  };

  return (
    <div className="vid-comment-wrap">
      
      
      {/* Main comment form */}
      <div className="add-comment-wrap">
        <div className="comment-header-row">
          Add a comment:
          <button className="add-reaction-btn" type="button" title="Add Video Reaction">
            <MdVideocam size={14} />
            React
          </button>
        </div>
        <textarea
          placeholder="Write your comment here..."
          className="textarea-box"
          value={commentInfo}
          onChange={(e) => setCommentInfo(e.target.value)}
          onFocus={handleTextareaFocus}
        />
        <div className="comment-form-row">
          <div className="comment-timeline-input">
            <label htmlFor="comment-timestamp">Timestamp:</label>
            <input
              id="comment-timestamp"
              type="text"
              className="timeline-input"
              value={timelineInput}
              onChange={handleTimelineInputChange}
              onBlur={handleTimelineInputBlur}
              placeholder="0:00"
            />
          </div>
          <div className="btn-wrap">
            <Button text="Cancel" onClick={() => {
              setCommentInfo('');
              setReplyToComment(null);
            }} />
            <Button text="Comment" prominent onClick={() => {
              setReplyToComment(null);
              handlePostComment();
            }} />
          </div>
        </div>
      </div>

      <h4>{countComments(commentList)} Comments</h4>

      {loadingComments ? (
        <div className="comments-loading">
          <div className="loader-center"> 
            <TailChase size={16} speed={1.5} color="var(--accent-primary)" />
          </div>
        </div>
      ) : (
        commentList.map((comment, index) => (
        <Comment
        key={`${comment.author?.username}-${comment.permlink || index}`}
          commentIndex={index}
          comment={comment}
          setCommentList={setCommentList}
          activeReply={activeReply}
          setActiveReply={setActiveReply}
          setReplyToComment={setReplyToComment}
          setCommentInfo={setCommentInfo}
          setReplyText={setReplyText}
          replyText={replyText}
          commentInfo={commentInfo}
          handlePostComment={handlePostComment}
          depth={0}
          // handleVote={handleVote}
          processedBody={processedBody}
          toggleTooltip={toggleTooltip}
          selectedPost={selectedPost}
          showTooltip={showTooltip}
          setShowTooltip={setShowTooltip}
          activeTooltipPermlink={activeTooltipPermlink}
          setActiveTooltipPermlink={setActiveTooltipPermlink}
          weight={weight}
      setWeight={setWeight}
      voteValue={voteValue}
      setVoteValue={setVoteValue}
      accountData={accountData}
      setAccountData={setAccountData}
          
        />
      )) )}
    </div>
  );
}

function Comment({
  commentIndex,
  comment,
  setCommentList,
  activeReply,
  setActiveReply,
  setReplyToComment,
  processedBody,
  setCommentInfo,
  setReplyText,
  replyText,
  commentInfo,
  handlePostComment,
  depth,
  handleVote,
  toggleTooltip,
  selectedPost,
  showTooltip,
  setShowTooltip,
  activeTooltipPermlink,
  setActiveTooltipPermlink,
  commemtStyle,
  weight,
      setWeight,
      voteValue,
      setVoteValue,
      accountData,
      setAccountData,
}) {
  const isReplying = activeReply === comment.permlink;

  return (
    <div className="comment-container" style={{ marginLeft: depth > 0 ? '40px' : '0px' }} >
      <div className="comment">
        <div className="comment-content">
          <div className="comment-header">
            <AuthorBadge author={comment?.author?.username} noLink />
            <span className="comment-date"><TimeAgo date={comment?.created_at} /></span>
          </div>
          <div className="markdown-view" dangerouslySetInnerHTML={{ __html: processedBody(comment?.body || '', comment?.permlink) }} />
          <div className="comment-action">
            <UpvoteCount
              count={comment?.stats?.num_likes ?? 0}
              voted={comment.has_voted}
              onClick={() => toggleTooltip(comment?.author?.username, comment.permlink, commentIndex)}
            />
            <PayoutAmount amount={comment?.stats?.total_hive_reward} />
            <Button text="Reply" onClick={() => {
                setCommentInfo("");
                setReplyText("")
                setActiveReply(comment.permlink);
                setReplyToComment(comment);
              }} />
            <CommentVoteTooltip
             author={comment?.author?.username}
             permlink={comment.permlink}
             showTooltip={showTooltip && activeTooltipPermlink === comment.permlink}
             setShowTooltip={setShowTooltip}
             setCommentList={setCommentList}
             setActiveTooltipPermlink={setActiveTooltipPermlink}
             commemtStyle={commemtStyle}
             weight={weight}
             setWeight={setWeight}      
      voteValue={voteValue}
      setVoteValue={setVoteValue}
      accountData={accountData}
      setAccountData={setAccountData}
          
            />
          </div>
        </div>
      </div>

      {isReplying && (
        <div className="add-comment-wrap sub">
          <span>Reply:</span>
          <textarea
            placeholder="Write your reply here..."
            className="textarea-box sub"
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
          />
          <div className="btn-wrap">
            <Button text="Cancel" onClick={() => {setReplyText(""); setActiveReply(null)}} />
            <Button text="Comment" prominent onClick={handlePostComment} />
          </div>
        </div>
      )}

      {comment.children && comment.children.length > 0 && (
        <div className="nested-comments">
          {comment.children.map((child, index) => (
            <Comment
              key={`${child.permlink}-${index}`}
              commentIndex={index}
              comment={child}
              setCommentList={setCommentList}
              activeReply={activeReply}
              setActiveReply={setActiveReply}
              setReplyToComment={setReplyToComment}
              setCommentInfo={setCommentInfo}
              setReplyText={setReplyText}
              commentInfo={commentInfo}
              handlePostComment={handlePostComment}
              depth={depth + 1}
              handleVote={handleVote}
              processedBody={processedBody}
              toggleTooltip={toggleTooltip}
              selectedPost={selectedPost}
              showTooltip={showTooltip}
              setShowTooltip={setShowTooltip}
              activeTooltipPermlink={activeTooltipPermlink}
              setActiveTooltipPermlink={setActiveTooltipPermlink}
              weight={weight}
             setWeight={setWeight}      
      voteValue={voteValue}
      setVoteValue={setVoteValue}
      accountData={accountData}
      setAccountData={setAccountData}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default CommentSection;