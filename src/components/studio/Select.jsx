import React from "react";
import "./Select.scss";
import { LiaPhotoVideoSolid } from "react-icons/lia";
import { FaUpload } from "react-icons/fa";
import { Link } from "react-router-dom";
function Select() {
  return (
    <div className="select-container">
      <div className="main-option">
        <div className="draft-wrap">
          <LiaPhotoVideoSolid size={40} />
          <span>Edit your draft video</span>
        </div>
        <span className="or">or</span>
        <Link to="/studio">
          <div className="draft-wrap">
            <FaUpload size={40} />
            <span>Create a new video</span>
          </div>
        </Link>
      </div>
    </div>
  );
}

export default Select;
