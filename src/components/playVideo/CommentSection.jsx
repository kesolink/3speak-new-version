import React, { useEffect, useState } from 'react';
import "./CommentSection.scss";
import { GiTwoCoins } from 'react-icons/gi';
import { BiDislike, BiLike } from 'react-icons/bi';
import { useQuery } from '@apollo/client';
import { GET_COMMENTS } from '../../graphql/queries';
import dayjs from 'dayjs';
import { useAppStore } from '../../lib/store';
import { renderPostBody } from "@ecency/render-helper";
import "./BlogContent.scss"
// import { Client } from "@hiveio/dhive";

function CommentSection({ videoDetails, author, permlink }) {
  // const client = new Client("https://api.hive.blog");

  // async function getComments(author, permlink) {
  //   try {
  //     const comments = await client.call("condenser_api", "get_content_replies", [author, permlink]);
  
  //     console.log("Comments:", comments);
  //     return comments;
  //   } catch (error) {
  //     console.error("Error fetching comments:", error);
  //     return [];
  //   }
  // }
  // getComments(author, permlink);




  const { data, loading, error, refetch } = useQuery(GET_COMMENTS, {
    variables: { author, permlink },
  });

  const { user } = useAppStore();
  const [commentInfo, setCommentInfo] = useState("");
  const [activeReply, setActiveReply] = useState(null);
  const [singleData, setSingleData] = useState(null);
  const [openTooltip, setOpenToolTip] = useState(false)
  const [tooltipVoters, setTooltipVoters] = useState([]);
  const commentData = data?.socialPost?.children || [];
  // console.log("commentData=====>", commentData)
  const [renderedContent, setRenderedContent] = useState(null);



  const processedBody = (content) => {
    if (!content) return ""; // Ensure there's content before processing
  
    // console.log("Raw content:", content);
  
    // Convert to HTML using @ecency/render-helper
    const renderedHTML = renderPostBody(content, false);
    // console.log("Rendered HTML:", renderedHTML);
  
    return renderedHTML; // Directly return the processed HTML
  };

  const handlePostComment = () => {
    if (!singleData) return;
    const parent_permlink = singleData.permlink;
    const parent_author = singleData.author.username;
    const permlinks = `re-${parent_permlink}-${Date.now()}`;

    if (window.hive_keychain) {
      window.hive_keychain.requestBroadcast(
        user,
        [
          [
            "comment",
            {
              parent_author,
              parent_permlink,
              author: user,
              permlink: permlinks,
              weight: 10000,
              title: "",
              body: commentInfo,
              json_metadata: "{\"app\":\"3speak/new-version\"}",
              __config: { "originalBody": null, "comment_options": {} },
            },
          ],
        ],
        "Posting",
        async(response) => {
          if (response.success) {
            setCommentInfo("")
            setActiveReply(null)
            // alert("Comment posted successfully!");
            await refetch();
            
          } else {
            alert(`Comment failed: ${response.message}`);
          }
        }
      );
    } else {
      alert("Hive Keychain is not installed. Please install the extension.");
    }
  };


  const handleVote = (username, permlink, weight = 10000) => {
    if (window.hive_keychain) {
      // const [author, postPermlink] = permlink.split("/"); // Split permlink into author and postPermlink
      window.hive_keychain.requestBroadcast(
        user,
        [
          [
            "vote",
            {
              voter: user,
              author: username,
              permlink,
              weight, // 10000 = 100%, 5000 = 50%
            },
          ],
        ],
        "Posting",
        (response) => {
          if (response.success) {
            alert("Vote successful!");
          } else {
            alert(`Vote failed: ${response.message}`);
          }
        }
      );
    } else {
      alert("Hive Keychain is not installed. Please install the extension.");
    }
  };
// console.log(videoDetails)
  return (
    <div className="vid-comment-wrap">
      <h4>{videoDetails?.stats.num_comments} Comments</h4>
      {commentData.map((comment, index) => (
        <Comment
          key={index}
          comment={comment}
          activeReply={activeReply}
          setActiveReply={setActiveReply}
          setCommentInfo={setCommentInfo}
          commentInfo={commentInfo}
          setSingleData={setSingleData}
          handlePostComment={handlePostComment}
          depth={0} // Track nesting level
          handleVote={handleVote}
          processedBody={processedBody}
        />
      ))}
    </div>
  );
}

// Recursive Comment Component for Nested Replies
function Comment({ comment, activeReply, setActiveReply, processedBody, setCommentInfo, commentInfo, setSingleData, handlePostComment, depth, handleVote }) {
  return (
    <div className="comment-container" style={{ marginLeft: depth > 0 ? "40px" : "0px" }}>
      <div className="comment">
        <img src={comment?.author?.profile?.images?.avatar || 'https://via.placeholder.com/40'} alt="Author Avatar" />
        <div>
          <h3>
            {comment?.author?.username}
            <span >{dayjs(comment?.created_at).fromNow()}</span>
          </h3>
          <p className="markdown-view" dangerouslySetInnerHTML={{ __html: processedBody(comment?.body || "") }} />
          <div className="comment-action">
            <div className="wrap"><BiLike onClick={()=> {handleVote(comment?.author?.username, comment.permlink);}} /> <span>{comment?.stats?.num_likes ?? 0}</span></div>
            <div className="wrap"><BiDislike /> <span>{comment?.stats?.num_dislikes ?? 0}</span></div>
            <div className="wrap"><GiTwoCoins /> <span>${comment?.stats?.total_hive_reward?.toFixed(2) ?? '0.00'}</span></div>
            <span className="main-reply" onClick={() => { setActiveReply(comment.permlink); setSingleData(comment); }}>Reply</span>
          </div>
        </div>
      </div>

      {/* Reply Input Box */}
      {activeReply === comment.permlink && (
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

      {/* Render nested replies recursively */}
      {comment.children && comment.children.length > 0 && (
        <div className="nested-comments">
          {comment.children.map((childComment, index) => (
            <Comment
              key={index}
              comment={childComment}
              activeReply={activeReply}
              setActiveReply={setActiveReply}
              setCommentInfo={setCommentInfo}
              commentInfo={commentInfo}
              setSingleData={setSingleData}
              handlePostComment={handlePostComment}
              depth={depth + 1} // Increase depth for indentation
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
