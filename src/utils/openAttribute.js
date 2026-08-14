/**
 * OpenAttribute (openattribute.app) helpers.
 *
 * A shared vocabulary for Hive `json_metadata`, so other frontends can read our
 * posts without reverse-engineering them. Two pieces ride along with the
 * metadata we already publish:
 *
 *   oa                 the envelope — `{ v, object }` — saying what kind of post
 *                      this is, so a reader never has to infer it
 *   threespeak.video   our registered attribute for video posts
 *   threespeak.audio   ...and for audio posts
 *
 * Both attributes were registered on chain from the `threespeak` account on
 * 2026-08-13 at v1.0.0, which is why the keys read `<account>.<leaf>`.
 *
 * TWO RULES THAT ARE EASY TO GET WRONG:
 *
 * 1. Attributes sit BESIDE the envelope at the top level of json_metadata, never
 *    nested inside `oa`. A reader takes attributes from the top level, so a
 *    nested one is invisible at the other end with no error on either side.
 *
 * 2. `object` stays on one of the five core types. Any other value is an
 *    extension type that readers report as `Unknown`, which would be worse than
 *    saying nothing: our shorts are currently inferred as MicroPost for free
 *    because they reply to a container account, and an `x-` name would throw
 *    that away.
 */

export const OA_VERSION = 1;

// The core object types we publish. `Container` and `Unknown` exist in the spec
// but nothing we broadcast is either.
export const OA_ARTICLE = 'Article';
export const OA_MICROPOST = 'MicroPost';
export const OA_COMMENT = 'Comment';

/**
 * The envelope. Spread into a json_metadata object:
 *   { ...jsonMetadata, ...oaEnvelope(OA_ARTICLE) }
 */
export function oaEnvelope(object) {
  return { oa: { v: OA_VERSION, object } };
}

/** Source aspect from pixel dimensions. Returns null when we cannot tell. */
export function orientationOf(width, height) {
  const w = Number(width) || 0;
  const h = Number(height) || 0;
  if (!w || !h) return null;
  if (w === h) return 'square';
  return w > h ? 'landscape' : 'vertical';
}

/**
 * Read a video file's orientation off a detached <video> element.
 *
 * Judge orientation from the ELEMENT's videoWidth/videoHeight, never from what
 * a capture was asked for: Firefox pre-rotates recorded camera video, so the
 * requested constraints and the actual frame disagree.
 *
 * Resolves null rather than rejecting — an unknown orientation just means we
 * omit the attribute, which must never block a publish. The timeout is there so
 * a file the decoder chokes on cannot hang the upload flow.
 */
export function probeVideoOrientation(file) {
  return new Promise((resolve) => {
    if (!file || typeof document === 'undefined') { resolve(null); return; }

    const v = document.createElement('video');
    v.preload = 'metadata';

    let settled = false;
    const done = (value) => {
      if (settled) return;
      settled = true;
      try { URL.revokeObjectURL(v.src); } catch { /* nothing to revoke */ }
      resolve(value);
    };

    v.onloadedmetadata = () => done(orientationOf(v.videoWidth, v.videoHeight));
    v.onerror = () => done(null);
    setTimeout(() => done(null), 5000);

    try { v.src = URL.createObjectURL(file); } catch { done(null); }
  });
}

/**
 * `threespeak.video` — registered v1.0.0, required: surface + orientation.
 *
 * surface is where the video was published to be watched, not how long it is:
 * `watch` is a page with title and comments, `shorts` is the vertical swipe
 * feed, `live` is a stream. A 16-second landscape clip is still `watch`.
 *
 * Returns {} when surface or orientation is unknown. We would rather publish no
 * claim than one that breaks the schema we registered.
 */
export function threespeakVideo({ surface, orientation, duration, startsAt } = {}) {
  if (!surface || !orientation) return {};

  const attr = { surface, orientation };

  // Only on a stream announced ahead of time. One starting at publish time has
  // none, because the post's own timestamp already says when it began.
  if (startsAt) attr.startsAt = startsAt;

  // Never on `live`: a stream has no length when its post is written, and we do
  // not edit the post afterwards.
  const secs = Number(duration);
  if (surface !== 'live' && Number.isFinite(secs) && secs > 0) {
    attr.duration = secs;
  }

  return { 'threespeak.video': attr };
}

/**
 * `threespeak.audio` — registered v1.0.0, required: type.
 *
 * Mirrors the bare `audio` key we already write, so one reader parses both. The
 * `type` default matches the composer's own default, which leaves the field
 * unset until the author picks something.
 */
export function threespeakAudio({ type, genre, bpm, duration } = {}) {
  const attr = { type: type || 'voice_message' };

  if (genre) attr.genre = String(genre).trim();

  const beats = Number(bpm);
  if (Number.isFinite(beats) && beats > 0) attr.bpm = beats;

  const secs = Number(duration);
  if (Number.isFinite(secs) && secs > 0) attr.duration = secs;

  return { 'threespeak.audio': attr };
}
