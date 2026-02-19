import ShortsIcon from '../icons/ShortsIcon';
import './ShortsLoadingScreen.scss';

/**
 * Shared loading overlay for the shorts player.
 * Black background, white breathing logo, white pulsing text.
 * Used in both the initial loading state and the player-ready overlay.
 *
 * @param {boolean} overlay — if true, renders as an absolute overlay (for use inside videoContainer)
 */
const ShortsLoadingScreen = ({ overlay = false }) => {
  return (
    <div className={`shorts-loading-screen${overlay ? ' shorts-loading-screen--overlay' : ''}`}>
      <ShortsIcon className="shorts-loading-screen__logo" size={72} />
      <p className="shorts-loading-screen__text">Loading shorts...</p>
    </div>
  );
};

export default ShortsLoadingScreen;
