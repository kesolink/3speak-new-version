import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@apollo/client';
import { GET_COMMUNITIES } from '../../graphql/queries';
import "./CommunityPage.scss"
import { Client } from '@hiveio/dhive';
import Cards from '../Cards/Cards';
import Com_PageSke_Loader from './Com_PageSke_Loader';

// Create a new Hive client
const client = new Client(['https://api.hive.blog', 'https://api.openhive.network']);
function CommunityPage() {
    const { communityName: id } = useParams(); 
    const [dataMain, setDataMain] = useState(null)
    const [trend, setTrend]= useState(true)
    console.log(id)
    // const [data, setData] = useState(null);
    const fetchCommunityData = async (id) => {
        try {
            // Get the community details using the correct method signature
            const communityData = await client.call('bridge', 'get_community', {
                name: id,
                observer: ''
            });

            console.log('Community Data:', communityData);
            setDataMain(communityData);
        } catch (error) {
            console.error('Error fetching community data:', error);
        }
    };

    // console.log(dataMain)
      
    useEffect(() => {
        if (id) {
            fetchCommunityData(id);
        }
    }, [id]);



    const { loading, data } = useQuery(GET_COMMUNITIES, {
        variables: { id: id },
      });
    

      console.log(data)
      if(loading){
        return (<div><Com_PageSke_Loader /></div>)
      }


    


    return (
        <div className='community-page-wrap'>
            <div className="com-profile-img-wrap">
                {/* <img src={`https://media.3speak.tv/user/${id}/cover.png`} alt="" /> */}
                <img src={`https://images.hive.blog/u/${id}/cover`} alt="" />
                <div className="wrap">
                    <img src={`https://images.hive.blog/u/${id}/avatar`} alt="" />
                    <span>{data?.community?.title}</span>
                </div>
            </div>
            <div className="title-wrap">
                <h3>{data?.community?.about}</h3>
                <p>{dataMain?.description}</p>
            </div>
            <hr />
            <div className="search-tren-wrapper">
              <div className="search-wrapper">
               <input type="text" placeholder="Search communities..." />
              </div>
              <div className={`trend-btn-wrap`}>
                <span className={`${trend && "active"}`} onClick={()=> setTrend(true) }>Trend</span> <span className={`${!trend && "active"}`} onClick={()=> setTrend(false) } >New</span>
              </div>
            </div>
            <div className="feed-wrap" >
                {trend ? <Cards videos={data?.community?.trendingFeed?.items}  className="custom-video-feed" /> : <Cards videos={data?.community?.latestFeed?.items}  className="custom-video-feed" />}
            </div>
            
        </div>
    );
}

export default CommunityPage;
