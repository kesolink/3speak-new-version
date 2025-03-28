import React, { useState } from "react";
import axios from "axios";
import * as tus from "tus-js-client";
import "./StudioPage.scss";

function StudioPage() {
  const client = axios.create({});
  const studioEndPoint = "https://studio.3speak.tv";
  const tusEndPoint = "https://uploads.3speak.tv/files/";

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("life,blog,music");
  const [community, setCommunity] = useState("");
  const [thumbnailPreview, setThumbnailPreview] = useState(null);
  const [thumbnailFile, setThumbnailFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadURL, setUploadURL] = useState("");
  const [videoFile, setVideoFile] = useState(null);
  const [videoDuration, setVideoDuration] = useState(0);
  const [videoId, setVideoId] = useState("");

  const accessToken = localStorage.getItem("access_token");
  const username = localStorage.getItem("user_id");

  const calculateVideoDuration = (file) => {
    return new Promise((resolve) => {
      const video = document.createElement("video");
      video.preload = "metadata";

      video.onloadedmetadata = () => {
        window.URL.revokeObjectURL(video.src); // Clean up
        resolve(video.duration); // Duration in seconds
      };

      video.src = URL.createObjectURL(file);
    });
  };

  // Handle video upload
  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setVideoFile(file);

    const duration = await calculateVideoDuration(file);
    setVideoDuration(duration);

    const upload = new tus.Upload(file, {
      endpoint: tusEndPoint,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      metadata: {
        filename: file.name,
        filetype: file.type,
      },
      onError: (error) => {
        console.error("Upload failed:", error);
      },
      onProgress: (bytesUploaded, bytesTotal) => {
        const percentage = ((bytesUploaded / bytesTotal) * 100).toFixed(2);
        setUploadProgress(percentage);
      },
      onSuccess: () => {
        const finalURL = upload.url.replace(tusEndPoint, "");
        setUploadURL(finalURL);
        console.log("Upload successful! URL:", finalURL);
      },
    });

    upload.start();
  };

  // Handle thumbnail upload
  const handleThumbnailUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const upload = new tus.Upload(file, {
      endpoint: tusEndPoint,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      metadata: {
        filename: file.name,
        filetype: file.type,
      },
      onError: function (error) {
        console.error("Thumbnail upload failed:", error);
      },
      onProgress: function (bytesUploaded, bytesTotal) {
        const percentage = ((bytesUploaded / bytesTotal) * 100).toFixed(2);
        console.log(`Thumbnail upload progress: ${percentage}%`);
      },
      onSuccess: function () {
        const uploadedUrl = upload.url;
        console.log("Thumbnail uploaded successfully:", uploadedUrl);
  
        // Save the uploaded thumbnail URL in state
        setThumbnailPreview(uploadedUrl);
        setThumbnailFile(uploadedUrl);
        // setThumbnailFile(file);
      },
    });
  
    upload.start();

    // const previewURL = URL.createObjectURL(file);
    // setThumbnailPreview(previewURL);
    // setThumbnailFile(file);
  };

  // Update video information
  const updateVideoInfo = async () => {
    if (!uploadURL || !videoFile || !thumbnailFile) {
      console.error("Missing video or thumbnail information.");
      return;
    }
    const oFilename = videoFile.name;
    const fileSize = videoFile.size;
    // const thumbnailURL = "https://www.shutterstock.com/shutterstock/photos/2033709224/display_1500/stock-vector-vector-illustration-material-tiger-tiger-line-drawing-material-2033709224.jpg";
    // const thumbnailURL = URL.createObjectURL(thumbnailFile);
    console.log("Username====>",  username)
    console.log("ACCESS TOKEN====>", accessToken)
    console.log("thumbnailurl====>", thumbnailFile)
    console.log("videoDuration====>", Math.round(videoDuration))
    console.log("Video-URL====>", uploadURL)
    const thumbnailIdentifier = thumbnailFile.replace("https://uploads.3speak.tv/files/", "");
    

    try {
      const { data } = await axios.post(
        `${studioEndPoint}/mobile/api/upload_info`,
        {
          filename: uploadURL,
          oFilename,
          size: fileSize,
          duration: Math.round(videoDuration), // Duration in seconds
          thumbnail: thumbnailIdentifier,
          owner: username,
          isReel: false, // Adjust as needed
        },
        {
          withCredentials: false,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      console.log("Video info updated successfully:", data);
      setVideoId(data._id)
      // handleSubmitDetails()
      return data;
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  const handleSubmitDetails = async () => {
    if (!title || !description || !tags || !community || !thumbnailFile || !uploadURL) {
      alert("Please fill in all fields, upload a thumbnail, and upload a video!");
      return;
    }
    const thumbnailIdentifier = thumbnailFile.replace("https://uploads.3speak.tv/files/", "");

    try {
      
      const response = await client.post(`${studioEndPoint}/mobile/api/update_info`,
        {
          beneficiaries: "[{\"account\":\"reward.app\",\"weight\":500}, {\"account\":\"inleo\",\"weight\":500}]",
          description: `${description}<br/><sub>Uploaded using 3Speak Mobile App</sub>`,
          videoId: videoId, // Using uploaded video URL as videoId
          title,
          isNsfwContent: false,
          tags,
          thumbnail: thumbnailIdentifier,
          communityID: community,
        }, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      });

      console.log("Details submitted successfully:", response.data);
      alert("Video details submitted successfully!");
    } catch (error) {
      console.error("Failed to submit details:", error);
      alert("Failed to submit video details.");
    }
  };

  return (
    <div className="studio-page">
      <div className="upload-video">
        <p>
          Drop a file or click to start the upload.
          <br />
          Max. Filesize is 5GB. Note: Your video will not be encoded if it is above the size limit!
        </p>
        <input type="file" onChange={handleFileUpload} />
        <div>Upload Progress: {uploadProgress}%</div>
        {uploadURL && <div>Uploaded Video URL: {uploadURL}</div>}
      </div>

      <div className="content-container">
        <div className="content-wrapper">
          <div className="wrap">
            <label>Title</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="wrap">
            <label>Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)}></textarea>
          </div>
          <div className="wrap">
            <label>Tags</label>
            <input type="text" value={tags} onChange={(e) => setTags(e.target.value)} />
          </div>
          <div className="wrap">
            <label>Community</label>
            <input type="text" value={community} onChange={(e) => setCommunity(e.target.value)} />
          </div>
          <div className="wrap">
            <label>Thumbnail</label>
            <input type="file" accept="image/*" onChange={handleThumbnailUpload} />
          </div>
          {thumbnailPreview && (
            <div className="thumbnail-preview">
              <p>Thumbnail Preview:</p>
              <img src={thumbnailPreview} alt="Thumbnail Preview" style={{ width: "100%", maxWidth: "300px" }} />
            </div>
          )}
        </div>

        <button onClick={updateVideoInfo}>Update Video Info</button>
        <button onClick={handleSubmitDetails}>Submit Details</button>
      </div>
    </div>
  );
}

export default StudioPage;





// import React, { useState } from "react";

// const StudioPage = ({ onSubmit }) => {
//   const [tags, setTags] = useState([]);
//   const [inputValue, setInputValue] = useState("");

//   // Add tag when Enter is pressed
//   const handleKeyDown = (event) => {
//     if (event.key === "Enter" && inputValue.trim() !== "") {
//       const newTags = [...tags, inputValue.trim()];
//       setTags(newTags); // Add new tag to the list
//       onSubmit(newTags.join(",")); // Send updated tags to the parent/server
//       setInputValue(""); // Clear the input field for the next tag
//     }
//   };

//   // Remove a tag
//   const removeTag = (indexToRemove) => {
//     const updatedTags = tags.filter((_, index) => index !== indexToRemove);
//     setTags(updatedTags);
//     onSubmit(updatedTags.join(",")); // Send updated tags to the parent/server
//   };

//   console.log(inputValue)

//   return (
//     <div className="tag-input-wrap">
//       <div className="tags">
//         {tags.map((tag, index) => (
//           <div key={index} className="tag">
//             {tag}
//             <button type="button" onClick={() => removeTag(index)}>
//               &times;
//             </button>
//           </div>
//         ))}
//       </div>
//       <input
//         type="text"
//         placeholder="Enter a tag and press Enter"
//         value={inputValue}
//         onChange={(e) => setInputValue(e.target.value)}
//         onKeyDown={handleKeyDown}
//       />
//     </div>
//   );
// };

// export default StudioPage;
