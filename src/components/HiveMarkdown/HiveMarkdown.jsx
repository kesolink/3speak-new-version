import { useEffect, useState, useRef } from 'react';
import { FaChevronDown, FaChevronUp } from 'react-icons/fa';
import './HiveMarkdown.scss';

// Lazy-load the Hive markdown renderer (same config as the post-body renderer)
// to avoid Node polyfill cost at bundle time and share the singleton.
let rendererPromise = null;
const getRenderer = async () => {
  if (!rendererPromise) {
    rendererPromise = import('@snapie/renderer').then(({ createHiveRenderer }) =>
      createHiveRenderer({
        ipfsGateway: 'https://hotipfs-3speak-1.b-cdn.net',
        ipfsFallbackGateways: [
          'https://ipfs.skatehive.app',
          'https://cloudflare-ipfs.com',
          'https://ipfs.io',
        ],
        convertHiveUrls: true,
        internalUrlPrefix: '',
        usertagUrlFn: (account) => `/p/${account}`,
        hashtagUrlFn: (tag) => `/t/${tag}`,
      })
    );
  }
  return rendererPromise;
};

/**
 * Renders a Hive markdown/HTML string (post body, community description, …) to
 * sanitized HTML via @snapie/renderer. Reusable wherever Hive-flavoured
 * markdown needs to be displayed outside the main post body.
 *
 * When `collapsible` is set, long content is clipped to `collapsedHeight` with a
 * fade and a "Show more / Show less" toggle — the same UX as the video
 * description.
 */
export default function HiveMarkdown({ body, className = '', collapsible = false, collapsedHeight = 140 }) {
  const [html, setHtml] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [needsCollapse, setNeedsCollapse] = useState(false);
  const contentRef = useRef(null);

  useEffect(() => {
    if (!body) {
      setHtml('');
      return;
    }
    let cancelled = false;
    getRenderer()
      .then((render) => {
        if (cancelled) return;
        try {
          setHtml(render(body));
        } catch {
          setHtml('');
        }
      })
      .catch(() => {
        if (!cancelled) setHtml('');
      });
    return () => {
      cancelled = true;
    };
  }, [body]);

  // Decide whether the content is tall enough to warrant collapsing.
  useEffect(() => {
    if (!collapsible || !html || !contentRef.current) return;
    const id = requestAnimationFrame(() => {
      const h = contentRef.current?.scrollHeight || 0;
      setNeedsCollapse(h > collapsedHeight + 24);
    });
    return () => cancelAnimationFrame(id);
  }, [collapsible, html, collapsedHeight]);

  if (!html) return null;

  const collapsed = collapsible && needsCollapse && !expanded;

  return (
    <div className={`hive-markdown-block ${className}`.trim()}>
      <div className="hive-markdown-clip">
        <div
          ref={contentRef}
          className={`hive-markdown markdown-view${collapsed ? ' is-collapsed' : ''}`}
          style={collapsed ? { maxHeight: collapsedHeight } : undefined}
          dangerouslySetInnerHTML={{ __html: html }}
        />
        {collapsed && <div className="hive-markdown-fade" />}
      </div>

      {collapsible && needsCollapse && (
        <button
          type="button"
          className="hive-markdown-toggle"
          onClick={() => setExpanded((e) => !e)}
        >
          <span>{expanded ? 'Show less' : 'Show more'}</span>
          {expanded ? <FaChevronUp /> : <FaChevronDown />}
        </button>
      )}
    </div>
  );
}
