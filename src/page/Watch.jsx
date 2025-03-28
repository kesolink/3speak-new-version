import React from 'react';
import './Watch.scss';
import PlayVideo from '../components/playVideo/PlayVideo';
import Recommended from '../components/recommended/Recommended';
import { useSearchParams } from 'react-router-dom';
import { GET_RELATED, GET_VIDEO_DETAILS } from '../graphql/queries';
import { useQuery } from '@apollo/client';

function Watch() {
  const [searchParams] = useSearchParams();
  const v = searchParams.get('v'); // Extract the "v" query parameter
  const [author, permlink] = (v ?? 'unknown/unknown').split('/');

  console.log('Author:', author);
  console.log('Permlink:', permlink);

  const { data: videoData, loading: videoLoading, error: videoError } = useQuery(GET_VIDEO_DETAILS, {
    variables: { author, permlink },
  });

  console.log(videoData)

  const videoDetails = videoData?.socialPost;

  const { data: suggestionsData, loading: suggestionsLoading, error: suggestionsError } = useQuery(GET_RELATED, {
    variables: { author, permlink },
  });

  const suggestedVideos = suggestionsData?.relatedFeed?.items;
  console.log(suggestedVideos)
  
  const isNetworkError = videoError && videoError.networkError;

  if (videoLoading || suggestionsLoading) {
    return <div>Loading...</div>;
  }
  

  if (videoError || suggestionsError) {
    return <div>Error loading data. Please try again.</div>;
  }

  if (isNetworkError) {
    return <div>network error</div>; // Spinner for network issues
  }

  

  return (
    <div className="play-container">
      <PlayVideo videoDetails={videoDetails} author={author} permlink={permlink} />

      <Recommended suggestedVideos={suggestedVideos} />
    </div>
  );
}

export default Watch;
