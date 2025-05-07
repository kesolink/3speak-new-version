import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Edit, Save } from 'lucide-react';
import "./EditVideo.scss";
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { renderPostBody } from "@ecency/render-helper";
import { convert } from 'html-to-text';
import axios from 'axios';
import { API_URL_FROM_WEST } from '../utils/config';

const EditVideo = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [date, setDate] = useState('');
  const [permlink, setPermlink] = useState("")
  const [ id, setId ] = useState("");
  const accessToken = localStorage.getItem("access_token");

  const video = location.state?.video;
  console.log(id)
  console.log(video)

  useEffect(() => {
    if (video) {
      setTitle(video.title);

      const plainText = convert(video.description, {
        wordwrap: false,
        selectors: [
          { selector: 'br', format: 'block' },
          { selector: 'p', format: 'block' },
          { selector: 'sub', format: 'inline' }
        ]
      });

      setDescription(plainText.trim());
      setTags(video.tags);
      setThumbnailUrl(video.thumbUrl);
      setDate(video.created);
      setPermlink(video.permlink)
      setId(video._id)
    } else {
      toast.error('Video not found');
    }
  }, [id, navigate, video]);

  console.log(permlink)
  console.log(id)



  const handleSubmit = async (e) => {
    e.preventDefault();

    // Optional: convert plain text back to simple HTML with paragraphs
    const htmlDescription = description
      .split('\n\n') // double line breaks = new paragraph
      .map(paragraph => `<p>${paragraph.replace(/\n/g, ' ')}</p>`)
      .join('');
      const data = {
        'title': title,
        'description': description,
        'tags': tags,
        '_id': id,
        'permlink': permlink,
        
        
    }

    console.log(data)

      try{
        const response = await axios.post(API_URL_FROM_WEST + "/v1/upload/update_post", data, { headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`, // This must be set from the browser session or via a proxy
          withCredentials: true
        }}  )
    toast.success('Video updated successfully');
    console.log("Video updated:", response.data);
    setTimeout(() => navigate('/'), 1500);

      }
      // catch (err){
      //   console.error("Something went wrong:", err);
      //   toast.error('Failed to update video');
      // }

      catch (err) {
        if (err.response) {
          // Server responded with a status outside 2xx
          console.error("API error response:", err.response.data);
          console.error("Status:", err.response.status);
          toast.error(`Failed to update video: ${err.response.data?.message || 'Unknown error'}`);
        } else if (err.request) {
          // No response received
          console.error("No response received:", err.request);
          toast.error("No response from server");
        } else {
          // Something else caused the error
          console.error("Error setting up request:", err.message);
          toast.error("Error: " + err.message);
  }
}

    // // Simulate saving with a toast
    // toast.success('Video updated successfully');

    

    // // Navigate home after short delay
    // setTimeout(() => navigate('/'), 1500);

    console.log({
      title,
      description: htmlDescription, // send this to backend if needed
      tags,
      thumbnailUrl,
      permlink,
      id
    });
  };

  const renderedHTML = renderPostBody(description, false);

  if (loading) {
    return (
      <div className="page-loading">
        <div className="spinner"></div>
        <p>Loading video details...</p>
      </div>
    );
  }

  return (
    <div className="edit-page">
      <div className="header">
        <h1>
          <Edit className="edit-icon" />
          Edit Video
        </h1>
      </div>

      <div className="content">
        <div className="form-container">
          <form className="edit-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="title">Title</label>
              <input 
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Video title"
                className="form-input"
                required
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="description">Description</label>
              <textarea 
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Video description"
                className="form-textarea"
                rows={8}
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="tags">Tags (comma separated)</label>
              <input
                id="tags"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="tag1,tag2,tag3"
                className="form-input"
              />
            </div>
            
            <div className="form-group form-actions">
              <button 
                type="submit" 
                className="btn btn--primary"
              >
                <Save />
                Update Video
              </button>
            </div>
          </form>
        </div>

        <div className="preview">
          <h2>Preview</h2>
          <div className="video-preview">
            <div className="thumbnail">
              <img src={thumbnailUrl} alt="thumbnail" />
            </div>
            <div className="content-pre">
              <h3 className="title">{title}</h3>
              <div
                className="markdown-view"
                dangerouslySetInnerHTML={{ __html: renderedHTML }}
              />
              {tags && (
                <div className="tags">
                  {tags.split(',').map((tag, index) => (
                    <span key={index} className="tag">
                      {tag.trim()}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditVideo;
