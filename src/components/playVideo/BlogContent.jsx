import React, { useEffect, useState, useRef } from "react";
import { createRoot } from "react-dom/client";
import { getUersContent } from "../../utils/hiveUtils";
import "./BlogContent.scss";
import { FaChevronDown, FaChevronUp } from "react-icons/fa";
import { TailChase } from 'ldrs/react';
import AudioPlayerInline from "../AudioPlayerInline/AudioPlayerInline";

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

const THRESHOLD_HEIGHT = 100;

const BlogContent = ({ author, permlink, description, alwaysExpanded = false }) => {
  const [content, setContent] = useState("");
  const [renderedContent, setRenderedContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(alwaysExpanded);
  const [needsExpansion, setNeedsExpansion] = useState(false);
  const contentRef   = useRef(null);
  const audioUrlsRef = useRef([]);
  const audioRootsRef = useRef([]);

  const cleanContent = (htmlString) => {
    let cleaned = htmlString;

    // Pattern 1: The rendered video embed (iframe from @snapie/renderer)
    cleaned = cleaned.replace(
      /<div[^>]*class="[^"]*video-container[^"]*"[^>]*>[\s\S]*?<iframe[^>]*src="[^"]*3speak\.tv[^"]*"[^>]*>[\s\S]*?<\/iframe>[\s\S]*?<\/div>/gi,
      ''
    );

    // Pattern 2: Direct iframe embeds for 3speak video (not audio.3speak.tv)
    cleaned = cleaned.replace(
      /<iframe[^>]*src="https?:\/\/(?:embed\.)?3speak\.tv[^"]*"[^>]*>[\s\S]*?<\/iframe>/gi,
      ''
    );

    // Pattern 3: The rendered video embed link with thumbnail
    cleaned = cleaned.replace(
      /<p[^>]*>[\s]*<a[^>]*class="[^"]*markdown-video-link[^"]*"[^>]*data-embed-src="https:\/\/3speak\.tv\/embed[^"]*"[^>]*>[\s\S]*?<\/a>[\s]*<\/p>/gi,
      ''
    );

    // Pattern 4: "Watch on 3Speak" link with play emoji (as paragraph)
    cleaned = cleaned.replace(
      /<p[^>]*>[\s]*[▶️]*[\s]*<a[^>]*href="https:\/\/3speak\.tv\/watch[^"]*"[^>]*>[\s]*Watch on 3Speak[\s]*<\/a>[\s]*<\/p>/gi,
      ''
    );

    // Pattern 5: Standalone "Watch on 3Speak" links with emoji
    cleaned = cleaned.replace(
      /▶️[\s]*<a[^>]*href="https:\/\/3speak\.tv\/watch[^"]*"[^>]*>[^<]*<\/a>/gi,
      ''
    );

    // Pattern 6: Thumbnail image linking to 3speak watch page
    cleaned = cleaned.replace(
      /<a[^>]*href="https:\/\/3speak\.tv\/watch[^"]*"[^>]*>[\s]*<img[^>]*>[\s]*<\/a>/gi,
      ''
    );

    // YouTube: keep the original link in the body instead of an embedded player.
    // (The underlying renderer auto-embeds YouTube URLs; we undo that.) Handles
    // youtube.com/embed, youtube-nocookie.com, youtu.be and ?v= forms.
    const ytIdFrom = (src) => {
      const m = src.match(/(?:youtube(?:-nocookie)?\.com\/embed\/|youtu\.be\/|[?&]v=)([A-Za-z0-9_-]{6,})/);
      return m ? m[1] : null;
    };
    const ytLink = (id) => {
      const url = `https://www.youtube.com/watch?v=${id}`;
      return `<p><a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a></p>`;
    };
    cleaned = cleaned.replace(
      /<div[^>]*class="[^"]*videoWrapper[^"]*"[^>]*>\s*<iframe[^>]*src="([^"]*(?:youtube(?:-nocookie)?\.com|youtu\.be)[^"]*)"[^>]*>\s*<\/iframe>\s*<\/div>/gi,
      (m, src) => { const id = ytIdFrom(src); return id ? ytLink(id) : m; }
    );
    cleaned = cleaned.replace(
      /<iframe[^>]*src="([^"]*(?:youtube(?:-nocookie)?\.com|youtu\.be)[^"]*)"[^>]*>\s*<\/iframe>/gi,
      (m, src) => { const id = ytIdFrom(src); return id ? ytLink(id) : m; }
    );

    // Pattern 7: Remove leading <hr> separating header from content
    cleaned = cleaned.replace(/^[\s]*<hr[^>]*\/?>/i, '');
    cleaned = cleaned.replace(/^[\s]*<hr[^>]*\/?>/i, '');

    cleaned = cleaned.replace(/<sub>[\s]*Uploaded using 3Speak[^<]*<\/sub>/gi, '');
    cleaned = cleaned.replace(/<p[^>]*>[\s]*<\/p>/g, '');
    cleaned = cleaned.replace(/<center>[\s]*<\/center>/gi, '');
    cleaned = cleaned.trim();

    return cleaned;
  };

  async function getPostDescription(author, permlink) {
    const data = await getUersContent(author, permlink);
    return data?.body;
  }

  useEffect(() => {
    async function fetchContent() {
      setLoading(true);
      try {
        if (description) {
          setContent(description);
        } else if (author && permlink) {
          const postContent = await getPostDescription(author, permlink);
          setContent(postContent || "No content available");
        }
      } catch (err) {
        console.error('Failed fetching post content:', err);
        setContent('Error loading content.');
      }
    }
    fetchContent();
  }, [author, permlink, description]);

  useEffect(() => {
    if (!content) return;
    setLoading(true);

    const contentString =
      typeof content === "string"
        ? content
        : Array.isArray(content)
        ? content.join("\n")
        : "";

    getRenderer()
      .then((render) => {
        try {
          let renderedHTML = render(contentString);
          renderedHTML = cleanContent(renderedHTML);

          // Extract audio.3speak.tv containers and replace with React mount slots
          const urls = [];
          renderedHTML = renderedHTML.replace(
            /<div class="audio-container">[\s\S]*?<\/div>/gi,
            (match) => {
              const srcMatch = match.match(/src="([^"]+)"/i);
              if (!srcMatch || !srcMatch[1].includes('audio.3speak.tv')) return match;
              const idx = urls.length;
              urls.push(srcMatch[1]);
              return `<div class="audio-player-slot" data-idx="${idx}"></div>`;
            }
          );
          audioUrlsRef.current = urls;
          setRenderedContent(renderedHTML);
        } catch (error) {
          console.error("Error rendering post body:", error);
          setRenderedContent("Error processing content.");
        }
      })
      .catch((error) => {
        console.error("Error loading renderer:", error);
        setRenderedContent("Error loading renderer.");
      })
      .finally(() => setLoading(false));
  }, [content]);

  // Mount native React audio players into the slots left by the renderer
  useEffect(() => {
    audioRootsRef.current.forEach(r => r.unmount());
    audioRootsRef.current = [];

    if (!contentRef.current || !audioUrlsRef.current.length) return;

    const slots = contentRef.current.querySelectorAll('.audio-player-slot');
    slots.forEach((slot) => {
      const idx = parseInt(slot.dataset.idx, 10);
      const url = audioUrlsRef.current[idx];
      if (url) {
        const root = createRoot(slot);
        root.render(<AudioPlayerInline src={url} />);
        audioRootsRef.current.push(root);
      }
    });

    return () => {
      audioRootsRef.current.forEach(r => r.unmount());
      audioRootsRef.current = [];
    };
  }, [renderedContent]);

  // Check if content needs expansion after rendering
  useEffect(() => {
    if (alwaysExpanded) return;
    if (contentRef.current && renderedContent) {
      requestAnimationFrame(() => {
        const contentHeight = contentRef.current?.scrollHeight || 0;
        setNeedsExpansion(contentHeight > THRESHOLD_HEIGHT);
      });
    }
  }, [renderedContent, alwaysExpanded]);

  const toggleExpand = () => setIsExpanded(!isExpanded);

  return (
    <div className="blog-content-container">
      <div
        className={`content-wrapper ${needsExpansion && !isExpanded ? 'collapsed' : 'expanded'}`}
        ref={contentRef}
      >
        {loading ? (
          <div className="blog-loading">
            <div className="loader-center">
              <TailChase size={16} speed={1.5} color="var(--accent-primary)" />
            </div>
          </div>
        ) : (
          <div
            className="markdown-view"
            dangerouslySetInnerHTML={{ __html: renderedContent }}
          />
        )}
        {needsExpansion && !isExpanded && <div className="fade-overlay" />}
      </div>

      {needsExpansion && (
        <div className="expand-toggle" onClick={toggleExpand}>
          <span>{isExpanded ? "Show less" : "Show more"}</span>
          {isExpanded ? <FaChevronUp /> : <FaChevronDown />}
        </div>
      )}
    </div>
  );
};

export default BlogContent;
