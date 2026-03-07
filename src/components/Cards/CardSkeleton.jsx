import "./CardSkeleton.scss"

function CardSkeleton() {
  return (
    <div className="feed-wrap-skeleton-in">
      {[...Array(12)].map((_, i) => (
        <div key={i} className="skeleton-card">
          <div className="skeleton video-thumbnail-skeleton"></div>
          <div className="skeleton line-skeleton"></div>
          <div className="skeleton line-skeleton"></div>
          <div className="skeleton-avatar-row">
            <div className="skeleton skeleton-avatar"></div>
            <div className="skeleton skeleton-text-sm"></div>
          </div>
        </div>
      ))}
    </div>
  )
}

export default CardSkeleton