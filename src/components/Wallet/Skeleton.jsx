import React from 'react';
import './skeleton.scss';
import clsx from 'clsx';

const Skeleton = ({ rows = 5 }) => {
  return (
    <div className="skeleton-loader">
    {Array.from({ length: rows }).map((_, index) => (
      <div key={index} className="skeleton-row">
        <div className="skeleton skeleton-type"></div>
        <div className="skeleton skeleton-amount"></div>
        <div className="skeleton skeleton-account"></div>
        <div className="skeleton skeleton-date"></div>
        <div className="skeleton skeleton-memo"></div>
      </div>
    ))}
  </div>
  );
};



export default Skeleton;