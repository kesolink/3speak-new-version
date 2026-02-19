import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Loader2 } from 'lucide-react';
import { getEditorUrl } from '../../utils/config';
import { useAppStore } from '../../lib/store';
import './EditorModal.scss';

function EditorModal({ isOpen, onClose, videoUrl, videoName, videoType, clipStart, clipEnd }) {
  const iframeRef = useRef(null);
  const mediaLoadedRef = useRef(false);
  const [editorReady, setEditorReady] = useState(false);
  const { theme, getEffectiveTheme } = useAppStore();
  const [renderStatus, setRenderStatus] = useState(null); // null | 'sending' | 'rendering' | 'complete' | 'error'
  const [renderProgress, setRenderProgress] = useState(0);
  const [renderedVideoUrl, setRenderedVideoUrl] = useState(null);
  const pollIntervalRef = useRef(null);

  // Resolved editor URL (picked from the configured list on each open)
  const [resolvedUrl, setResolvedUrl] = useState(null);
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState(false);

  // Resolve a working editor URL when the modal opens
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setResolving(true);
    setResolveError(false);
    setResolvedUrl(null);
    setEditorReady(false);
    mediaLoadedRef.current = false;

    getEditorUrl().then(url => {
      if (cancelled) return;
      if (url) {
        setResolvedUrl(url);
      } else {
        setResolveError(true);
      }
      setResolving(false);
    });

    return () => { cancelled = true; };
  }, [isOpen]);

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [isOpen]);

  // Send message to editor iframe
  const sendToEditor = useCallback((message) => {
    if (iframeRef.current?.contentWindow && resolvedUrl) {
      iframeRef.current.contentWindow.postMessage(message, new URL(resolvedUrl).origin);
    }
  }, [resolvedUrl]);

  // Send theme to editor when ready or when theme changes
  useEffect(() => {
    if (editorReady) {
      sendToEditor({ type: 'set-theme', theme: getEffectiveTheme() });
    }
  }, [editorReady, theme, sendToEditor, getEffectiveTheme]);

  // Listen for messages from editor iframe
  useEffect(() => {
    if (!isOpen || !resolvedUrl) return;

    const handleMessage = (event) => {
      // Validate origin
      try {
        const editorOrigin = new URL(resolvedUrl).origin;
        if (event.origin !== editorOrigin) return;
      } catch {
        return;
      }

      const { data } = event;
      if (!data || data.source !== '3speak-editor') return;

      switch (data.type) {
        case 'editor-ready':
          setEditorReady(true);
          // If we have a video to pre-load (remix mode), send it once
          if (videoUrl && !mediaLoadedRef.current) {
            mediaLoadedRef.current = true;
            const msg = {
              type: 'load-media',
              url: videoUrl,
              name: videoName || 'Short Video',
              mediaType: videoType || 'video'
            };
            if (clipStart != null) msg.clipStart = clipStart;
            if (clipEnd != null) msg.clipEnd = clipEnd;
            sendToEditor(msg);
          }
          break;

        case 'render-request':
          handleRenderRequest(data.timeline);
          break;

        case 'editor-closed':
          handleClose();
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [isOpen, resolvedUrl, videoUrl, videoName, videoType, clipStart, clipEnd, sendToEditor]);

  // Handle render request from editor
  const handleRenderRequest = async (timeline) => {
    setRenderStatus('sending');

    try {
      // Collect media URLs from timeline
      const mediaUrls = [];
      for (const track of timeline.tracks || []) {
        for (const clip of track.clips || []) {
          if (clip.url) {
            mediaUrls.push({ id: clip.id, url: clip.url, type: clip.type });
          }
        }
      }

      const response = await fetch('/api/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timeline: {
            tracks: timeline.tracks,
            outputWidth: 1280,
            outputHeight: 720,
            fps: 30
          },
          mediaUrls
        })
      });

      if (!response.ok) throw new Error('Render request failed');

      const { jobId } = await response.json();
      setRenderStatus('rendering');
      startPolling(jobId);
    } catch (err) {
      console.error('[EditorModal] Render request error:', err);
      console.log('[EditorModal] Timeline state for future render:', JSON.stringify(timeline, null, 2));
      setRenderStatus('error');
    }
  };

  // Poll render status
  const startPolling = (jobId) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

    pollIntervalRef.current = setInterval(async () => {
      try {
        const response = await fetch(`/api/render/${jobId}`);
        const data = await response.json();

        setRenderProgress(data.progress || 0);

        if (data.status === 'complete') {
          clearInterval(pollIntervalRef.current);
          setRenderStatus('complete');
          setRenderedVideoUrl(data.outputUrl);
        } else if (data.status === 'error') {
          clearInterval(pollIntervalRef.current);
          setRenderStatus('error');
        }
      } catch {
        // Keep polling on transient errors
      }
    }, 2000);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  const handleClose = () => {
    if (editorReady && !window.confirm('Are you sure you want to close the editor? Unsaved changes will be lost.')) {
      return;
    }
    setEditorReady(false);
    setRenderStatus(null);
    setRenderProgress(0);
    setRenderedVideoUrl(null);
    setResolvedUrl(null);
    setResolveError(false);
    mediaLoadedRef.current = false;
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    onClose();
  };

  const handleUseRenderedVideo = () => {
    if (renderedVideoUrl) {
      window.open(renderedVideoUrl, '_blank');
    }
    handleClose();
  };

  if (!isOpen) return null;

  return (
    <div className="editor-modal">
      <div className="editor-modal-overlay" onClick={handleClose}></div>
      <div className="editor-modal-content">
        <div className="editor-modal-body">
          {/* Show iframe only after a working URL is resolved */}
          {resolvedUrl && (
            <iframe
              ref={iframeRef}
              src={resolvedUrl}
              className="editor-iframe"
              allow="cross-origin-isolated; camera; microphone"
              title="3Speak Video Editor"
            />
          )}

          {/* Loading overlay — resolving URL or waiting for editor ready */}
          {(resolving || (!editorReady && !resolveError)) && (
            <div className="editor-loading-overlay">
              <Loader2 size={40} className="spinner" />
              <span>{resolving ? 'Finding available editor...' : 'Loading editor...'}</span>
            </div>
          )}

          {/* Error: no editor available */}
          {resolveError && (
            <div className="editor-loading-overlay">
              <span>No editor server is currently available. Please try again later.</span>
              <button className="render-btn" onClick={handleClose} style={{ marginTop: 16 }}>
                Close
              </button>
            </div>
          )}

          {/* Render status overlay */}
          {renderStatus && (
            <div className="render-overlay">
              {renderStatus === 'sending' && (
                <div className="render-status">
                  <Loader2 size={32} className="spinner" />
                  <span>Sending to render service...</span>
                </div>
              )}
              {renderStatus === 'rendering' && (
                <div className="render-status">
                  <div className="render-progress-bar">
                    <div className="render-progress-fill" style={{ width: `${renderProgress}%` }} />
                  </div>
                  <span>Rendering... {Math.round(renderProgress)}%</span>
                </div>
              )}
              {renderStatus === 'complete' && (
                <div className="render-status">
                  <span>Render complete!</span>
                  <button className="render-btn" onClick={handleUseRenderedVideo}>
                    Use Video
                  </button>
                </div>
              )}
              {renderStatus === 'error' && (
                <div className="render-status render-error">
                  <span>Render service not available yet. Timeline data logged to console.</span>
                  <button className="render-btn" onClick={() => setRenderStatus(null)}>
                    Back to Editor
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default EditorModal;
