import React from 'react';
import './SkeletonLoader.scss';

const SkeletonLoader = () => {
  return (
    <div className="skeleton-loader">
      {[...Array(50)].map((_, index) => (
        <div key={index} className="skeleton-card">
          <div className="skeleton-img-wrap"></div>
          <div className="skeleton-title"></div>
        </div>
      ))}
    </div>
  );
};

export default SkeletonLoader;