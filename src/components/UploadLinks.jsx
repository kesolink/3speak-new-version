import { Link } from "react-router-dom";
import { IoCloudUploadSharp } from "react-icons/io5";
import { Clapperboard } from "lucide-react";
import { MdGraphicEq } from "react-icons/md";
import ShortsIcon from "./icons/ShortsIcon";
import { FEATURE_EDITOR } from "../utils/config";

/**
 * Shared upload link pair used in Nav, Sidebar, and ProfileNav.
 * @param {string}   linkClass  – className applied to each <Link>
 * @param {string}   iconClass  – className applied to each icon (optional)
 * @param {function} onClick    – optional callback fired when a link is clicked
 */
function pauseAllMedia() {
  document.querySelectorAll('video, audio').forEach((el) => {
    if (!el.paused) el.pause();
  });
}

export default function UploadLinks({ linkClass, iconClass = "icon", onClick }) {
  const handleClick = (e) => {
    pauseAllMedia();
    if (onClick) onClick(e);
  };

  const handleEditorClick = (e) => {
    e.preventDefault();
    pauseAllMedia();
    window.dispatchEvent(new CustomEvent('open-shorts-editor'));
    if (onClick) onClick(e);
  };

  const handleAudioClick = (e) => {
    e.preventDefault();
    pauseAllMedia();
    window.dispatchEvent(new CustomEvent('open-audio-upload'));
    if (onClick) onClick(e);
  };

  return (
    <>
      <Link to="/studio" className={linkClass} title="Video" onClick={handleClick}>
        <IoCloudUploadSharp className={iconClass} /> <span>Video</span>
      </Link>
      <Link to="/embed-studio?from=shorts" className={linkClass} title="Short" onClick={handleClick}>
        <ShortsIcon className={iconClass} outlineWidth={30} /> <span>Short</span>
      </Link>
      <a href="#" className={linkClass} title="Audio" onClick={handleAudioClick}>
        <MdGraphicEq className={iconClass} /> <span>Audio</span>
      </a>
      {FEATURE_EDITOR && (
        <a href="#" className={linkClass} title="Shorts Editor" onClick={handleEditorClick}>
          <Clapperboard className={iconClass} size={18} /> <span>Shorts Editor</span>
        </a>
      )}
    </>
  );
}
