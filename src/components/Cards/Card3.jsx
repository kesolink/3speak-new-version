import { IoChevronUpCircleOutline } from "react-icons/io5";
import { IoEyeOutline } from "react-icons/io5";
import { IoCalendarOutline } from "react-icons/io5";
import { MdDelete, MdError, MdPhoneIphone } from "react-icons/md";
import { FaCog, FaFileAlt } from "react-icons/fa";
import AddToPlaylistButton from "../AddToPlaylistButton/AddToPlaylistButton";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { Link, useNavigate } from "react-router-dom";
import { FaHeart } from "react-icons/fa";
import PropTypes from "prop-types";
import "./Cards.scss";
import { useEffect, useState } from "react";
import img from "../../assets/image/speak.jpg";
import { fixVideoThumbnail } from "../../utils/fixThumbnails";
import ProfileModal from "../modal/ProfileModal";
import useViewCounts from "../../hooks/useViewCounts";

dayjs.extend(relativeTime);

function Card3({ videos = [], loading = false, error = null, getContentForVideo = null, isWatched = null }) {
  const navigate = useNavigate();
  const [modalUser, setModalUser] = useState(null);
  const { getViewCount } = useViewCounts(videos);
  const [showTooltip, setShowTooltip] = useState(false);

  const formatViewCount = (views) => {
    if (views === null || views === undefined) return null;
    if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M`;
    if (views >= 1000) return `${(views / 1000).toFixed(1)}K`;
    return views.toLocaleString();
  };

  useEffect(() => {
  const close = () => setShowTooltip(false);
  window.addEventListener("click", close);
  return () => window.removeEventListener("click", close);
}, []);



  if (loading && videos.length === 0) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className="card-container">
      {videos.map((video, index) => {
        const postKey = `${video.author?.username || video.author || video.owner}/${
          video.permlink
        }`;

        return (
          <Link
            to={`/watch?v=${video.author?.username || video.author || video.owner}/${
              video.permlink
            }`}
            className="card"
            // key={postKey}
            key={`${postKey}-${index}`}
          >
            {/* Thumbnail */}
            <div className="img-wrap">
              <img
                // src={video.images?.thumbnail}
                src={fixVideoThumbnail(video)}
                // src={video.images?.thumbnail || img}
                alt="thumbnail"
                onError={(e) => (e.currentTarget.src = img)}
                loading="lazy"
              />
              <div className="wrap">
                <span className="play">
                  {Math.floor((video.spkvideo?.duration || video.duration) / 60)}:
                  {Math.floor((video.spkvideo?.duration || video.duration) % 60)
                    .toString()
                    .padStart(2, "0")}
                </span>
              </div>

              {/* Add to Playlist Button */}
              <AddToPlaylistButton
                author={video.author?.username || video.author || video.owner}
                permlink={video.permlink}
                title={video.title}
              />

              {/* Status Badges */}
              {video.status === 'scheduled' && video.publish_type === 'schedule' && (
                <div
                  className="status-badge scheduled"
                  onMouseEnter={() => setShowTooltip(true)}
                  onMouseLeave={() => setShowTooltip(false)}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowTooltip((prev) => !prev);
                  }}
                >
                  <IoCalendarOutline size={18} />
                  <span>Scheduled</span>

                  {showTooltip && (
                    <div className="schedule-tooltip">
                      Scheduled for <br />
                      <strong>
                        {dayjs(video.publish_data?.scheduled_at).format(
                          "MMM D, YYYY h:mm A"
                        )}
                      </strong>
                    </div>
                  )}
                </div>

              )}

              {video.publish_type === 'publish_manual' && (
                <div className="status-badge manual" title="Uploaded via mobile app">
                  <MdPhoneIphone size={18} />
                  <span>Mobile</span>
                </div>
              )}

              {video.status === 'encoding' && (
                <div className="status-badge encoding" title="Video is being processed">
                  <FaCog size={16} className="spin-icon" />
                  <span>Processing</span>
                </div>
              )}

              {video.status === 'draft' && (
                <div className="status-badge draft" title="Draft - not published yet">
                  <FaFileAlt size={16} />
                  <span>Draft</span>
                </div>
              )}

              {video.status === 'deleted' && (
                <div className="status-badge deleted" title="This video has been deleted">
                  <MdDelete size={18} />
                  <span>Deleted</span>
                </div>
              )}

              {video.status === 'failed' && (
                <div className="status-badge failed" title="Video processing failed">
                  <MdError size={18} />
                  <span>Failed</span>
                </div>
              )}
            </div>

            {/* Title */}
            <h2>{video.title}</h2>

            {/* Author */}
            <div className="profile-view-wrap">
                <div
                  className="profile-wrapper"
                  role="link"
                  tabIndex={0}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    navigate(`/p/${video.author?.username || video.author || video.owner}`);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      e.stopPropagation();
                      navigate(`/p/${video.author?.username || video.author || video.owner}`);
                    }
                  }}
                >
                  <img
                    className="profile-img"
                    src={`https://images.hive.blog/u/${
                      video.author?.username || video.author || video.owner
                    }/avatar`}
                    alt=""
                  />
                  <h2
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setModalUser(video.author?.username || video.author || video.owner);
                    }}
                  >
                    {video.author?.username || video.author || video.owner}
                  </h2>

                </div>
              {getViewCount(video.author?.username || video.author || video.owner, video.permlink) !== null && (
                <div className={`view-count${isWatched?.(video.author?.username || video.author || video.owner, video.permlink) === true ? ' watched' : ''}`}>
                  <IoEyeOutline size={14} />
                  <span>{formatViewCount(getViewCount(video.author?.username || video.author || video.owner, video.permlink))}</span>
                </div>
              )}
            </div>

            {/* Bottom actions */}
            <div className="bottom-action">
              <div className="wrap-left">
                <div className="wrap flex-div">
                  <IoChevronUpCircleOutline className="icon" />
                  <span>
                    ${(() => {
                      const author = video.author?.username || video.author || video.owner;
                      const content = getContentForVideo?.(author, video.permlink);
                      return content?.payout ?? video.stats?.total_hive_reward?.toFixed(2) ?? "…";
                    })()}
                  </span>
                </div>

                <div className="wrap flex-div">
                  <FaHeart className="icon-heart" />
                  <span>
                    {(() => {
                      const author = video.author?.username || video.author || video.owner;
                      const content = getContentForVideo?.(author, video.permlink);
                      return content?.voters ?? video.stats?.num_votes ?? "…";
                    })()}
                  </span>
                </div>
              </div>
              <p>{dayjs(video.created_at || video.created).fromNow()}</p>
            </div>
          </Link>
        );
      })}
      {modalUser && (
        <ProfileModal
          username={modalUser}
          onClose={() => setModalUser(null)}
        />
      )}
    </div>
  );
}

Card3.propTypes = {
  videos: PropTypes.array.isRequired,
  loading: PropTypes.bool,
  error: PropTypes.string,
  getContentForVideo: PropTypes.func,
  isWatched: PropTypes.func,
};

export default Card3;
