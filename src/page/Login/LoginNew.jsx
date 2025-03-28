import  { useEffect, useState } from "react";
import axios from "axios";
import * as tus from "tus-js-client";
// import hive from "@hiveio/hive-js";
import dhive from "@hiveio/dhive";

const client = axios.create({});

const studioEndPoint = "https://studio.3speak.tv";
const tusEndPoint = "https://uploads.3speak.tv/files/";
// const studioEndPoint = "http://localhost:13050";
// const tusEndPoint = "http://0.0.0.0:1080/files/";

function LoginNew() {
  const [username, setUsername] = useState("");
  const [postingKey, setPostingKey] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [thumbUrl, setThumbUrl] = useState("");
  const [videoId, setVideoId] = useState("");
  const [thumbnailIpfs, setThumbnailIpfs] = useState("");

  useEffect(()=>{
    console.log("Access token:", accessToken)
  },[accessToken])

  function handleUsernameChange(event) {
    setUsername(event.target.value);
  }

  function handlePostingKeyChange(event) {
    setPostingKey(event.target.value);
  }

  function handleVideoUrlChange(event) {
    setVideoUrl(event.target.value);
  }

  function handleThumbUrlChange(event) {
    setThumbUrl(event.target.value);
  }

  async function logMe() {
    try {
      let response = await client.get(
        `${studioEndPoint}/mobile/login?username=${username}`,
        {
          withCredentials: false,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
      console.log(`Response: ${JSON.stringify(response)}`);
      const memo = response.data.memo;
      console.log(`Memo - ${response.data.memo}`);
      const keychain = window.hive_keychain;
      keychain.requestVerifyKey(
        username,
        memo,
        "Posting",
        (response) => {
          if (response.success === true) {
            const decodedMessage = response.result.replace("#", "");
            console.log(`Decrypted ${decodedMessage}\n\n`);
            setAccessToken(decodedMessage);
          }
        }
      );
      // let access_token = hive.memo.decode(postingKey, memo);
      let access_token = dhive.memo.decode(postingKey, memo);
    //   access_token = access_token.replace("#", "");
    //   console.log(`Decrypted ${access_token}\n\n`);
    //   setAccessToken(access_token);
    } catch (err) {
      console.log(err);
      throw err;
    }
  }

  async function uploadInfo() {
    const data = await updateVideoInfo(
      "test-demo-video.mp4",
      videoUrl,
      thumbUrl
    );
    console.log(`Video upload response: ${JSON.stringify(data)}`);
    setVideoId(data._id);
    setThumbnailIpfs(data.thumbnail);
  }

  async function saveDetails() {
    const data = await saveVideoInfo();
    console.log(`Video upload response: ${JSON.stringify(data)}`);
  }

  async function getAllVideoStatuses() {
    try {
      let response = await client.get(
        `${studioEndPoint}/mobile/api/my-videos`,
        {
          withCredentials: false,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );
      console.log(`All videos data\n${JSON.stringify(response.data)}`);
      return response.data;
    } catch (err) {
      console.log(err);
      throw err;
    }
  }

  async function saveVideoInfo() {
    try {
      const { data } = await axios.post(
        `${studioEndPoint}/mobile/api/update_info`,
        {
          beneficiaries:
            "[{\"account\":\"reward.app\",\"weight\":500}, {\"account\":\"inleo\",\"weight\":500}]",
          description:
            "Post content goes here. This is a test video.<br/><sub>Uploaded using 3Speak Mobile App</sub>",
          videoId: videoId,
          title: "Hey @InLeo! This is a test video for you.",
          isNsfwContent: false, // is this a not-safe-for-work-content? No. it is not. so false,
          tags: "threespeak,sagarkothari88,test,inleo,assistance,help,integrate",
          thumbnail: thumbUrl,
          communityID: "hive-181335", // it's threespeak community-id. It can be anything.
        },
        {
          withCredentials: false,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );
      return data;
    } catch (e) {
      console.error(e);
      throw e;
    }
  }

  async function updateVideoInfo(oFilename, videoUrl, thumbnailUrl) {
    try {
      const { data } = await axios.post(
        `${studioEndPoint}/mobile/api/upload_info`,
        {
          filename: videoUrl,
          oFilename: oFilename,
          size: 9609313, // NOTE: please change this constant value. This is POC app. It has to be in bytes.
          duration: 40, // NOTE: please change this constant value. This is POC app. it has to be in seconds.
          thumbnail: thumbnailUrl, // NOTE: please change this constant value. This is POC app. It
          owner: username,
          isReel: false, // if video is a reel/short (Three Shorts) send this as true
        },
        {
          withCredentials: false,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );
      return data;
    } catch (e) {
      console.error(e);
      throw e;
    }
  }

  function onChange(event) {
    var file = event.target.files[0];
    console.log(file);
    var upload = new tus.Upload(file, {
      // Endpoint is the upload creation URL from your tus server
      endpoint: tusEndPoint,
      // Retry delays will enable tus-js-client to automatically retry on errors
      retryDelays: [0, 3000, 5000, 10000, 20000],
      // Attach additional meta data about the file for the server
      metadata: {
        filename: file.name,
        filetype: file.type,
      },
      // Callback for errors which cannot be fixed using retries
      onError: function (error) {
        console.log("Failed because: " + error);
      },
      // Callback for reporting upload progress
      onProgress: function (bytesUploaded, bytesTotal) {
        var percentage = ((bytesUploaded / bytesTotal) * 100).toFixed(2);
        console.log(bytesUploaded, bytesTotal, percentage + "%");
      },
      // Callback for once the upload is completed
      onSuccess: function () {
        console.log("File %s", upload.file.name);
        console.log("URL %s", upload.url.replace(tusEndPoint, ""));
      },
    });
    upload.start();
  }

  return (
    <div className="App">
      <div>
        <label>Username: </label>
        <input type="text" onChange={handleUsernameChange} value={username} />
      </div>
      <div>
        <label>Posting Key: </label>
        <input
          type="password"
          onChange={handlePostingKeyChange}
          value={postingKey}
        />
      </div>

      <div>
        <button onClick={logMe}>Login</button>
      </div>

      <input type="file" onChange={onChange} />

      <div>
        <label>Video URL: </label>
        <input type="text" onChange={handleVideoUrlChange} value={videoUrl} />
      </div>

      <div>
        <label>Thumb URL: </label>
        <input type="text" onChange={handleThumbUrlChange} value={thumbUrl} />
      </div>

      <div>
        <button onClick={uploadInfo}>Upload Info</button>
        <button onClick={getAllVideoStatuses}>My Videos</button>
        <button onClick={saveDetails}>Save Details</button>
      </div>
    </div>
  );
}

export default LoginNew