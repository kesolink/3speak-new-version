// HiveImageUploader.jsx — standalone image uploader (/image).
// Uploads through the shared image pipeline: the @threespeak backend signs the
// hive.blog challenge server-side (works for every login, no pasted keys), with
// fallbacks to user-signed hive.blog / the 3Speak image server.
import React, { useState, useRef } from 'react';
import './HiveImageUploader.scss';
import { uploadThumbnail } from '../utils/uploadThumbnail';

const HiveImageUploader = () => {
  const [selectedImage, setSelectedImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState('');
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  // Handle file selection
  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('Image size must be less than 10MB');
      return;
    }

    setSelectedImage(file);
    setError('');
    setUploadedUrl('');

    const reader = new FileReader();
    reader.onloadend = () => setPreview(reader.result);
    reader.readAsDataURL(file);
  };

  // Upload via the @threespeak-backed image pipeline
  const handleUpload = async () => {
    if (!selectedImage) {
      setError('Please select an image first');
      return;
    }

    setUploading(true);
    setError('');

    try {
      const url = await uploadThumbnail(selectedImage);
      setUploadedUrl(url);
      setError('');
    } catch (err) {
      setError(err?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(uploadedUrl);
    alert('URL copied to clipboard!');
  };

  const handleReset = () => {
    setSelectedImage(null);
    setPreview(null);
    setUploadedUrl('');
    setError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="hive-image-uploader">
      <div className="uploader-container">
        <h2>Hive Image Uploader</h2>

        {/* File Upload Section */}
        <div className="upload-section">
          <div
            className={`drop-zone ${selectedImage ? 'has-image' : ''}`}
            onClick={() => fileInputRef.current?.click()}
          >
            {preview ? (
              <img src={preview} alt="Preview" className="preview-image" />
            ) : (
              <div className="drop-zone-content">
                <svg className="upload-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p>Click to select an image</p>
                <span>PNG, JPG, GIF up to 10MB</span>
              </div>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="file-input"
          />

          {selectedImage && (
            <div className="file-info">
              <p className="file-name">{selectedImage.name}</p>
              <p className="file-size">
                {(selectedImage.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="error-message">
            <span>❌</span> {error}
          </div>
        )}

        {/* Upload Button */}
        <div className="button-group">
          <button
            className="btn btn-primary"
            onClick={handleUpload}
            disabled={!selectedImage || uploading}
          >
            {uploading ? (
              <>
                <span className="spinner"></span>
                Uploading...
              </>
            ) : (
              'Upload Image'
            )}
          </button>

          {selectedImage && (
            <button className="btn btn-secondary" onClick={handleReset}>
              Reset
            </button>
          )}
        </div>

        {/* Success Result */}
        {uploadedUrl && (
          <div className="success-section">
            <div className="success-message">
              <span>✅</span> Image uploaded successfully!
            </div>
            <div className="url-display">
              <input
                type="text"
                value={uploadedUrl}
                readOnly
                className="url-input"
              />
              <button className="btn btn-copy" onClick={copyToClipboard}>
                Copy
              </button>
            </div>
            <div className="uploaded-preview">
              <img src={uploadedUrl} alt="Uploaded" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default HiveImageUploader;
