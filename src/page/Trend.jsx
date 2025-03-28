
import "./FirstUploads.scss"
import Cards from '../components/Cards/Cards'
import { useQuery } from "@apollo/client";
import { GET_TRENDING_FEED, TRENDING_FEED } from "../graphql/queries";
import CardSkeleton from "../components/Cards/CardSkeleton";
const Trend = () => {
  const { data, loading, error } = useQuery(GET_TRENDING_FEED );
  const videos = data?.trendingFeed?.items || [];
  console.log(videos)

  return (
    <div className='firstupload-container'>
        <div className='headers'>TRENDING</div>
        { loading ? <CardSkeleton /> :<Cards videos={videos} 

      error={error} 
      className="custom-video-feed" />}

    </div>
  )
}

export default Trend