import React, { useEffect, useState } from 'react';
import './CommentSection.scss';
import './BlogContent.scss';
import { GiTwoCoins } from 'react-icons/gi';
import { BiDislike, BiLike } from 'react-icons/bi';
import { useQuery } from '@apollo/client';
import { GET_COMMENTS } from '../../graphql/queries';
import dayjs from 'dayjs';
import { useAppStore } from '../../lib/store';
import { renderPostBody } from '@ecency/render-helper';

function CommentSection({ videoDetails, author, permlink }) {
  const { data, loading, error, refetch } = useQuery(GET_COMMENTS, {
    variables: { author, permlink },
  });

  const { user } = useAppStore();
  const [commentInfo, setCommentInfo] = useState('');
  const [activeReply, setActiveReply] = useState(null);
  const [replyToComment, setReplyToComment] = useState(null);
  const [commentList, setCommentList] = useState([]);

  useEffect(() => {
    if (data?.socialPost?.children) {
      setCommentList(data.socialPost.children);
    }
  }, [data]);

  const processedBody = (content) => {
    if (!content) return '';
    return renderPostBody(content, false);
  };

  const handlePostComment = async () => {
    if (!replyToComment) return;

    const parent_permlink = replyToComment.permlink;
    const parent_author = replyToComment.author.username;
    const new_permlink = `re-${parent_permlink}-${Date.now()}`;

    if (!commentInfo.trim()) return;

    if (window.hive_keychain) {
      window.hive_keychain.requestBroadcast(
        user,
        [
          [
            'comment',
            {
              parent_author,
              parent_permlink,
              author: user,
              permlink: new_permlink,
              title: '',
              body: commentInfo,
              json_metadata: '{"app":"3speak/new-version"}',
            },
          ],
        ],
        'Posting',
        async (response) => {
          if (response.success) {
            const newComment = {
              author: {
                username: user,
                profile: {
                  images: {
                    avatar: 'https://via.placeholder.com/40',
                  },
                },
              },
              permlink: new_permlink,
              created_at: new Date().toISOString(),
              body: commentInfo,
              stats: {
                num_likes: 0,
                num_dislikes: 0,
                total_hive_reward: 0,
              },
              children: [],
            };

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

            setCommentList((prev) => addReply(prev));
            setCommentInfo('');
            setActiveReply(null);
            setReplyToComment(null);
            await refetch();
          } else {
            alert(`Comment failed: ${response.message}`);
          }
        }
      );
    } else {
      alert('Hive Keychain is not installed. Please install the extension.');
    }
  };

  const handleVote = (username, permlink, weight = 10000) => {
    if (window.hive_keychain) {
      window.hive_keychain.requestBroadcast(
        user,
        [
          [
            'vote',
            {
              voter: user,
              author: username,
              permlink,
              weight,
            },
          ],
        ],
        'Posting',
        (response) => {
          if (response.success) {
            alert('Vote successful!');
          } else {
            alert(`Vote failed: ${response.message}`);
          }
        }
      );
    } else {
      alert('Hive Keychain is not installed. Please install the extension.');
    }
  };

  return (
    <div className="vid-comment-wrap">
      <h4>{commentList.length} Comments</h4>
      {commentList.map((comment, index) => (
        <Comment
          key={index}
          comment={comment}
          activeReply={activeReply}
          setActiveReply={setActiveReply}
          setReplyToComment={setReplyToComment}
          setCommentInfo={setCommentInfo}
          commentInfo={commentInfo}
          handlePostComment={handlePostComment}
          depth={0}
          handleVote={handleVote}
          processedBody={processedBody}
        />
      ))}
    </div>
  );
}

function Comment({
  comment,
  activeReply,
  setActiveReply,
  setReplyToComment,
  processedBody,
  setCommentInfo,
  commentInfo,
  handlePostComment,
  depth,
  handleVote,
}) {
  const isReplying = activeReply === comment.permlink;

  return (
    <div className="comment-container" style={{ marginLeft: depth > 0 ? '40px' : '0px' }}>
      <div className="comment">
        <img src={comment?.author?.profile?.images?.avatar || 'https://via.placeholder.com/40'} alt="Author Avatar" />
        <div>
          <h3>
            {comment?.author?.username}
            <span>{dayjs(comment?.created_at).fromNow()}</span>
          </h3>
          <p className="markdown-view" dangerouslySetInnerHTML={{ __html: processedBody(comment?.body || '') }} />
          <div className="comment-action">
            <div className="wrap">
              <BiLike onClick={() => handleVote(comment?.author?.username, comment.permlink)} />
              <span>{comment?.stats?.num_likes ?? 0}</span>
            </div>
            <div className="wrap">
              <BiDislike />
              <span>{comment?.stats?.num_dislikes ?? 0}</span>
            </div>
            <div className="wrap">
              <GiTwoCoins />
              <span>${comment?.stats?.total_hive_reward?.toFixed(2) ?? '0.00'}</span>
            </div>
            <span
              className="main-reply"
              onClick={() => {
                setActiveReply(comment.permlink);
                setReplyToComment(comment);
              }}
            >
              Reply
            </span>
          </div>
        </div>
      </div>

      {isReplying && (
        <div className="add-comment-wrap sub">
          <span>Reply:</span>
          <textarea
            placeholder="Write your reply here..."
            className="textarea-box sub"
            value={commentInfo}
            onChange={(e) => setCommentInfo(e.target.value)}
          />
          <div className="btn-wrap">
            <button onClick={() => setActiveReply(null)}>Cancel</button>
            <button onClick={handlePostComment}>Comment</button>
          </div>
        </div>
      )}

      {comment.children && comment.children.length > 0 && (
        <div className="nested-comments">
          {comment.children.map((child, index) => (
            <Comment
              key={index}
              comment={child}
              activeReply={activeReply}
              setActiveReply={setActiveReply}
              setReplyToComment={setReplyToComment}
              setCommentInfo={setCommentInfo}
              commentInfo={commentInfo}
              handlePostComment={handlePostComment}
              depth={depth + 1}
              handleVote={handleVote}
              processedBody={processedBody}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default CommentSection;
