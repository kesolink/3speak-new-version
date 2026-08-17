import React, { useMemo, useState, useEffect } from "react";
import { getPostBodyRenderer } from '../../lib/hiveRenderer';
import "./EditorPreview.scss";

const EditorPreview = ({ content }) => {
  const [renderedContent, setRenderedContent] = useState("");

  useEffect(() => {
    if (!content) {
      setRenderedContent("");
      return;
    }
    
    getPostBodyRenderer().then(render => {
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

