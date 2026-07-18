import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  HangoutsProvider, StandaloneWatch, StreamVideo, StreamViewerCount, StreamQualityControl, ChatPanel,
} from '@snapie/hangouts-react';
import '@snapie/hangouts-react/src/styles/hangouts.css';
import { useAioha } from '@aioha/react-ui';
import { Providers } from '@aioha/aioha';
import { useHangout } from '../context/HangoutContext';
import { useAppStore } from '../lib/store';
import SEOHead from '../components/SEOHead';
import BarLoader from '../components/Loader/BarLoader';
import Card3 from '../components/Cards/Card3';
import AuthorBadge from '../components/AuthorBadge/AuthorBadge';
import TipModal from '../components/tip-reward/TipModal';
import { TAG_FEED_URL } from '../utils/config';
import { FaThumbsUp, FaRegCommentAlt, FaBookmark, FaHeart } from 'react-icons/fa';
import { MdShare } from 'react-icons/md';
import '../page/Watch.scss';
import '../page/WatchV2.scss';
import '../components/playVideo/PlayVideo.scss';
import './WatchStream.scss';

const API_URL = (import.meta.env.VITE_HANGOUTS_API_URL || '').replace(/\/$/, '');
const LK_URL = import.meta.env.VITE_LIVEKIT_URL || 'wss://livekit.3speak.tv';
const IMAGE_KEY = import.meta.env.VITE_IMAGE_SERVER_API_KEY;

export default function WatchStream() {
  const { streamId } = useParams();
  const navigate = useNavigate();
  const { sessionToken, sessionLoading, retryLogin, hangoutsUser } = useHangout();
  const { aioha, provider, user: aiohaUser } = useAioha();
  const authenticated = useAppStore((s) => s.authenticated);
  const user = useAppStore((s) => s.user);

  const [state, setState] = useState({ status: 'loading', room: null });
  const [copied, setCopied] = useState(false);
  const [recommended, setRecommended] = useState({ loading: false, videos: [] });
  const [tipOpen, setTipOpen] = useState(false);

  // Hand the 3Speak session over to the hangout backend in the background so
  // an authenticated viewer joins as themselves (and can chat) instead of an
  // anonymous guest. Mirrors the OpenPods page.
  const canHandover = !!provider && provider !== Providers.HiveSigner && !!aiohaUser;
  useEffect(() => {
    if (canHandover && !sessionToken && !sessionLoading) retryLogin(aiohaUser || user);
  }, [canHandover, sessionToken, sessionLoading, aiohaUser, user, retryLogin]);
  // Give the handover a moment before connecting as a guest, so authed users
  // join with their identity.
  const [waited, setWaited] = useState(false);
  useEffect(() => { const t = setTimeout(() => setWaited(true), 4000); return () => clearTimeout(t); }, []);
  const connectReady = !!sessionToken || !canHandover || waited;

  // Detect the live stream via the room lookup (works for unlisted too).
  useEffect(() => {
    let alive = true;
    setState({ status: 'loading', room: null });
    if (!streamId || !API_URL) { setState({ status: 'notfound', room: null }); return undefined; }
    fetch(`${API_URL}/rooms/${encodeURIComponent(streamId)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((room) => {
        if (!alive) return;
        if (room && room.mode === 'standalone') setState({ status: 'live', room });
        else setState({ status: 'notlive', room: room || null });
      })
      .catch(() => { if (alive) setState({ status: 'notfound', room: null }); });
    return () => { alive = false; };
  }, [streamId]);

  const post = state.room?.post || {};
  const tags = Array.isArray(post.tags) ? post.tags : [];

  // Recommended videos related to the stream's first tag.
  useEffect(() => {
    let alive = true;
    const tag = tags[0];
    if (state.status !== 'live' || !tag) { setRecommended({ loading: false, videos: [] }); return undefined; }
    setRecommended({ loading: true, videos: [] });
    axios.get(`${TAG_FEED_URL}/videos/tag/${encodeURIComponent(tag)}?page=1&limit=8&type=videos`)
      .then((res) => { if (alive) setRecommended({ loading: false, videos: res.data?.videos || [] }); })
      .catch(() => { if (alive) setRecommended({ loading: false, videos: [] }); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status, tags[0]]);

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(window.location.href); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { /* clipboard unavailable */ }
  };

  if (state.status === 'loading') return <BarLoader />;

  if (state.status !== 'live') {
    return (
      <div className="ws-error">
        <p>{state.status === 'notlive' ? 'This stream isn’t live right now.' : 'No live stream found for this link.'}</p>
        <button className="ws-error-btn" onClick={() => navigate('/openpods')}>Browse live streams</button>
      </div>
    );
  }

  const { room } = state;
  const host = room.host;
  const title = post.title || room.title;
  const description = post.description || room.description || '';

  return (
    <div className="play-container watch-v2 ws-page">
      <SEOHead title={`${title} (LIVE)`} author={host} url={window.location.href} />
      <HangoutsProvider
        apiBaseUrl={API_URL}
        livekitServerUrl={LK_URL}
        imageServerApiKey={IMAGE_KEY || undefined}
        sessionToken={sessionToken || undefined}
        username={hangoutsUser || undefined}
        aioha={aioha}
      >
        {!connectReady ? <BarLoader /> : (
        <StandaloneWatch roomName={streamId} connecting={<BarLoader />}>
          <div className="ws-grid">
            {/* Main column */}
            <div className="ws-col-main">
              <div className="ws-player">
                <StreamVideo showLiveBadge={false} />
              </div>

              <div className="ws-controls-row">
                <StreamQualityControl />
              </div>

              {/* Info area — reuses the watch page (PlayVideo) classes so it
                  looks identical. The `.play-video` wrapper scopes them. */}
              <div className="play-video ws-play-video">
                <div className="top-container">
                  <div className="video-title-row">
                    <div className="video-title-col">
                      <div className="video-title-line">
                        <span className="ws-live-tag">● LIVE</span>
                        <h3>{title}</h3>
                        <StreamViewerCount render={(c) => <span className="ws-watching">👁 {c} watching now</span>} />
                      </div>
                    </div>
                  </div>

                  <div className="badges-row">
                    <AuthorBadge author={host} showFollow fetchFollowers />
                  </div>

                  {tags.length > 0 && (
                    <div className="community-tags-row">
                      <div className="tag-wrapper">
                        {tags.map((t, i) => (
                          <span key={i} onClick={() => navigate(`/t/${t}`)}>{t}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="play-video-info">
                    <div className="info-buttons-row">
                      <div className="info-buttons-right">
                        <button type="button" className="pv-btn tip-btn" onClick={() => setTipOpen(true)} title={`Tip @${host}`}>
                          <FaHeart size={14} /><span>Tip</span>
                        </button>
                        <button type="button" className="pv-btn share-btn" onClick={copyLink} title="Copy the stream link">
                          <MdShare size={16} /><span>{copied ? 'Copied' : 'Share'}</span>
                        </button>
                        <button type="button" className="pv-btn vote-btn" disabled title="Not available for live streams">
                          <FaThumbsUp size={14} /><span>Vote</span>
                        </button>
                        <button type="button" className="pv-btn" disabled title="Not available for live streams">
                          <FaRegCommentAlt size={14} /><span>Comment</span>
                        </button>
                        <button type="button" className="pv-btn" disabled title="Not available for live streams">
                          <FaBookmark size={14} /><span>Save</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {description && (
                    <div className="description-wrap">
                      <div className="blog-content ws-desc-text">{description}</div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Side column: chat + recommended */}
            <div className="ws-col-side">
              <div className="ws-chat">
                <div className="ws-chat-head">Live chat</div>
                <ChatPanel readOnly={!authenticated} readOnlyNotice="🔒 Sign in to join the chat." />
              </div>

              {(recommended.loading || recommended.videos.length > 0) && (
                <div className="ws-recommended">
                  <h3 className="ws-recommended-head">More {tags[0] ? `#${tags[0]}` : 'videos'}</h3>
                  <Card3 videos={recommended.videos} loading={recommended.loading} />
                </div>
              )}
            </div>
          </div>
        </StandaloneWatch>
        )}
      </HangoutsProvider>

      {tipOpen && (
        <TipModal recipient={host} isOpen={tipOpen} onClose={() => setTipOpen(false)} />
      )}
    </div>
  );
}
