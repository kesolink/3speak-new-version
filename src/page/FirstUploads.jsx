// import React, { useEffect } from 'react'
import "./FirstUploads.scss"
// import { GiEternalLove } from 'react-icons/gi'
// import { IoChevronUpCircleOutline } from 'react-icons/io5'
// import { Link } from 'react-router-dom'

// import thumb1 from "../assets/image/thumb01.jfif"
// import thumb2 from "../assets/image/thumb02.jfif"
// import thumb3 from "../assets/image/thumb03.jfif"
// import thumb4 from "../assets/image/thumb04.jfif"
// import thumb5 from "../assets/image/thumb05.jfif"
// import thumb6 from "../assets/image/thumb06.jfif"
// import thumb7 from "../assets/image/thumb07.jfif"
// import thumb8 from "../assets/image/thumb08.jfif"
// import thumb9 from "../assets/image/thumb09.jfif"
// import thumb10 from "../assets/image/thumb10.jfif"
// import user_img from "../assets/image/user-img.avif"
// import { useQuery } from '@tanstack/react-query'
import { useQuery } from '@apollo/client';
import { FIRST_UPLOAD_FEED } from '../graphql/queries'
import Cards from "../components/Cards/Cards"
import CardSkeleton from "../components/Cards/CardSkeleton";
// import axios from 'axios'
const FirstUploads = () => {

  const { data, loading, error } = useQuery(FIRST_UPLOAD_FEED);
  const videos = data?.trendingFeed?.items || [];

  // const getFeed = useQuery(FIRST_UPLOAD_FEED);

  console.log(videos)
  return (
    <div className='firstupload-container'>
        <div className='headers'>FIRST TIME UPLOADS</div>
        {loading ? <CardSkeleton /> :<Cards videos={videos} 
      loading={loading} 
      error={error} 
      className="custom-video-feed" />}

    </div>
  )
}

export default FirstUploads