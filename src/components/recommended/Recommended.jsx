import "./Recommended.scss";
import PropTypes from "prop-types";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { LuTimer } from "react-icons/lu";
import { Link } from "react-router-dom";
import AuthorProfile from "../AuthorProfile/AuthorProfile";
import { fixVideoThumbnail } from "../../utils/fixThumbnails";

dayjs.extend(relativeTime);

function Recommended({suggestedVideos}) {
  const titleTextTruncate = (text, maxLength) =>
    text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;

  return (
    <div className="recommended">
      {suggestedVideos.map((data, index)=>{
        const author = data?.author?.username || data?.author?.id || data?.author || data?.owner;

        return (
          <Link
            to={`/watch?v=${author}/${data.permlink ?? "unknown"}`}
            key={`${author}-${data.permlink}-${index}`}
            className="side-video-link"
            data-tv-focusable="true"
            data-tv-index={index}
          >
            <div className="side-video-list">
              <div className="wrap-img">
                <img
                  src={fixVideoThumbnail(data)}
                  alt={data.title}
                />
              </div>
              <div className="vid-info">
                <h4>{titleTextTruncate(data.title, 56)}</h4>

                <AuthorProfile author={author} className="recommended-author" />

                <div className="bottom-info">
                  <div className="info-left">
                    <LuTimer />
                    <span>{dayjs(data.created_at).fromNow()}</span>
                  </div>
                  <div className="info-right">
                    ${data?.stats?.total_hive_reward?.toFixed(2) ?? "0.00"}
                  </div>
                </div>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

Recommended.propTypes = {
  suggestedVideos: PropTypes.arrayOf(
    PropTypes.shape({
      title: PropTypes.string.isRequired,
      spkvideo: PropTypes.shape({
        thumbnail_url: PropTypes.string
      }),
      author: PropTypes.oneOfType([
        PropTypes.string,
        PropTypes.shape({
          id: PropTypes.string,
          username: PropTypes.string
        })
      ]),
      permlink: PropTypes.string.isRequired,
      created_at: PropTypes.string.isRequired,
      stats: PropTypes.shape({
        total_hive_reward: PropTypes.number
      })
    })
  ).isRequired
};

export default Recommended;
