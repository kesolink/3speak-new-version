import React, { useMemo, useState, useEffect } from "react";
import "./EditorPreview.scss";

// Lazy-loaded renderer to avoid Node.js polyfill issues at bundle time
let rendererPromise = null;
const getRenderer = async () => {
  if (!rendererPromise) {
    rendererPromise = import('@snapie/renderer').then(({ createHiveRenderer }) => {
      return createHiveRenderer({
        ipfsGateway: 'https://hotipfs-3speak-1.b-cdn.net',
        ipfsFallbackGateways: [
          'https://ipfs.skatehive.app',
          'https://cloudflare-ipfs.com',
          'https://ipfs.io'
        ],
        convertHiveUrls: true,
        internalUrlPrefix: '',
        usertagUrlFn: (account) => `/p/${account}`,
        hashtagUrlFn: (tag) => `/t/${tag}`,
      });
    });
  }
  return rendererPromise;
};

const EditorPreview = ({ content }) => {
  const [renderedContent, setRenderedContent] = useState("");

  useEffect(() => {
    if (!content) {
      setRenderedContent("");
      return;
    }
    
    getRenderer().then(render => {
      try {
        setRenderedContent(render(content));
      } catch (error) {
        console.error("Error rendering content:", error);
        setRenderedContent("<p>Error rendering content</p>");
      }
    });
  }, [content]);

  return (
    <div className="editor-preview">
      <div 
        className="preview-content markdown-view"
        dangerouslySetInnerHTML={{ __html: renderedContent }}
      />
    </div>
  );
};

export default EditorPreview;

