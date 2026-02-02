import React, { useEffect, useState, useRef, useCallback } from 'react';
import './CommentSection.scss';
import './BlogContent.scss';
import { GiTwoCoins } from 'react-icons/gi';
import { BiDislike, BiLike } from 'react-icons/bi';
import { ImSpinner9 } from 'react-icons/im';
import { TailChase } from 'ldrs/react';
import dayjs from 'dayjs';
import { useAppStore } from '../../lib/store';
import { Client } from '@hiveio/dhive';
import UpvoteTooltip from '../tooltip/UpvoteTooltip';
import CommentVoteTooltip from '../tooltip/CommentVoteTooltip';
import {  toast } from 'sonner'
import { estimate, getVotePower } from '../../utils/hiveUtils';
import { filterByReputation } from '../../utils/reputation';
import { commentWithAioha } from '../../hive-api/aioha';
import { useTVMode } from '../../context/TVModeContext';
import { useTVKeyboard } from '../../context/TVKeyboardContext';

const client = new Client(['https://api.hive.blog']);

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

function CommentSection({ videoDetails, author, permlink }) {
  const { user } = useAppStore();
  const { isTVMode } = useTVMode();
  const { openKeyboard } = useTVKeyboard();
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

  // TV Mode state for comment input navigation
  const [tvInputFocusIndex, setTvInputFocusIndex] = useState(-1); // -1 = not focused, 0 = textarea, 1 = cancel, 2 = comment button
  const textareaRef = useRef(null);
  const cancelBtnRef = useRef(null);
  const commentBtnRef = useRef(null);

  // Function to enter TV input mode (called when Enter is pressed on the comment input container)
  // In TV mode, we open the on-screen keyboard instead of focusing the textarea
  const enterTvInputMode = useCallback(() => {
    console.log('[CommentSection] enterTvInputMode called, isTVMode:', isTVMode);
    if (isTVMode) {
      // Open the on-screen keyboard with callbacks to handle comment posting
      console.log('[CommentSection] Opening keyboard for comment input');
      openKeyboard({
        initialValue: commentInfo,
        placeholder: 'Write your comment here...',
        onChange: (val) => {
          console.log('[CommentSection] onChange called with:', val);
          setCommentInfo(val);
        },
        onSubmit: async (value) => {
          // When user presses "Done" on the keyboard, post the comment
          console.log('[CommentSection] onSubmit called with value:', value);
          if (value.trim()) {
            setCommentInfo(value);
            // Post comment using the keyboard value directly
            const parent_author = author;
            const parent_permlink = permlink;
            const new_permlink = `re-${parent_permlink}-${Date.now()}`;
            console.log('[CommentSection] Posting comment to:', parent_author, parent_permlink);

            try {
              const result = await commentWithAioha(
                parent_author,
                parent_permlink,
                new_permlink,
                '',
                value,
                { app: '3speak/new-version' }
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
                  body: value,
                  stats: {
                    num_likes: 0,
                    num_dislikes: 0,
                    total_hive_reward: 0,
                  },
                  children: [],
                };
                setCommentList(prev => [newComment, ...prev]);
                setCommentInfo('');
              } else {
                toast.error('Comment failed, please try again');
              }
            } catch (err) {
              console.error('Comment failed:', err);
              toast.error(err.message || 'Comment failed, please try again');
            }
          }
        },
      });
    } else {
      setTvInputFocusIndex(0);
      textareaRef.current?.focus();
    }
  }, [isTVMode, openKeyboard, commentInfo, author, permlink, user]);

  // Handle TV mode keyboard navigation within comment input
  useEffect(() => {
    if (!isTVMode || tvInputFocusIndex < 0) return;

    const handleKeyDown = (event) => {
      switch (event.keyCode) {
        case 38: // Up arrow
          if (tvInputFocusIndex > 0) {
            // Move from buttons back to textarea
            setTvInputFocusIndex(0);
            textareaRef.current?.focus();
            event.preventDefault();
            event.stopPropagation();
          } else {
            // Exit comment input focus mode
            setTvInputFocusIndex(-1);
            textareaRef.current?.blur();
            // Let Watch.jsx handle navigation
          }
          break;
        case 40: // Down arrow
          if (tvInputFocusIndex === 0) {
            // Move from textarea to comment button
            setTvInputFocusIndex(2);
            textareaRef.current?.blur();
            event.preventDefault();
            event.stopPropagation();
          } else {
            // Exit comment input focus mode
            setTvInputFocusIndex(-1);
            // Let Watch.jsx handle navigation to next comment
          }
          break;
        case 37: // Left arrow
          if (tvInputFocusIndex === 2) {
            // Move from comment button to cancel button
            setTvInputFocusIndex(1);
            event.preventDefault();
            event.stopPropagation();
          }
          break;
        case 39: // Right arrow
          if (tvInputFocusIndex === 1) {
            // Move from cancel button to comment button
            setTvInputFocusIndex(2);
            event.preventDefault();
            event.stopPropagation();
          }
          break;
        case 13: // Enter
          if (tvInputFocusIndex === 0) {
            // Textarea - open on-screen keyboard
            enterTvInputMode();
            event.preventDefault();
            event.stopPropagation();
          } else if (tvInputFocusIndex === 1) {
            // Cancel button - clear and exit
            setCommentInfo('');
            setReplyToComment(null);
            setTvInputFocusIndex(-1);
            event.preventDefault();
            event.stopPropagation();
          } else if (tvInputFocusIndex === 2) {
            // Comment button - post comment
            setReplyToComment(null);
            handlePostComment();
            setTvInputFocusIndex(-1);
            event.preventDefault();
            event.stopPropagation();
          }
          break;
        case 10009: // Samsung TV Back
        case 27: // Escape
          setTvInputFocusIndex(-1);
          textareaRef.current?.blur();
          event.preventDefault();
          event.stopPropagation();
          break;
        default:
          break;
      }
    };

    // Use capture phase to intercept events before Watch.jsx
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [isTVMode, tvInputFocusIndex, enterTvInputMode]);


      

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
      <div
        className={`add-comment-wrap${tvInputFocusIndex >= 0 ? ' tv-input-active' : ''}`}
        data-tv-main-focusable="true"
        data-tv-focusable-type="comment-input"
        data-tv-enter-handler="true"
        data-tv-custom-keyboard="true"
        onClick={enterTvInputMode}
      >
        <span>Add a comment:</span>
        <textarea
          ref={textareaRef}
          placeholder="Write your comment here..."
          className={`textarea-box${tvInputFocusIndex === 0 ? ' tv-element-focused' : ''}`}
          value={commentInfo}
          onChange={(e) => setCommentInfo(e.target.value)}
        />
        <div className="btn-wrap">
          <button
            ref={cancelBtnRef}
            className={tvInputFocusIndex === 1 ? 'tv-element-focused' : ''}
            onClick={() => {
              setCommentInfo('');
              setReplyToComment(null);
              if (isTVMode) setTvInputFocusIndex(-1);
            }}
          >Cancel</button>
          <button
            ref={commentBtnRef}
            className={tvInputFocusIndex === 2 ? 'tv-element-focused' : ''}
            onClick={() => {
              setReplyToComment(null);
              handlePostComment();
              if (isTVMode) setTvInputFocusIndex(-1);
            }}
          >Comment</button>
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
  const { isTVMode } = useTVMode();
  const isReplying = activeReply === comment.permlink;

  // TV Mode focus state for comment actions
  // -1 = not focused, 0 = like button, 1 = reply button, 2 = reply textarea, 3 = cancel btn, 4 = comment btn
  const [tvCommentFocusIndex, setTvCommentFocusIndex] = useState(-1);
  const likeButtonRef = useRef(null);
  const replyButtonRef = useRef(null);
  const replyTextareaRef = useRef(null);
  const replyCancelBtnRef = useRef(null);
  const replyCommentBtnRef = useRef(null);

  // Enter TV comment mode
  const enterTvCommentMode = useCallback(() => {
    if (isTVMode && depth === 0) {
      setTvCommentFocusIndex(0); // Start at like button
    }
  }, [isTVMode, depth]);

  // Handle keyboard navigation within comment
  useEffect(() => {
    if (!isTVMode || tvCommentFocusIndex < 0) return;

    const handleKeyDown = (event) => {
      switch (event.keyCode) {
        case 37: // Left arrow
          if (tvCommentFocusIndex === 1) {
            // Move from reply to like
            setTvCommentFocusIndex(0);
            event.preventDefault();
            event.stopPropagation();
          } else if (tvCommentFocusIndex === 4) {
            // Move from comment btn to cancel btn
            setTvCommentFocusIndex(3);
            event.preventDefault();
            event.stopPropagation();
          }
          break;
        case 39: // Right arrow
          if (tvCommentFocusIndex === 0) {
            // Move from like to reply
            setTvCommentFocusIndex(1);
            event.preventDefault();
            event.stopPropagation();
          } else if (tvCommentFocusIndex === 3) {
            // Move from cancel btn to comment btn
            setTvCommentFocusIndex(4);
            event.preventDefault();
            event.stopPropagation();
          }
          break;
        case 38: // Up arrow
          if (tvCommentFocusIndex >= 3) {
            // Move from buttons back to textarea
            setTvCommentFocusIndex(2);
            replyTextareaRef.current?.focus();
            event.preventDefault();
            event.stopPropagation();
          } else if (tvCommentFocusIndex === 2) {
            // Move from textarea back to reply button
            setTvCommentFocusIndex(1);
            replyTextareaRef.current?.blur();
            event.preventDefault();
            event.stopPropagation();
          } else {
            // Exit comment focus mode
            setTvCommentFocusIndex(-1);
            // Let Watch.jsx handle navigation
          }
          break;
        case 40: // Down arrow
          if (tvCommentFocusIndex <= 1 && isReplying) {
            // Move to reply textarea
            setTvCommentFocusIndex(2);
            replyTextareaRef.current?.focus();
            event.preventDefault();
            event.stopPropagation();
          } else if (tvCommentFocusIndex === 2) {
            // Move from textarea to comment button
            setTvCommentFocusIndex(4);
            replyTextareaRef.current?.blur();
            event.preventDefault();
            event.stopPropagation();
          } else {
            // Exit comment focus mode
            setTvCommentFocusIndex(-1);
            // Let Watch.jsx handle navigation
          }
          break;
        case 13: // Enter
          if (tvCommentFocusIndex === 0) {
            // Like button - trigger like action
            toggleTooltip(comment?.author?.username, comment.permlink, commentIndex);
            event.preventDefault();
            event.stopPropagation();
          } else if (tvCommentFocusIndex === 1) {
            // Reply button - open reply form
            setCommentInfo("");
            setReplyText("");
            setActiveReply(comment.permlink);
            setReplyToComment(comment);
            // Move to textarea after opening
            setTimeout(() => {
              setTvCommentFocusIndex(2);
              replyTextareaRef.current?.focus();
            }, 100);
            event.preventDefault();
            event.stopPropagation();
          } else if (tvCommentFocusIndex === 3) {
            // Cancel button
            setReplyText("");
            setActiveReply(null);
            setTvCommentFocusIndex(1); // Back to reply button
            event.preventDefault();
            event.stopPropagation();
          } else if (tvCommentFocusIndex === 4) {
            // Comment button - post reply
            handlePostComment();
            setTvCommentFocusIndex(-1);
            event.preventDefault();
            event.stopPropagation();
          }
          // If on textarea (index 2), let Enter work normally for new line
          break;
        case 10009: // Samsung TV Back
        case 27: // Escape
          if (isReplying && tvCommentFocusIndex >= 2) {
            // Close reply form
            setReplyText("");
            setActiveReply(null);
            setTvCommentFocusIndex(1);
          } else {
            setTvCommentFocusIndex(-1);
          }
          replyTextareaRef.current?.blur();
          event.preventDefault();
          event.stopPropagation();
          break;
        default:
          break;
      }
    };

    // Use capture phase to intercept events before Watch.jsx
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [isTVMode, tvCommentFocusIndex, isReplying, comment, commentIndex, toggleTooltip, setCommentInfo, setReplyText, setActiveReply, setReplyToComment, handlePostComment]);

  return (
    <div
      className={`comment-container${tvCommentFocusIndex >= 0 ? ' tv-comment-active' : ''}`}
      style={{ marginLeft: depth > 0 ? '40px' : '0px' }}
      data-tv-main-focusable={depth === 0 ? "true" : undefined}
      data-tv-focusable-type={depth === 0 ? "comment" : undefined}
      onClick={enterTvCommentMode}
    >
      <div className="comment">
        <img src={comment?.author?.profile?.images?.avatar || 'https://via.placeholder.com/40'} alt="Author Avatar" />
        <div className="comment-content">
          <h3>
            {comment?.author?.username}
            <span>{dayjs(comment?.created_at).fromNow()}</span>
          </h3>
          <div className="markdown-view" dangerouslySetInnerHTML={{ __html: processedBody(comment?.body || '', comment?.permlink) }} />
          <div className="comment-action">
            <div
              ref={likeButtonRef}
              className={`wrap tv-action-btn${tvCommentFocusIndex === 0 ? ' tv-element-focused' : ''}`}
            >
              <BiLike style={{ color: comment.has_voted ? 'red' : '' }}
              onClick={() => toggleTooltip(comment?.author?.username, comment.permlink, commentIndex)}
               />
              <span>{comment?.stats?.num_likes ?? 0}</span>
            </div>
            {/* <div className="wrap">
              <BiDislike />
              <span>{comment?.stats?.num_dislikes ?? 0}</span>
            </div> */}
            <div className="wrap">
              <GiTwoCoins />
              <span>${comment?.stats?.total_hive_reward?.toFixed(2) ?? '0.00'}</span>
            </div>
            <span
              ref={replyButtonRef}
              className={`main-reply tv-action-btn${tvCommentFocusIndex === 1 ? ' tv-element-focused' : ''}`}
              onClick={() => {
                setCommentInfo("");
                setReplyText("")
                setActiveReply(comment.permlink);
                setReplyToComment(comment);
              }}
            >
              Reply
            </span>
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
        <div className={`add-comment-wrap sub${tvCommentFocusIndex >= 2 ? ' tv-input-active' : ''}`}>
          <span>Reply:</span>
          <textarea
            ref={replyTextareaRef}
            placeholder="Write your reply here..."
            className={`textarea-box sub${tvCommentFocusIndex === 2 ? ' tv-element-focused' : ''}`}
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
          />
          <div className="btn-wrap">
            <button
              ref={replyCancelBtnRef}
              className={tvCommentFocusIndex === 3 ? 'tv-element-focused' : ''}
              onClick={() => {setReplyText(""); setActiveReply(null); if (isTVMode) setTvCommentFocusIndex(-1);}}
            >Cancel</button>
            <button
              ref={replyCommentBtnRef}
              className={tvCommentFocusIndex === 4 ? 'tv-element-focused' : ''}
              onClick={() => {handlePostComment(); if (isTVMode) setTvCommentFocusIndex(-1);}}
            >Comment</button>
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