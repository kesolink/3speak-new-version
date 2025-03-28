
import { useState } from 'react';
import CardSkeleton from '../components/Cards/CardSkeleton';
import { useQuery } from '@apollo/client';
import { GET_TRENDING_TAGS } from '../graphql/queries';
import Cards from '../components/Cards/Cards'
import { useParams } from 'react-router-dom';
// import './App.css';

function TagFeed() {
    const { tag } = useParams(); 
    const { loading, error, data } = useQuery(GET_TRENDING_TAGS, {
        variables: { tag },
    });
    const videos = data?.trendingFeed?.items || [];
    console.log(videos)

  return (
    <div className='firstupload-container'>
            <div className='headers'>{tag}</div>
            { loading ? <CardSkeleton /> :<Cards videos={videos} 
    
          error={error} 
          className="custom-video-feed" />}
    
        </div>
  );
}

export default TagFeed;