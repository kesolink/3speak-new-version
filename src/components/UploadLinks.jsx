import { Link, useNavigate } from "react-router-dom";
import { IoCloudUploadSharp } from "react-icons/io5";
import { Clapperboard } from "lucide-react";
import { MdGraphicEq, MdMic } from "react-icons/md";
import { BiCommentDetail } from "react-icons/bi";
import ShortsIcon from "./icons/ShortsIcon";
import { FEATURE_EDITOR } from "../utils/config";
import { getCreatorSettings, isUploadBlocked } from "../utils/creatorSettings";
import { useSupportBlock } from "../lib/supportBlockStore";
import { useAppStore } from "../lib/store";

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
  const navigate = useNavigate();
  const user = useAppStore((s) => s.user);

  // Plain navigation entries (Go Live, Community Snap) — no upload gate, just
  // pause any playing media and close the dropdown, then let the Link navigate.
  const go = (e) => { pauseAllMedia(); if (onClick) onClick(e); };

  // Gate every upload entry at click: a creator with canUpload === false sees
  // the "contact support" modal immediately instead of opening the studio /
  // recorder. Fails open if the check errors (never blocks on a failed check).
  const gatedGo = async (e, action) => {
    e.preventDefault();
    pauseAllMedia();
    if (onClick) onClick(e); // close the dropdown/menu either way
    const settings = await getCreatorSettings(useAppStore.getState().user);
    if (isUploadBlocked(settings)) {
      useSupportBlock.getState().showSupportBlock('upload');
      return;
    }
    action();
  };

  return (
    <>
      <Link to="/studio" className={linkClass} title="Video" onClick={(e) => gatedGo(e, () => navigate('/studio'))}>
        <IoCloudUploadSharp className={iconClass} /> <span>Video</span>
      </Link>
      <Link to="/embed-studio?from=shorts" className={linkClass} title="Short" onClick={(e) => gatedGo(e, () => navigate('/embed-studio?from=shorts'))}>
        <ShortsIcon className={iconClass} outlineWidth={30} /> <span>Short</span>
      </Link>
      <a href="#" className={linkClass} title="Audio" onClick={(e) => gatedGo(e, () => window.dispatchEvent(new CustomEvent('open-audio-upload')))}>
        <MdGraphicEq className={iconClass} /> <span>Audio</span>
      </a>
      <Link to="/openpods" className={linkClass} title="Go Live" onClick={go}>
        <MdMic className={iconClass} /> <span>Go Live</span>
      </Link>
      {user && (
        <Link to={`/p/${user}?tab=community`} className={linkClass} title="Community Snap" onClick={go}>
          <BiCommentDetail className={iconClass} /> <span>Community Snap</span>
        </Link>
      )}
      {FEATURE_EDITOR && (
        <a href="#" className={linkClass} title="Shorts Editor" onClick={(e) => gatedGo(e, () => window.dispatchEvent(new CustomEvent('open-shorts-editor')))}>
          <Clapperboard className={iconClass} size={18} /> <span>Shorts Editor</span>
        </a>
      )}
    </>
  );
}
