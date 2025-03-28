import React from 'react'
import "./Com_PageSke_Loader.scss"

function Com_PageSke_Loader() {
  return (
    <div className='community-page-wrap'>
      <div className="com-profile-img-wrap-skeleton">
        <div className="skeleton cover-skeleton"></div>
        <div className="wrap">
          <div className="skeleton avatar-skeleton"></div>
          <div className="skeleton title-skeleton"></div>
        </div>
      </div>
      
      <div className="title-wrap">
        <div className="skeleton line-skeleton mb-10"></div>
        <div className="skeleton line-skeleton"></div>
      </div>
      
      <hr className="skeleton-hr" />
      
      <div className="search-tren-wrapper-skeleton">
        <div className="skeleton search-skeleton"></div>
        <div className="skeleton button-group-skeleton"></div>
      </div>
      
      <div className="feed-wrap-skeleton">
        {[...Array(50)].map((i) => (
          <div key={i} className="skeleton-card">
            <div className="skeleton video-thumbnail-skeleton"></div>
            <div className="skeleton line-skeleton"></div>
            <div className="skeleton line-skeleton"></div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Com_PageSke_Loader