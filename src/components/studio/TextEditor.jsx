import React, { useEffect } from "react";
import { useQuill } from "react-quilljs";
import "quill/dist/quill.snow.css";

const TextEditor = ({ description, setDescription }) => {
  const { quill, quillRef } = useQuill({
    placeholder: "Enter your description here...",
    modules: {
      toolbar: [
        ['bold', 'italic', 'underline'],
        [{ 'list': 'ordered' }, { 'list': 'bullet' }],
        ['link', ]
        // ['link', 'image']
      ]
    },
    // 👇 Ensure LTR (Left-to-Right) direction
    theme: 'snow',
    bounds: document.body,
    scrollingContainer: 'html',
  });

  // Set initial content ONCE when Quill is ready
  useEffect(() => {
    if (quill && description) {
      quill.clipboard.dangerouslyPasteHTML(description);
    }
  }, [quill]); // Only runs when Quill initializes

  // Update parent state on text changes (debounced to avoid loops)
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
    <div style={{ width: '100%', height: 270 }}>
      <div ref={quillRef} />
    </div>
  );
};

export default TextEditor;