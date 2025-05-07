import React from "react";
import "./Select.scss";
import { Link } from "react-router-dom";
function Select() {
  return (
    <div className="select-container">
      <div className="main-option">
        <Link to="/draft" className="draft-wrap">
          <div className="icon group-hover">
            <i className="fas fa-edit group-hover"></i>
          </div>
          <h3>Edit your draft video</h3>
          <p className="">
            Continue working on your existing draft
          </p>
        </Link>
        <span className="or">or</span>
        <Link to="/studio">
          <div className="draft-wrap">
          
          <div className="icon group-hover">
          <i className="fas fa-cloud-upload-alt group-hover"></i>
          </div>
            <h3>Create a new video</h3>
            <p className="video-options__desc group-hover">
            Upload and share your content with the world
          </p>
          </div>
        </Link>
      </div>
    </div>
  );
}

export default Select;
