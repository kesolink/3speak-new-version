import { useQuery } from "@apollo/client";
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { GET_SOCIAL_FEED_BY_CREATOR, GET_TOTAL_COUNT_OF_FOLLOWING } from "../graphql/queries";
import { useAppStore } from "../lib/store";
import "./ProfilePage.scss";
import Cards from "../components/Cards/Cards";
import {getFollowers} from "../hive-api/api"
import { Quantum } from 'ldrs/react'
import 'ldrs/react/Quantum.css'
import BarLoader from "../components/Loader/BarLoader";
import icon from "../../public/images/stack.png"

function ProfilePage() {
  const { user } = useAppStore();
  const [follower, setFollower] = useState(null)
  // GET_TOTAL_COUNT_OF_FOLLOWING
  // const { username } = useParams();
  useEffect(()=>{
    getFollowersCount(user)
  },[])
  const { loading, error, data } = useQuery(GET_SOCIAL_FEED_BY_CREATOR, {
    variables: { id: user },
  });
  const videos = data?.socialFeed?.items || [];
  console.log(data);


  const getFollowersCount = async (user)=>{
    try{
      const follower = await getFollowers(user)
    setFollower(follower)
    } catch (err){
      console(err)
    }
  }
console.log(follower)

  return (
    <div className="profile-page-container">
      <div className="com-profile-img-wrap">
        {/* <img src={`https://media.3speak.tv/user/${id}/cover.png`} alt="" /> */}
        <img src={`https://images.hive.blog/u/${user}/cover`} alt="" />
        <div className="wrap">
          <img src={`https://images.hive.blog/u/${user}/avatar`} alt="" />
          <span>{user}</span>
        </div>
      </div>
      <div className="toggle-wrap">
        <div className="wrap">
          <span>Videos</span> 
          <Link to="/wallet"><span>wallet</span></Link>
        </div>
        <span className="followers"> Followers{" "} {follower?.follower_count !== undefined ? ( follower.follower_count ) : (<Quantum size="15" speed="1.75" color="red" />  )}</span>
      </div>
      <div className="container-video">
        {loading ? (<BarLoader/>) : videos?.length === 0 ? ( <div className='empty-wrap'>  <img src={icon} alt="" /><span>No Video Data Available</span></div>) : (<Cards videos={videos} loading={loading} error={error}
            className="custom-video-feed" />
        ) }
      </div>
    </div>
  );
}

export default ProfilePage;
