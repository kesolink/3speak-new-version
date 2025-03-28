import "./Recommended.scss";
import PropTypes from "prop-types";
import dayjs from "dayjs";
import { FaEye } from "react-icons/fa";
import { LuTimer } from "react-icons/lu";
import { Link } from "react-router-dom";

function Recommended({suggestedVideos}) {

  console.log(suggestedVideos)
  console.log('Image URL:', suggestedVideos?.spkvideo?.thumbnail_url);

  const titleTextTruncate = (text, maxLength) =>
    text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
  return (
    <div className="recommended">
      {suggestedVideos.map((data, index)=>(
        <Link to={`/watch?v=${data?.author?.username}/${data.permlink ?? "unknown"}`} 
        key={index}  >
        <div className="side-video-list" key={index}>
        <div className="wrap-img">
        <img src={`https://images.hive.blog/320x0/${
                data.spkvideo?.thumbnail_url ?? ""
              }`} alt="" />
        {/* <span>02.54</span> */}
        </div>
        <div className="vid-info">
          <h4>{titleTextTruncate(data.title, 56)}</h4>
          <div className="profile-wrap"><img src={data?.author?.profile?.images?.avatar} alt="" /><p>{data.author.id}</p></div>
          <div className="wrap">
            <div className="wrap-left">
              <div className="wrap">
                <LuTimer />
                <span>{dayjs(data.created_at).fromNow()}</span>
              </div>
            </div>
            <div className="wrap-right">
            ${data?.stats?.total_hive_reward.toFixed(2) ?? "0.00"}
            </div>
          </div>
        </div>
      </div>
      </Link>
      
      ))}
      
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
      author: PropTypes.shape({
        id: PropTypes.string.isRequired,
        profile: PropTypes.shape({
          images: PropTypes.shape({
            avatar: PropTypes.string.isRequired
          })
        })
      }),
      created_at: PropTypes.string.isRequired,
      stats: PropTypes.shape({
        total_hive_reward: PropTypes.number
      })
    })
  ).isRequired
};

export default Recommended;
