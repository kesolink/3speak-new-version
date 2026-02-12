import PayoutAmount from "../PayoutAmount/PayoutAmount";
import UpvoteCount from "../UpvoteCount/UpvoteCount";
import ViewCount from "../ViewCount/ViewCount";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { IoCalendarOutline } from "react-icons/io5";
dayjs.extend(utc);
import { MdDelete, MdError, MdPhoneIphone } from "react-icons/md";
import { FaCog, FaFileAlt } from "react-icons/fa";
import AddToPlaylistButton from "../AddToPlaylistButton/AddToPlaylistButton";
import TimeAgo from "../TimeAgo/TimeAgo";
import { Link, useNavigate } from "react-router-dom";
import PropTypes from "prop-types";
import "./Cards.scss";
import { useState, useMemo } from "react";
import img from "../../assets/image/speak.jpg";
import { fixVideoThumbnail } from "../../utils/fixThumbnails";
import AuthorBadge from "../AuthorBadge/AuthorBadge";
import ProfileModal from "../modal/ProfileModal";
import useViewCounts from "../../hooks/useViewCounts";


function Card3({ videos = [], loading = false, error = null, getContentForVideo = null, isWatched = null, linkPrefix = '/watch', linkQuery = '' }) {
  const navigate = useNavigate();
  const [modalUser, setModalUser] = useState(null);
  const { getViewCount } = useViewCounts(videos);
  const formatViewCount = (views) => {
    if (views === null || views === undefined) return null;
    if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M`;
    if (views >= 1000) return `${(views / 1000).toFixed(1)}K`;
    return views.toLocaleString();
  };

  // Memoize video processing to prevent re-computing thumbnails on every render
  const processedVideos = useMemo(() => {
    return videos.map(video => ({
      ...video,
      _processedThumbnail: fixVideoThumbnail(video)
    }));
  }, [videos]);

  if (loading && videos.length === 0) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className="card-container">
      {processedVideos.map((video, index) => {
        const postKey = `${video.author?.username || video.author || video.owner}/${
          video.permlink
        }`;
        
        console.log('🟠 [Card3] Rendering video card:', { index, postKey });

        return (
          <Link
            to={`${linkPrefix}?v=${video.author?.username || video.author || video.owner}/${
              video.permlink
            }${linkQuery}`}
            className="card"
            // key={postKey}
            key={`${postKey}-${index}`}
          >
            {/* Thumbnail */}
            <div className="img-wrap">
              <img
                src={video._processedThumbnail}
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
                <div className="status-badge scheduled">
                  <IoCalendarOutline size={18} />
                  <span>
                    {video.publish_data
                      ? dayjs(typeof video.publish_data === 'number' ? video.publish_data * 1000 : video.publish_data).format('MMM D, h:mm A')
                      : 'Scheduled'}
                  </span>
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
              <AuthorBadge
                author={video.author?.username || video.author || video.owner}
                noLink
                compact
              />
              {getViewCount(video.author?.username || video.author || video.owner, video.permlink) !== null && (
                <ViewCount
                  views={getViewCount(video.author?.username || video.author || video.owner, video.permlink)}
                  watched={isWatched?.(video.author?.username || video.author || video.owner, video.permlink) === true}
                  formatViews={formatViewCount}
                />
              )}
            </div>

            {/* Bottom actions */}
            <div className="bottom-action">
              <div className="wrap-left">
                <PayoutAmount
                  amount={(() => {
                    const author = video.author?.username || video.author || video.owner;
                    const content = getContentForVideo?.(author, video.permlink);
                    const val = content?.payout ?? video.stats?.total_hive_reward;
                    return val != null ? Number(val) : null;
                  })()}
                />
                <UpvoteCount
                  count={(() => {
                    const author = video.author?.username || video.author || video.owner;
                    const content = getContentForVideo?.(author, video.permlink);
                    return content?.voters ?? video.stats?.num_votes ?? null;
                  })()}
                />
              </div>
              <p><TimeAgo date={video.created_at || video.created} short /></p>
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
  linkPrefix: PropTypes.string,
};

export default Card3;
