import React, { useEffect } from "react";
import { useQuill } from "react-quilljs";
// import "quill/dist/quill.snow.css";

const TextEditor = ({ description, setDescription }) => {
  const { quill, quillRef } = useQuill({
    placeholder: "Enter your description here...",
    modules: {
      toolbar: [
        ['bold', 'italic', 'underline'],
        [{ list: 'ordered' }, { list: 'bullet' }],
        ['link']
      ]
    },
    theme: 'snow',
    bounds: document.body,
    scrollingContainer: 'html',
  });

  // Set initial content ONCE when Quill is ready
  useEffect(() => {
    if (quill && description) {
      quill.clipboard.dangerouslyPasteHTML(description);
      
      // Explicitly set LTR direction
      quill.root.style.direction = 'ltr';
      quill.root.setAttribute('dir', 'ltr');
    }
  }, [quill]);

  // Update parent state on text changes
  useEffect(() => {
    if (!quill) return;

    const handler = () => {
      const html = quill.root.innerHTML;
      if (html !== description) {
        setDescription(html);
      }
    };

    quill.on('text-change', handler);
    return () => quill.off('text-change', handler);
  }, [quill, setDescription]);

  return (
    <div style={{ 
      width: '100%', 
      height: 270,
      direction: 'ltr' // Ensure parent container is LTR
    }}>
      <div ref={quillRef} dir="ltr" /> {/* Explicit LTR on editor */}
    </div>
  );
};

export default TextEditor;