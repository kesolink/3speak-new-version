import PropTypes from "prop-types";
import "./PlayVideo.scss";
import { FaEye } from "react-icons/fa";
import { LuTimer } from "react-icons/lu";
import { BiDislike, BiLike } from "react-icons/bi";
import { GiTwoCoins } from "react-icons/gi";
import { useEffect, useState } from "react";
import { useQuery } from "@apollo/client";
import {
  GET_PROFILE,
  GET_TOTAL_COUNT_OF_FOLLOWING,
  GET_VIDEO,
} from "../../graphql/queries";
// import ReactJWPlayer from "react-jw-player";
import JWPlayer from "@jwplayer/jwplayer-react";
import dayjs from "dayjs";
import BlogContent from "./BlogContent";
import CommentSection from "./CommentSection";
import { useAppStore } from '../..//lib/store';
import { MdPeople } from "react-icons/md";
import { getUersContent } from "../../utils/hiveUtils";
import ToolTip from "../tooltip/ToolTip";
import { ImSpinner9 } from "react-icons/im";
import { useNavigate } from "react-router-dom";
import BarLoader from "../Loader/BarLoader";
import TipModal from "../../components/tip-reward/TipModal"

const PlayVideo = ({ videoDetails, author, permlink }) => {
  const { user } = useAppStore();
  const [commentData, setCommentData] = useState("");
  const [openTooltip, setOpenToolTip] = useState(false);
  const [tooltipVoters, setTooltipVoters] = useState([]);
  const [voted, setVoted] = useState(null)
  const [isTipModalOpen, setIsTipModalOpen] = useState(false);
  const navigate = useNavigate();

  // Define getTooltipVoters BEFORE useEffect
  const getTooltipVoters = async () => {
    try {
      const data = await getUersContent(author, permlink);
      if (!data) {
        console.log("Post not found");
        return [];
      }

      if (data.active_votes )

      console.log(data)
      // 9126375037

      const topVotes = data.active_votes
        .sort((a, b) => parseInt(b.rshares) - parseInt(a.rshares))
        .slice(0, 10)
        .map(vote => ({
          username: vote.voter,
          reward: parseFloat(vote.rshares) / 1e12 // Simplified reward estimation
        }));

      console.log(topVotes);
      setTooltipVoters(topVotes);
    } catch (error) {
      console.error("Error fetching upvotes:", error);
      return [];
    }
  };

  // Call getTooltipVoters in useEffect
  useEffect(() => {
    getTooltipVoters();
  }, [author, permlink]); // Add author and permlink as dependencies

  const handlePostComment = () => {
    const parent_permlink = permlink;
    const permlinks = `re-${parent_permlink}-${Date.now()}`;
    if (window.hive_keychain) {
      window.hive_keychain.requestBroadcast(
        user,
        [
          [
            "comment",
            {
              parent_author: author,
              parent_permlink,
              author: user,
              permlink: permlinks,
              weight: 10000,
              title: "",
              body: commentData,
              json_metadata: "{\"app\":\"3speak/new-version\"}",
              __config: { originalBody: null, comment_options: {} },
            },
          ],
        ],
        "Posting",
        (response) => {
          if (response.success) {
            alert("Comment successful!");
          } else {
            alert(`Comment failed: ${response.message}`);
          }
        }
      );
    } else {
      alert("Hive Keychain is not installed. Please install the extension.");
    }
  };

  const {
    data: getVideo,
    loading,
    error,
  } = useQuery(GET_VIDEO, { variables: { author, permlink }, ssr: true });
  const spkvideo = getVideo?.socialPost.spkvideo;
  const [videoUrlSelected, setVideoUrlSelected] = useState(null);

  const { data: followData, loading: followLoading } = useQuery(
    GET_TOTAL_COUNT_OF_FOLLOWING,
    {
      variables: { id: videoDetails?.author?.id || "" },
    }
  );

  const getUserProfile = useQuery(GET_PROFILE, {
    variables: { id: videoDetails?.author?.id },
  });

  const profile = getUserProfile.data?.profile;
  const content = videoDetails?.body.split("\n");
  const tags = videoDetails?.tags?.slice(0, 7);
  const comunity_name = videoDetails?.community?.title;

  useEffect(() => {
    if (spkvideo?.play_url) {
      const url = spkvideo.play_url;
      const result = url.includes("ipfs://")
        ? url.split("ipfs://")[1] // Extract the IPFS hash
        : url;
      console.log(result);
      setVideoUrlSelected(`https://ipfs-3speak.b-cdn.net/ipfs/${result}`);
    }
  }, [spkvideo]);

  if (loading) {
    return <BarLoader />;
  }

  const handleVote = (username, permlink, weight = 10000) => {
    if (window.hive_keychain) {
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
  const handleSelectTag = (tag) => {
    console.log(tag)
    navigate(`/t/${tag}`);
  };

  // console.log(videoDetails);

  // const handleSendTip = (amount: string, currency: string, memo: string) => {
  //   console.log("Sending tip:", { amount, currency, memo });
  //   // Implement your tip sending logic here
  // };

  return (
    <>
    <div className="play-video">
      <div className="top-container">
{videoUrlSelected ? (
    <JWPlayer
      library="https://cdn.jwplayer.com/libraries/HT7Dts3H.js" // Updated library
      licenseKey={import.meta.env.VITE_JWPLAYER_LICENSE_KEY} // Verify key validity
      playlist={[
        {
          file: videoUrlSelected,
          image: spkvideo?.thumbnail_url,
        },
      ]}
      playbackRateControls={true}
      autostart={false}
      aspectRatio="16:9"
      customProps={{
        hlsjsConfig: {
          debug: true, // Enable HLS.js debugging
          capLevelToPlayerSize: true, // Auto quality adjustment
        },
      }}
    />
  ) : (
    <div className="video-loader">
      <ImSpinner9 className="spinner" />
    </div>
  )}

        <h3>{videoDetails?.title}</h3>
        <div className="tag-wrapper">
          {tags.map((tags, index) => (
            <span key={index} onClick={()=>handleSelectTag(tags)}>{tags}</span>
          ))}
        </div>
        <div className="community-title-wrap">
          <MdPeople />
          <span>{comunity_name}</span>
        </div>
        <div className="play-video-info">
          <div className="wrap-left">
            <div className="wrap">
              <FaEye />
              <span>23</span>
            </div>
            <div className="wrap">
              <LuTimer />
              <span>{dayjs(videoDetails?.created_at).fromNow()}</span>
            </div>
          </div>
          <div className="wrap-right">
            <span className="wrap">
              <BiLike className="icon" onClick={() => { handleVote(author, permlink) }} />
              <div className="amount" onMouseEnter={() => setOpenToolTip(true)} onMouseLeave={() => setOpenToolTip(false)}>{videoDetails?.stats.num_votes}</div>
              {openTooltip && <ToolTip tooltipVoters={tooltipVoters} />}
            </span>

            <span className="wrap">
              <BiDislike className="icon" />
              <span>0</span>
            </span>
            <span className="wrap">
              <GiTwoCoins className="icon" />
              <span>${videoDetails?.stats.total_hive_reward.toFixed(2)}</span>
            </span>
            {/* <span>Reply</span> */}
            <button className="tip-btn" onClick={() => setIsTipModalOpen(true)}>Tip</button>
          </div>
        </div>
      </div>

      <div className="big-mid-wrap"></div>
      <div className="publisher">
        <img src={profile?.images?.avatar} alt="" />
        <div>
          <p>{videoDetails?.author?.id}</p>
          <span>{followData?.follows?.followers_count} Followers</span>
        </div>
        <button>Follow</button>
      </div>

      <div className="description-wrap">
        <div className="blog-content">
          <BlogContent author={author} permlink={permlink} />
        </div>
      </div>

      <div className="add-comment-wrap">
        <span>Reply:</span>
        <textarea
          className="textarea-box"
          value={commentData}
          onChange={(e) => setCommentData(e.target.value)}
          placeholder="Write your comment here..."
        />
        <div className="btn-wrap">
          <button onClick={handlePostComment}>Comment</button>
        </div>
      </div>

      <CommentSection
        videoDetails={videoDetails}
        author={author}
        permlink={permlink}
      />
    </div>
    {isTipModalOpen && <TipModal
    recipient={author}
    isOpen={isTipModalOpen}
    onClose={() => setIsTipModalOpen(false)}
    // onSendTip={handleSendTip}
     />}
    </>
  );
};

PlayVideo.propTypes = {
  videoDetails: PropTypes.shape({
    title: PropTypes.string.isRequired,
    description: PropTypes.string,
    thumbnail_url: PropTypes.string,
    body: PropTypes.string,
    stats: PropTypes.shape({
      num_votes: PropTypes.number,
      total_hive_reward: PropTypes.number,
      num_comments: PropTypes.number,
    }),
    author: PropTypes.shape({
      follower_count: PropTypes.number,
      id: PropTypes.string,
    }),
    comments: PropTypes.arrayOf(
      PropTypes.shape({
        id: PropTypes.number,
        author: PropTypes.string,
        text: PropTypes.string,
        date: PropTypes.string,
        likes: PropTypes.number,
        dislikes: PropTypes.number,
        reward: PropTypes.number,
      })
    ),
  }),
  author: PropTypes.string.isRequired,
  permlink: PropTypes.string.isRequired,
};

export default PlayVideo;