import { HangoutsProvider, StandaloneWatch, StreamVideo, StreamViewerCount } from '@snapie/hangouts-react';
import '@snapie/hangouts-react/src/styles/hangouts.css';
import './LiveStreamPlayer.scss';

// Strip a trailing slash — the SDK builds `${apiBaseUrl}/rooms/...` with a raw
// fetch, so a trailing slash yields `//rooms` and a 404.
const API_URL = (import.meta.env.VITE_HANGOUTS_API_URL || '').replace(/\/$/, '');
const LK_URL = import.meta.env.VITE_LIVEKIT_URL || 'wss://livekit.3speak.tv';

/**
 * The live OpenPods player, dropped into the watch page's player slot in
 * place of the VOD `<video>` when a post is a live stream (video.live). Fills
 * its positioned parent (`.video-iframe-wrapper`); the surrounding watch page
 * keeps rendering the real post's details, voting and comments.
 */
export default function LiveStreamPlayer({ roomName }) {
  if (!roomName) return null;
  return (
    <div className="live-stream-player">
      <HangoutsProvider apiBaseUrl={API_URL} livekitServerUrl={LK_URL}>
        <StandaloneWatch roomName={roomName}>
          <StreamVideo showLiveBadge />
          <StreamViewerCount render={(c) => (
            <span className="live-stream-player__viewers">👁 {c} watching</span>
          )} />
        </StandaloneWatch>
      </HangoutsProvider>
    </div>
  );
}
