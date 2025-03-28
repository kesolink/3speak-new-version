import React from 'react'
import "./FirstUploads.scss"
import { useQuery } from '@apollo/client'
import { NEW_CONTENT } from '../graphql/queries'
import Cards from '../components/Cards/Cards'
import CardSkeleton from '../components/Cards/CardSkeleton'

const NewVideos = () => {
  const { data, loading, error } = useQuery(NEW_CONTENT);

  if (error) {
    console.error("GraphQL Error:", error);
  }

  console.log("Fetched Data:", data); // Log data to check what is being returned
  
  const videos = data?.socialFeed?.items || [];

  return (
    <div className='firstupload-container'>
      <div className='headers'>New VIDEOS</div>
      {loading ? 
        <CardSkeleton /> :
        <Cards videos={videos} loading={loading} error={error} className="custom-video-feed" />
      }
    </div>
  );
};

export default NewVideos;
