import { useQuery } from "@apollo/client";
import React from "react";
import { useParams } from "react-router-dom";
import { GET_SOCIAL_FEED_BY_CREATOR, GET_TOTAL_COUNT_OF_FOLLOWING } from "../graphql/queries";
import { useAppStore } from "../lib/store";
import "./ProfilePage.scss";
import Cards from "../components/Cards/Cards";

function ProfilePage() {
  const { user } = useAppStore();
  // GET_TOTAL_COUNT_OF_FOLLOWING
  // const { username } = useParams();
  const { loading, error, data } = useQuery(GET_SOCIAL_FEED_BY_CREATOR, {
    variables: { id: user },
  });
  const videos = data?.socialFeed?.items || [];
  console.log(data);

  // const {  data: followers } = useQuery(GET_TOTAL_COUNT_OF_FOLLOWING, {
  //   variables: { id: user },
  // });
  // console.log(followers);
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
          <span>Video</span> <span>wallet</span>
        </div>
        <span className="followers">Followers </span>
      </div>
      <div className="container-video">
        {loading ? (<span>Loading...</span>) : (<Cards videos={videos} loading={loading} error={error}
            className="custom-video-feed" />
        )}
      </div>
    </div>
  );
}

export default ProfilePage;
