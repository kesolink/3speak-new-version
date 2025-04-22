import { useQuery } from '@apollo/client';
import React, { useEffect, useState } from 'react'
import { getFollowers } from '../../hive-api/api';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { GET_SOCIAL_FEED_BY_CREATOR } from '../../graphql/queries';
import Cards from '../Cards/Cards';
import icon from "../../../public/images/stack.png"
import "./UserProfilePage.scss"
import BarLoader from '../Loader/BarLoader';
import { Quantum } from 'ldrs/react'
import 'ldrs/react/Quantum.css'




function UserProfilePage() {
    const { user } = useParams();
    const navigate = useNavigate()
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
      console.log(videos);
    
    
      const getFollowersCount = async (user)=>{
        try{
          const follower = await getFollowers(user)
        setFollower(follower)
        } catch (err){
          console(err)
        }
      }

      const handleWalletNavigate = (user)=>{
        navigate(`/wallet/${user}`)
      }
    console.log(data)
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
          {/* <Link to="/wallet"><span onClick={()=>{handleWalletNavigate(user)}}>wallet</span></Link> */}
          <span onClick={()=>{handleWalletNavigate(user)}}>wallet</span> 
        </div>
        <span className="followers"> Followers{" "} {follower?.follower_count !== undefined ? ( follower.follower_count ) : (<Quantum size="15" speed="1.75" color="red" />  )}</span>
      </div>
      <div className="container-video">
        {loading ? (<BarLoader/>) : videos?.length === 0 ? ( <div className='empty-wrap'>  <img src={icon} alt="" /><span>No Video Data Available</span></div>) : (<Cards videos={videos} loading={loading} error={error}
            className="custom-video-feed" />
        ) }
      </div>
    </div>
  )
}

export default UserProfilePage