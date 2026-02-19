/**
 * Parse SRT subtitle text into an array of cues.
 * @param {string} srt - Raw SRT file content
 * @returns {Array<{start: number, end: number, text: string}>}
 */
export function parseSrt(srt) {
  const cues = [];
  const blocks = srt.trim().replace(/\r\n/g, '\n').split(/\n\n+/);

  for (const block of blocks) {
    const lines = block.split('\n');
    if (lines.length < 2) continue;

    // Find the timestamp line (contains " --> ")
    let tsIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('-->')) { tsIdx = i; break; }
    }
    if (tsIdx === -1) continue;

    const [startStr, endStr] = lines[tsIdx].split('-->').map(s => s.trim());
    const start = parseTimestamp(startStr);
    const end = parseTimestamp(endStr);
    if (start === null || end === null) continue;

    const text = lines.slice(tsIdx + 1).join('\n').trim();
    if (text) {
      cues.push({ start, end, text });
    }
  }

  return cues;
}

/**
 * Parse "HH:MM:SS,mmm" or "HH:MM:SS.mmm" to seconds.
 */
function parseTimestamp(ts) {
  const match = ts.match(/(\d+):(\d+):(\d+)[,.](\d+)/);
  if (!match) return null;
  return (
    parseInt(match[1]) * 3600 +
    parseInt(match[2]) * 60 +
    parseInt(match[3]) +
    parseInt(match[4]) / 1000
  );
}
