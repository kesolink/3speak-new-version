import { StandaloneObsOverlay } from "@snapie/hangouts-react";

// Chrome-free OBS Browser Source overlay for a standalone OpenPods stream.
// The host copies the URL from the studio's restream panel and pastes it into
// OBS as a Browser Source. We serve it from OUR origin (preview.3speak.tv) so it
// runs the current SDK and targets whichever endpoint the stream is on, via the
// url+token in the query string — the shared hangout.3speak.tv/obs page is an
// older build that can't render our current streams.
export default function ObsOverlay() {
  const p = new URLSearchParams(window.location.search);
  return (
    <StandaloneObsOverlay
      serverUrl={p.get("url") || ""}
      token={p.get("token") || ""}
      hostIdentity={p.get("host") || null}
    />
  );
}
