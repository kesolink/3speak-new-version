import  { useEffect, useState } from "react";
import axios from "axios";
// import * as tus from "tus-js-client";
import "./TestStudio.scss"
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { SiComma } from "react-icons/si";
import Communitie_modal from "../modal/Communitie_modal";
import Beneficiary_modal from "../modal/Beneficiary_modal"
import { IoIosArrowDropdownCircle } from "react-icons/io";
import Upload_modal from "../modal/Upload_modal";
import cloud from "../../assets/image/upload-cloud.png"
import { MdPeopleAlt } from "react-icons/md";
import DOMPurify from 'dompurify';
// import { Client: HiveClient } from "@hiveio/dhive";





function TestStudio() {
 const client = axios.create({});
  const studioEndPoint = "https://studio.3speak.tv";
  // const tusEndPoint = "https://uploads.3speak.tv/files/";

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [community, setCommunity] = useState("hive-181335");
  // const [thumbnailPreview, setThumbnailPreview] = useState(null);
  const [thumbnailFile, setThumbnailFile] = useState(null);
  const [beneficiaries, setBeneficiaries] = useState('[]');
  // const [uploadURL, setUploadURL] = useState("");
  // const [videoFile, setVideoFile] = useState(null);
  // const [videoDuration, setVideoDuration] = useState(0);
  const [videoId, setVideoId] = useState("");
  const [isOpen, setIsOpen] = useState(false)
  const [uploadModalOpen, setUploadModalOpen] = useState(false)
  const [benficaryOpen, setBeneficiaryOpen] = useState(false)
  const accessToken = localStorage.getItem("access_token");
  const username = localStorage.getItem("user_id");
  const [declineRewards, SetDeclineRewards] = useState(false)
  const [rewardPowerup, setRewardPowerup  ] = useState(false)
  const [communitiesData, setCommunitiesData] = useState([]);
  
  console.log("accesstokrn=====>", accessToken)

  useEffect(() => {
    const fetchCommunities = async () => {
      try {
        const response = await axios.post("https://api.hive.blog", {
          jsonrpc: "2.0",
          method: "bridge.list_communities",
          params: { last: "", limit: 100 },
          id: 1,
        });
        setCommunitiesData(response.data.result || []);
      } catch (error) {
        console.error("Error fetching communities:", error);
      }
    };

    fetchCommunities();
  }, []);
  // console.log(communitiesData)

  const openCommunityModal = () => {
    setIsOpen(true);
  };

  const closeCommunityModal = () => {
    setIsOpen(false);
  };

  const toggleUploadModal = ()=>{
    setUploadModalOpen( (prev)=> !prev)
  }

  const toggleBeneficiaryModal = ()=>{
    setBeneficiaryOpen( (prev)=> !prev)
  }

  
  

  // const calculateVideoDuration = (file) => {
  //   return new Promise((resolve) => {
  //     const video = document.createElement("video");
  //     video.preload = "metadata";

  //     video.onloadedmetadata = () => {
  //       window.URL.revokeObjectURL(video.src); // Clean up
  //       resolve(video.duration); // Duration in seconds
  //     };

  //     video.src = URL.createObjectURL(file);
  //   });
  // };

  // Handle video upload
  // const handleFileUpload = async (event) => {
  //   const file = event.target.files[0];
  //   if (!file) return;

  //   setVideoFile(file);

  //   const duration = await calculateVideoDuration(file);
  //   setVideoDuration(duration);

  //   const upload = new tus.Upload(file, {
  //     endpoint: tusEndPoint,
  //     retryDelays: [0, 3000, 5000, 10000, 20000],
  //     metadata: {
  //       filename: file.name,
  //       filetype: file.type,
  //     },
  //     onError: (error) => {
  //       console.error("Upload failed:", error);
  //     },
  //     onProgress: (bytesUploaded, bytesTotal) => {
  //       const percentage = ((bytesUploaded / bytesTotal) * 100).toFixed(2);
  //       setUploadProgress(percentage);
  //     },
  //     onSuccess: () => {
  //       const finalURL = upload.url.replace(tusEndPoint, "");
  //       setUploadURL(finalURL);
  //       console.log("Upload successful! URL:", finalURL);
  //     },
  //   });

  //   upload.start();
  // };

  // Handle thumbnail upload
  // const handleThumbnailUpload = (event) => {
  //   const file = event.target.files[0];
  //   if (!file) return;

  //   const upload = new tus.Upload(file, {
  //     endpoint: tusEndPoint,
  //     retryDelays: [0, 3000, 5000, 10000, 20000],
  //     metadata: {
  //       filename: file.name,
  //       filetype: file.type,
  //     },
  //     onError: function (error) {
  //       console.error("Thumbnail upload failed:", error);
  //     },
  //     onProgress: function (bytesUploaded, bytesTotal) {
  //       const percentage = ((bytesUploaded / bytesTotal) * 100).toFixed(2);
  //       console.log(`Thumbnail upload progress: ${percentage}%`);
  //     },
  //     onSuccess: function () {
  //       const uploadedUrl = upload.url;
  //       console.log("Thumbnail uploaded successfully:", uploadedUrl);
  
  //       // Save the uploaded thumbnail URL in state
  //       setThumbnailPreview(uploadedUrl);
  //       setThumbnailFile(uploadedUrl);
  //       // setThumbnailFile(file);
  //     },
  //   });
  
  //   upload.start();

  //   // const previewURL = URL.createObjectURL(file);
  //   // setThumbnailPreview(previewURL);
  //   // setThumbnailFile(file);
  // };

  // Update video information
  // const updateVideoInfo = async () => {
  //   if (!uploadURL || !videoFile || !thumbnailFile) {
  //     console.error("Missing video or thumbnail information.");
  //     return;
  //   }
  //   const oFilename = videoFile.name;
  //   const fileSize = videoFile.size;
  //   // const thumbnailURL = "https://www.shutterstock.com/shutterstock/photos/2033709224/display_1500/stock-vector-vector-illustration-material-tiger-tiger-line-drawing-material-2033709224.jpg";
  //   // const thumbnailURL = URL.createObjectURL(thumbnailFile);
  //   console.log("Username====>",  username)
  //   console.log("ACCESS TOKEN====>", accessToken)
  //   console.log("thumbnailurl====>", thumbnailFile)
  //   console.log("videoDuration====>", Math.round(videoDuration))
  //   console.log("Video-URL====>", uploadURL)
  //   const thumbnailIdentifier = thumbnailFile.replace("https://uploads.3speak.tv/files/", "");
    

  //   try {
  //     const { data } = await axios.post(
  //       `${studioEndPoint}/mobile/api/upload_info`,
  //       {
  //         filename: uploadURL,
  //         oFilename,
  //         size: fileSize,
  //         duration: Math.round(videoDuration), // Duration in seconds
  //         thumbnail: thumbnailIdentifier,
  //         owner: username,
  //         isReel: false, // Adjust as needed
  //       },
  //       {
  //         withCredentials: false,
  //         headers: {
  //           "Content-Type": "application/json",
  //           Authorization: `Bearer ${accessToken}`,
  //         },
  //       }
  //     );

  //     console.log("Video info updated successfully:", data);
  //     setVideoId(data._id)
  //     // handleSubmitDetails()
  //     return data;
  //   } catch (e) {
  //     console.error(e);
  //     throw e;
  //   }
  // };

  const handleSelect = (e)=>{
    const value = e.target.value;
    if(value === "powerup"){
      setRewardPowerup(true)
      SetDeclineRewards(false)
    }else if(value === "decline"){
      SetDeclineRewards(true)
      setRewardPowerup(false)
    }else {
      SetDeclineRewards(false)
      setRewardPowerup(false)
    }
  }

  const handleSubmitDetails = async () => {
    
    console.log(beneficiaries)
    console.log(title)
    console.log(tags)
    console.log(community)
    console.log(thumbnailFile)

    if (!title || !description || !tags || !community || !thumbnailFile ) {
      alert("Please fill in all fields, upload a thumbnail, and upload a video!");
      return;
    }
    const thumbnailIdentifier = thumbnailFile.replace("https://uploads.3speak.tv/files/", "");
    try {
      
      const response = await client.post(`${studioEndPoint}/mobile/api/update_info`,
        {
          beneficiaries: beneficiaries,
          description: `${description}<br/><sub>Uploaded using 3Speak Mobile App</sub>`,
          videoId: videoId, // Using uploaded video URL as videoId
          title,
          isNsfwContent: false,
          tags,
          thumbnail: thumbnailIdentifier,
          communityID: community,
          declineRewards,
          rewardPowerup
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

  const sanitizedDescription = DOMPurify.sanitize(description);


  return (
    <>
    <div className="studio-container">
      <div className="upload-video" onClick={toggleUploadModal}>
      <img src={cloud} alt="" />
        <p>
           Click to start the upload.
          <br />
          Max. Filesize is 5GB. Note: Your video will not be encoded if it is above the size limit!
        </p>
      
        {/* <input type="file" onChange={handleFileUpload} />
        <div>Upload Progress: {uploadProgress}%</div>
        {uploadURL && <div>Uploaded Video URL: {uploadURL}</div>} */}
      </div>
      <div className="video-detail-wrap">
        <div className="video-items">
        <div className="input-group">
          <label htmlFor="">Title</label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="input-group">
          <label htmlFor="">Description</label>
          <div className="wrap-dec">
          <ReactQuill theme="snow" value={description} onChange={setDescription}  style={{ height: "90%", }} />
          </div>
        </div>

        <div className="input-group">
          <label htmlFor="">Tag</label>
          <input type="text" value={tags} onChange={(e) => setTags(e.target.value)}  />
          <div className="wrap">
          <span>Separate multiple tags with a </span> <SiComma size={9} />
          </div>
        </div>

        <div className="community-wrap" onClick={openCommunityModal}>
            {community ? <span>{community === "hive-181335" ? "Select Community" : community }</span> : <span> Select Community</span> }
            <IoIosArrowDropdownCircle size={16} />
          </div> 

        <div className="advance-option">
          <div className="beneficiary-wrap mb">
           <div className="wrap">
           <span>Rewards Distribution</span>
           <span>Optional "Hive Reward Pool" distribution method.</span>
           </div>
           <div className="select-wrap">
            <select name="" id="" onChange={handleSelect}>
              <option value="default"> Default 50% 50% </option>
              <option value="powerup">Power up 100%</option>
              <option value="decline">Decline Payout</option>
            </select>
           </div>
          </div>
          <div className="beneficiary-wrap">
           <div className="wrap">
           <span>Beneficiaries</span>
           <span>Other accounts that should get a % of the post rewards.</span>
           </div>
           <div className="bene-btn-wrap" onClick={toggleBeneficiaryModal}>
            <span>BENEFICIARIES</span>
            <MdPeopleAlt />
           </div>
          </div>


          
        </div>

          {/* <input type="text" value={community} onChange={(e) => setCommunity(e.target.value)} /> */}
          {/* <div className="community-wrap" onClick={openCommunityModal}>
            {community ? <span>{community}</span> : <span> Select Community</span> }
            <IoIosArrowDropdownCircle size={16} />
          </div>  */}

        {/* <div className="input-group">
          <label htmlFor="">Thumbnail</label>
          <input type="file" accept="image/*" onChange={handleThumbnailUpload} />
        </div> */}
        {/* {thumbnailPreview && (
            <div className="thumbnail-preview">
              <p>Thumbnail Preview:</p>
              <img src={thumbnailPreview ? thumbnailPreview : "https://studio.3speak.tv/img/default-thumbnail.jpg"} alt="Thumbnail Preview" style={{ width: "100%", maxWidth: "300px" }} />
            </div>
          )} */}
        {/* <button onClick={updateVideoInfo}>Update Video Info</button> */}
        <div className="submit-btn-wrap">
        <button onClick={()=>{console.log("description===>", description); handleSubmitDetails()}}>Submit Details</button>
        </div>

        </div>
        <div className="Preview">
        <h3>Preview</h3>

        {/* Show the title */}
        <div className="preview-title">
           {title && <span> {title}</span>}
        </div>

        {/* Show the description */}
        <div className="preview-description">
          {sanitizedDescription &&  <span dangerouslySetInnerHTML={{ __html: sanitizedDescription }}></span>}
        </div>

        {/* Show the tags */}
        <div className="preview-tags">
        {tags &&<span> Tags: {tags.split(',').map((item, index) => (
      <span className="item" key={index} style={{ marginRight: '8px' }}>
        {item}
      </span>
    ))}</span>}
        </div>

        

        {/* Show the video preview */}
        {videoId && (
          <div className="preview-video">
            <video controls style={{ width: "100%", maxWidth: "600px",marginTop: "10px", borderRadius: "8px" }}>
              <source
                src={`https://uploads.3speak.tv/files/${videoId}`}
                type="video/mp4"
              />
              Your browser does not support the video tag.
            </video>
          </div>
        )}

        {/* Show the thumbnail image */}
        {thumbnailFile && (
          <div className="preview-thumbnail">
            <img
              src={thumbnailFile}
              alt="Thumbnail"
              style={{ width: "250px", height: "auto", borderRadius: "8px",marginTop: "10px", }}
            />
          </div>
        )}
        

        </div>
      </div>
    </div>
    { isOpen && <Communitie_modal isOpen={isOpen} data={communitiesData} close={closeCommunityModal } setCommunity={setCommunity} />}
{uploadModalOpen && <Upload_modal  setVideoId={setVideoId} accessToken={accessToken} username={username} isOpen={uploadModalOpen} close={toggleUploadModal} setThumbnailFile={setThumbnailFile} thumbnailFile={thumbnailFile} /> }
{benficaryOpen && <Beneficiary_modal close={toggleBeneficiaryModal} isOpen={benficaryOpen} setBeneficiaries={setBeneficiaries} />  }
    </>
  );
}

export default TestStudio;



