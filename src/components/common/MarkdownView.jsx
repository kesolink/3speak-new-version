import { memo } from 'react';

/**
 * Rendered-markdown block (`dangerouslySetInnerHTML`), memoised on the HTML string.
 *
 * Why this exists: the watch page re-renders on every playhead tick while a video
 * plays (the "at 0:00" comment timestamp follows it, among other things). Each of
 * those renders made React re-apply `dangerouslySetInnerHTML` on the description,
 * every comment and the reaction thread — and re-applying it tears the existing
 * child nodes out and re-parses fresh ones even when the HTML string is byte
 * identical. New nodes mean any text the reader had selected inside them is
 * dropped, so selecting anything in those areas was impossible during playback
 * (measured: a single tick replaced the children of 19 comment bodies, the
 * reaction thread and the description; the title and related-videos rails, which
 * are not rendered this way, were unaffected).
 *
 * Memoising on `html` alone means a tick that changes nothing about the text
 * never reaches the DOM, so the selection survives.
 */
function MarkdownView({ html, className = '', ...rest }) {
  return (
    <div
      className={className ? `markdown-view ${className}` : 'markdown-view'}
      dangerouslySetInnerHTML={{ __html: html || '' }}
      {...rest}
    />
  );
}

export default memo(MarkdownView);
