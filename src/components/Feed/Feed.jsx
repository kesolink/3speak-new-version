
import "./Feed.scss"
import { Link } from "react-router-dom"
import { IoChevronUpCircleOutline } from "react-icons/io5"
import { GiEternalLove } from "react-icons/gi"
import CommunitiesTags from "../communities-tags/CommunitiesTags"
import { useEffect, useState } from "react"
import Auth_modal from "../modal/Auth_modal"
import { has3SpeakPostAuth } from '../../utils/hiveUtils';
import { useAppStore } from '../../lib/store';
import CardSkeleton from "../Cards/CardSkeleton"
import { useQuery } from "@apollo/client"
import { LATEST_FEED } from "../../graphql/queries"
import axios from "axios"
import { useInfiniteQuery } from "@tanstack/react-query"
import Card3 from "../Cards/Card3"



const fetchVideos = async ({ pageParam = 0 }) => {
  let url;

  if (pageParam === 0) {
    // 🧩 First load
    url = `https://legacy.3speak.tv/apiv2/feeds/home?page=${pageParam}`;
  } else {
    // 🧩 Only two "more" pages are available: 64 and 128
    url = `https://legacy.3speak.tv/api/feed/more?skip=${pageParam}`;
  }

  const res = await axios.get(url);
  return res.data.trends || res.data;
};

function Feed() {
  const [isOpen, setIsOpen] = useState(false)
  const {authenticated, user} = useAppStore();

  useEffect(()=>{
    checkPostAuth(user);
  },[])

   const {
  data,
  fetchNextPage,
  hasNextPage,
  isFetchingNextPage,
  isLoading,
  isError,
} = useInfiniteQuery({
  queryKey: ["home"],
  queryFn: fetchVideos,
  getNextPageParam: (lastPage, allPages) => {
    // 🧠 Available skip values
    const nextSkips = [64, 128];

    // Determine next skip value
    const next = nextSkips[allPages.length - 1];

    // Stop after 128
    return next || undefined;
  },
});

  useEffect(() => {
      const handleScroll = () => {
        if (
          window.innerHeight + window.scrollY >=
            document.body.offsetHeight - 200 &&
          !isFetchingNextPage &&
          hasNextPage
        ) {
          fetchNextPage();
        }
      };
  
      window.addEventListener("scroll", handleScroll);
      return () => window.removeEventListener("scroll", handleScroll);
    }, [isFetchingNextPage, hasNextPage, fetchNextPage]);
  
    // Flatten all pages into a single array
    const videos = data?.pages.flat() || [];
    console.log(videos)


 

    async function checkPostAuth(username) {
      if(!authenticated){
        return
      }
      const hasAuth = await has3SpeakPostAuth(username);
      if (!hasAuth) {
        setIsOpen(true);
      }
    }

  return (
    <>
    <>
    <CommunitiesTags />

    {isLoading ? <CardSkeleton /> :  <Card3 videos={videos} loading={isFetchingNextPage} />}
    {isError && <p>Error fetching videos</p>}
      {isFetchingNextPage && (
        <p style={{ textAlign: "center" }}>Loading more...</p>
      )}
    </>
    {/* {isOpen && <Auth_modal  isOpen={isOpen} close={toggleUploadModal} />} */}
    </>
  );
}

export default Feed