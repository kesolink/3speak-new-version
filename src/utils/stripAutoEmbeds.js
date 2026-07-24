/**
 * Remove auto-generated embeds from rendered Hive-post HTML.
 *
 * The Hive markdown renderer (@snapie/renderer) turns bare media URLs in a post
 * body into embedded players (iframes / video-wrapper divs / "markdown-video-link"
 * anchors). We don't want ANY of those auto-players inside the post body, so this
 * converts each one to a plain link (so the URL isn't lost). Two exceptions:
 *   - 3Speak VIDEO embeds are dropped entirely — the page already has its own
 *     player, so an auto-embed would just duplicate it (this also catches the
 *     `play.3speak.tv/embed` URL our own uploads now lead the body with).
 *   - `audio.3speak.tv` containers are left untouched — BlogContent mounts those
 *     as real inline audio players.
 */

// Turn one embed's src into a plain link (or drop it). `m` = the original match,
// returned unchanged for things we must keep (audio).
function embedToLink(m, src) {
  const s = String(src || '');
  if (/audio\.3speak\.tv/i.test(s)) return m;            // keep — mounted as an audio player
  if (/(?:\/\/|\.)3speak\.tv/i.test(s)) return '';        // 3Speak video (3speak.tv / play. / embed.) → drop
  const yt = s.match(/(?:youtube(?:-nocookie)?\.com\/embed\/|youtu\.be\/|[?&]v=)([A-Za-z0-9_-]{6,})/);
  const url = yt ? `https://www.youtube.com/watch?v=${yt[1]}` : s;
  return `<p><a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a></p>`;
}

export function stripAutoEmbeds(html) {
  if (typeof html !== 'string' || !html) return html;
  let out = html;

  // 1. Auto-embed link anchors (the renderer's video-embed-link format), any host.
  out = out.replace(
    /<p[^>]*>\s*<a[^>]*class="[^"]*markdown-video-link[^"]*"[^>]*>[\s\S]*?<\/a>\s*<\/p>/gi,
    ''
  );

  // 2. Embeds wrapped in a container div (videoWrapper / video-container / *embed*).
  out = out.replace(
    /<div[^>]*class="[^"]*(?:videoWrapper|video-container|embed)[^"]*"[^>]*>\s*<iframe[^>]*\bsrc="([^"]+)"[^>]*>[\s\S]*?<\/iframe>\s*<\/div>/gi,
    (m, src) => embedToLink(m, src)
  );

  // 3. Any remaining bare iframe (any host).
  out = out.replace(
    /<iframe[^>]*\bsrc="([^"]+)"[^>]*>[\s\S]*?<\/iframe>/gi,
    (m, src) => embedToLink(m, src)
  );

  // 4. A BARE 3Speak URL that the renderer auto-linked into its own paragraph.
  //    Our uploads and OpenPods announcements lead the body with
  //    `play.3speak.tv/embed?v=…`, which never becomes an iframe (so the rules
  //    above miss it) yet shouldn't be printed above the description — the page
  //    already has the player. Only paragraphs that are JUST that link are
  //    dropped, so a labelled link ("▶ Watch on 3speak.tv") is kept.
  out = out.replace(
    /<p[^>]*>\s*<a[^>]*\bhref="([^"]+)"[^>]*>([\s\S]*?)<\/a>\s*<\/p>/gi,
    (m, href, text) => {
      if (!/(?:\/\/|\.)3speak\.tv/i.test(href)) return m;
      const norm = (s) => String(s).trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
      return norm(text) === norm(href) ? '' : m;
    }
  );

  return out;
}
