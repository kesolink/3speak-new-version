
import "./Feed.scss"

// import thumb1 from "../../assets/image/thumb01.jfif"
// import thumb2 from "../../assets/image/thumb02.jfif"
// import thumb3 from "../../assets/image/thumb03.jfif"
// import thumb4 from "../../assets/image/thumb04.jfif"
// import thumb5 from "../../assets/image/thumb05.jfif"
// import thumb6 from "../../assets/image/thumb06.jfif"
// import thumb7 from "../../assets/image/thumb07.jfif"
// import thumb8 from "../../assets/image/thumb08.jfif"
// import thumb9 from "../../assets/image/thumb09.jfif"
// import thumb10 from "../../assets/image/thumb10.jfif"
// import user_img from "../../assets/image/user-img.avif"
import { Link } from "react-router-dom"
import { IoChevronUpCircleOutline } from "react-icons/io5"
import { GiEternalLove } from "react-icons/gi"
// import { FaComment, FaRetweet, FaVideo } from "react-icons/fa"
import CommunitiesTags from "../communities-tags/CommunitiesTags"
import { useEffect, useState } from "react"
import Auth_modal from "../modal/Auth_modal"
import { has3SpeakPostAuth } from '../../utils/hiveUtils';
import { useAppStore } from '../../lib/store';
import CardSkeleton from "../Cards/CardSkeleton"
import { useQuery } from "@apollo/client"
import { LATEST_FEED } from "../../graphql/queries"
import Cards from "../Cards/Cards"
function Feed() {
  const [isOpen, setIsOpen] = useState(false)
  const {user} = useAppStore();

  useEffect(()=>{
    checkPostAuth(user);
  },[])

  const { data, loading, error } = useQuery(LATEST_FEED);
  const videos = data?.feed?.items || [];
  console.log(videos)
  // console.log(JSON.stringify(data.feed.items, null, 2));

  const toggleUploadModal = ()=>{
    setIsOpen( (prev)=> !prev)
  }

    async function checkPostAuth(username) {
      const hasAuth = await has3SpeakPostAuth(username);
      if (!hasAuth) {
        setIsOpen(true);
      }
    }

    // console.log(data);

  return (
    <>
    <>
    <CommunitiesTags />

    {loading ? 
        <CardSkeleton /> :
        <Cards videos={videos} loading={loading} error={error} className="custom-video-feed" />
      }

    {/* <div className="feed">
      <Link to={`video/20/4521`} className="card">
        <div className="img-wrap">
          <img src={thumb1} alt="" />
          <div className="wrap">
            <div className="user-wrap flex-div">
              <img src={user_img} alt="" /> <span>kesolink</span>
            </div>
            <span className="play">10.45</span>
          </div>
          <div className="buttom-title">
            <p>hello this is kesolink</p>
          </div>
        </div>
        <h2>
          Best in 3speak channel video creation is kesolink. we vlog for fun and
          we are happy about that.
        </h2>
        <h3>Vibes</h3>
        <div className="bottom-action">
            <div className="wrap-left">
            <div className="wrap flex-div">
            <IoChevronUpCircleOutline className="icon" />
            <span>$12.6</span>
            </div>
            <span>|</span>
            <div className="wrap flex-div">
            <GiEternalLove className="icon" />
            <span>101</span>
            </div>
            </div>
            <p> 2 days ago</p>
        </div>
      </Link>
      <Link to={`video/20/4521`} className="card">
        <div className="img-wrap">
          <img src={thumb2} alt="" />
          <div className="wrap">
            <div className="user-wrap flex-div">
              <img src={user_img} alt="" /> <span>kesolink</span>
            </div>
            <span className="play">10.45</span>
          </div>
          <div className="buttom-title">
            <p>hello this is kesolink</p>
          </div>
        </div>
        <h2>
          Best in 3speak channel video creation is kesolink. we vlog for fun and
          we are happy about that.
        </h2>
        <h3>Music</h3>
        <div className="bottom-action">
            <div className="wrap-left">
            <div className="wrap flex-div">
            <IoChevronUpCircleOutline className="icon" />
            <span>$12.6</span>
            </div>
            <span>|</span>
            <div className="wrap flex-div">
            <GiEternalLove className="icon" />
            <span>101</span>
            </div>
            </div>
            <p> 2 days ago</p>
        </div>
      </Link>
      <Link to={`video/20/4521`} className="card">
        <div className="img-wrap">
          <img src={thumb3} alt="" />
          <div className="wrap">
            <div className="user-wrap flex-div">
              <img src={user_img} alt="" /> <span>kesolink</span>
            </div>
            <span className="play">10.45</span>
          </div>
          <div className="buttom-title">
            <p>hello this is kesolink</p>
          </div>
        </div>
        <h2>
          Best in 3speak channel video creation is kesolink. we vlog for fun and
          we are happy about that.
        </h2>
        <h3>GreatStack</h3>
        <div className="bottom-action">
            <div className="wrap-left">
            <div className="wrap flex-div">
            <IoChevronUpCircleOutline className="icon" />
            <span>$12.6</span>
            </div>
            <span>|</span>
            <div className="wrap flex-div">
            <GiEternalLove className="icon" />
            <span>101</span>
            </div>
            </div>
            <p> 2 days ago</p>
        </div>
      </Link>
      <Link to={`video/20/4521`} className="card">
        <div className="img-wrap">
          <img src={thumb4} alt="" />
          <div className="wrap">
            <div className="user-wrap flex-div">
              <img src={user_img} alt="" /> <span>kesolink</span>
            </div>
            <span className="play">10.45</span>
          </div>
          <div className="buttom-title">
            <p>hello this is kesolink</p>
          </div>
        </div>
        <h2>
          Best in 3speak channel video creation is kesolink. we vlog for fun and
          we are happy about that.
        </h2>
        <h3>GreatStack</h3>
        <div className="bottom-action">
            <div className="wrap-left">
            <div className="wrap flex-div">
            <IoChevronUpCircleOutline className="icon" />
            <span>$12.6</span>
            </div>
            <span>|</span>
            <div className="wrap flex-div">
            <GiEternalLove className="icon" />
            <span>101</span>
            </div>
            </div>
            <p> 2 days ago</p>
        </div>
      </Link>
      <Link to={`video/20/4521`} className="card">
        <div className="img-wrap">
          <img src={thumb5} alt="" />
          <div className="wrap">
            <div className="user-wrap flex-div">
              <img src={user_img} alt="" /> <span>kesolink</span>
            </div>
            <span className="play">10.45</span>
          </div>
          <div className="buttom-title">
            <p>hello this is kesolink</p>
          </div>
        </div>
        <h2>
          Best in 3speak channel video creation is kesolink. we vlog for fun and
          we are happy about that.
        </h2>
        <h3>GreatStack</h3>
        <div className="bottom-action">
            <div className="wrap-left">
            <div className="wrap flex-div">
            <IoChevronUpCircleOutline className="icon" />
            <span>$12.6</span>
            </div>
            <span>|</span>
            <div className="wrap flex-div">
            <GiEternalLove className="icon" />
            <span>101</span>
            </div>
            </div>
            <p> 2 days ago</p>
        </div>
      </Link>
      <Link to={`video/20/4521`} className="card">
        <div className="img-wrap">
          <img src={thumb6} alt="" />
          <div className="wrap">
            <div className="user-wrap flex-div">
              <img src={user_img} alt="" /> <span>kesolink</span>
            </div>
            <span className="play">10.45</span>
          </div>
          <div className="buttom-title">
            <p>hello this is kesolink</p>
          </div>
        </div>
        <h2>
          Best in 3speak channel video creation is kesolink. we vlog for fun and
          we are happy about that.
        </h2>
        <h3>GreatStack</h3>
        <div className="bottom-action">
            <div className="wrap-left">
            <div className="wrap flex-div">
            <IoChevronUpCircleOutline className="icon" />
            <span>$12.6</span>
            </div>
            <span>|</span>
            <div className="wrap flex-div">
            <GiEternalLove className="icon" />
            <span>101</span>
            </div>
            </div>
            <p> 2 days ago</p>
        </div>
      </Link>
      <Link to={`video/20/4521`} className="card">
        <div className="img-wrap">
          <img src={thumb7} alt="" />
          <div className="wrap">
            <div className="user-wrap flex-div">
              <img src={user_img} alt="" /> <span>kesolink</span>
            </div>
            <span className="play">10.45</span>
          </div>
          <div className="buttom-title">
            <p>hello this is kesolink</p>
          </div>
        </div>
        <h2>
          Best in 3speak channel video creation is kesolink. we vlog for fun and
          we are happy about that.
        </h2>
        <h3>GreatStack</h3>
        <div className="bottom-action">
            <div className="wrap-left">
            <div className="wrap flex-div">
            <IoChevronUpCircleOutline className="icon" />
            <span>$12.6</span>
            </div>
            <span>|</span>
            <div className="wrap flex-div">
            <GiEternalLove className="icon" />
            <span>101</span>
            </div>
            </div>
            <p> 2 days ago</p>
        </div>
      </Link>
      <Link to={`video/20/4521`} className="card">
        <div className="img-wrap">
          <img src={thumb1} alt="" />
          <div className="wrap">
            <div className="user-wrap flex-div">
              <img src={user_img} alt="" /> <span>kesolink</span>
            </div>
            <span className="play">10.45</span>
          </div>
          <div className="buttom-title">
            <p>hello this is kesolink</p>
          </div>
        </div>
        <h2>
          Best in 3speak channel video creation is kesolink. we vlog for fun and
          we are happy about that.
        </h2>
        <h3>GreatStack</h3>
        <div className="bottom-action">
            <div className="wrap-left">
            <div className="wrap flex-div">
            <IoChevronUpCircleOutline className="icon" />
            <span>$12.6</span>
            </div>
            <span>|</span>
            <div className="wrap flex-div">
            <GiEternalLove className="icon" />
            <span>101</span>
            </div>
            </div>
            <p> 2 days ago</p>
        </div>
      </Link>
      <Link to={`video/20/4521`} className="card">
        <div className="img-wrap">
          <img src={thumb2} alt="" />
          <div className="wrap">
            <div className="user-wrap flex-div">
              <img src={user_img} alt="" /> <span>kesolink</span>
            </div>
            <span className="play">10.45</span>
          </div>
          <div className="buttom-title">
            <p>hello this is kesolink</p>
          </div>
        </div>
        <h2>
          Best in 3speak channel video creation is kesolink. we vlog for fun and
          we are happy about that.
        </h2>
        <h3>GreatStack</h3>
        <div className="bottom-action">
            <div className="wrap-left">
            <div className="wrap flex-div">
            <IoChevronUpCircleOutline className="icon" />
            <span>$12.6</span>
            </div>
            <span>|</span>
            <div className="wrap flex-div">
            <GiEternalLove className="icon" />
            <span>101</span>
            </div>
            </div>
            <p> 2 days ago</p>
        </div>
      </Link>
      <Link to={`video/20/4521`} className="card">
        <div className="img-wrap">
          <img src={thumb3} alt="" />
          <div className="wrap">
            <div className="user-wrap flex-div">
              <img src={user_img} alt="" /> <span>kesolink</span>
            </div>
            <span className="play">10.45</span>
          </div>
          <div className="buttom-title">
            <p>hello this is kesolink</p>
          </div>
        </div>
        <h2>
          Best in 3speak channel video creation is kesolink. we vlog for fun and
          we are happy about that.
        </h2>
        <h3>GreatStack</h3>
        <div className="bottom-action">
            <div className="wrap-left">
            <div className="wrap flex-div">
            <IoChevronUpCircleOutline className="icon" />
            <span>$12.6</span>
            </div>
            <span>|</span>
            <div className="wrap flex-div">
            <GiEternalLove className="icon" />
            <span>101</span>
            </div>
            </div>
            <p> 2 days ago</p>
        </div>
      </Link>
      <Link to={`video/20/4521`} className="card">
        <div className="img-wrap">
          <img src={thumb4} alt="" />
          <div className="wrap">
            <div className="user-wrap flex-div">
              <img src={user_img} alt="" /> <span>kesolink</span>
            </div>
            <span className="play">10.45</span>
          </div>
          <div className="buttom-title">
            <p>hello this is kesolink</p>
          </div>
        </div>
        <h2>
          Best in 3speak channel video creation is kesolink. we vlog for fun and
          we are happy about that.
        </h2>
        <h3>GreatStack</h3>
        <div className="bottom-action">
            <div className="wrap-left">
            <div className="wrap flex-div">
            <IoChevronUpCircleOutline className="icon" />
            <span>$12.6</span>
            </div>
            <span>|</span>
            <div className="wrap flex-div">
            <GiEternalLove className="icon" />
            <span>101</span>
            </div>
            </div>
            <p> 2 days ago</p>
        </div>
      </Link>
      <Link to={`video/20/4521`} className="card">
        <div className="img-wrap">
          <img src={thumb5} alt="" />
          <div className="wrap">
            <div className="user-wrap flex-div">
              <img src={user_img} alt="" /> <span>kesolink</span>
            </div>
            <span className="play">10.45</span>
          </div>
          <div className="buttom-title">
            <p>hello this is kesolink</p>
          </div>
        </div>
        <h2>
          Best in 3speak channel video creation is kesolink. we vlog for fun and
          we are happy about that.
        </h2>
        <h3>GreatStack</h3>
        <div className="bottom-action">
            <div className="wrap-left">
            <div className="wrap flex-div">
            <IoChevronUpCircleOutline className="icon" />
            <span>$12.6</span>
            </div>
            <span>|</span>
            <div className="wrap flex-div">
            <GiEternalLove className="icon" />
            <span>101</span>
            </div>
            </div>
            <p> 2 days ago</p>
        </div>
      </Link>
      <Link to={`video/20/4521`} className="card">
        <div className="img-wrap">
          <img src={thumb6} alt="" />
          <div className="wrap">
            <div className="user-wrap flex-div">
              <img src={user_img} alt="" /> <span>kesolink</span>
            </div>
            <span className="play">10.45</span>
          </div>
          <div className="buttom-title">
            <p>hello this is kesolink</p>
          </div>
        </div>
        <h2>
          Best in 3speak channel video creation is kesolink. we vlog for fun and
          we are happy about that.
        </h2>
        <h3>GreatStack</h3>
        <div className="bottom-action">
            <div className="wrap-left">
            <div className="wrap flex-div">
            <IoChevronUpCircleOutline className="icon" />
            <span>$12.6</span>
            </div>
            <span>|</span>
            <div className="wrap flex-div">
            <GiEternalLove className="icon" />
            <span>101</span>
            </div>
            </div>
            <p> 2 days ago</p>
        </div>
      </Link>
      <Link to={`video/20/4521`} className="card">
        <div className="img-wrap">
          <img src={thumb8} alt="" />
          <div className="wrap">
            <div className="user-wrap flex-div">
              <img src={user_img} alt="" /> <span>kesolink</span>
            </div>
            <span className="play">10.45</span>
          </div>
          <div className="buttom-title">
            <p>hello this is kesolink</p>
          </div>
        </div>
        <h2>
          Best in 3speak channel video creation is kesolink. we vlog for fun and
          we are happy about that.
        </h2>
        <h3>GreatStack</h3>
        <div className="bottom-action">
            <div className="wrap-left">
            <div className="wrap flex-div">
            <IoChevronUpCircleOutline className="icon" />
            <span>$12.6</span>
            </div>
            <span>|</span>
            <div className="wrap flex-div">
            <GiEternalLove className="icon" />
            <span>101</span>
            </div>
            </div>
            <p> 2 days ago</p>
        </div>
      </Link>
      <Link to={`video/20/4521`} className="card">
        <div className="img-wrap">
          <img src={thumb9} alt="" />
          <div className="wrap">
            <div className="user-wrap flex-div">
              <img src={user_img} alt="" /> <span>kesolink</span>
            </div>
            <span className="play">10.45</span>
          </div>
          <div className="buttom-title">
            <p>hello this is kesolink</p>
          </div>
        </div>
        <h2>
          Best in 3speak channel video creation is kesolink. we vlog for fun and
          we are happy about that.
        </h2>
        <h3>GreatStack</h3>
        <div className="bottom-action">
            <div className="wrap-left">
            <div className="wrap flex-div">
            <IoChevronUpCircleOutline className="icon" />
            <span>$12.6</span>
            </div>
            <span>|</span>
            <div className="wrap flex-div">
            <GiEternalLove className="icon" />
            <span>101</span>
            </div>
            </div>
            <p> 2 days ago</p>
        </div>
      </Link>
      <Link to={`video/20/4521`} className="card">
        <div className="img-wrap">
          <img src={thumb10} alt="" />
          <div className="wrap">
            <div className="user-wrap flex-div">
              <img src={user_img} alt="" /> <span>kesolink</span>
            </div>
            <span className="play">10.45</span>
          </div>
          <div className="buttom-title">
            <p>hello this is kesolink</p>
          </div>
        </div>
        <h2>
          Best in 3speak channel video creation is kesolink. we vlog for fun and
          we are happy about that.
        </h2>
        <h3>GreatStack</h3>
        <div className="bottom-action">
            <div className="wrap-left">
            <div className="wrap flex-div">
            <IoChevronUpCircleOutline className="icon" />
            <span>$12.6</span>
            </div>
            <span>|</span>
            <div className="wrap flex-div">
            <GiEternalLove className="icon" />
            <span>101</span>
            </div>
            </div>
            <p> 2 days ago</p>
        </div>
      </Link>
    </div> */}
    </>
    {isOpen && <Auth_modal  isOpen={isOpen} close={toggleUploadModal} />}
    </>
  );
}

export default Feed