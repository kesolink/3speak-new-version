import React from 'react'
import "./CardSkeleton.scss"
function CardSkeleton() {
  return (
    <div className="feed-wrap-skeleton-in">
        {[...Array(50)].map((i) => (
          <div key={i} className="skeleton-card">
            <div className="skeleton video-thumbnail-skeleton"></div>
            <div className="skeleton line-skeleton"></div>
            <div className="skeleton line-skeleton"></div>
          </div>
        ))}
      </div>
  )
}

export default CardSkeleton