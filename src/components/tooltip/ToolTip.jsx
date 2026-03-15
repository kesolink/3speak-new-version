import React, { useRef, useLayoutEffect, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { IoClose } from 'react-icons/io5'

import "./ToolTip.scss"

function ToolTip({ tooltipVoters, anchorRef, pinned, onClose }) {
  const tipRef = useRef(null);
  const navigate = useNavigate();
  const [pos, setPos] = useState(null);

  useLayoutEffect(() => {
    if (!anchorRef?.current || !tipRef.current) return;
    const anchor = anchorRef.current.getBoundingClientRect();
    const tip = tipRef.current.getBoundingClientRect();
    const gap = 8;

    let top = anchor.top - tip.height - gap;
    let left = anchor.left + anchor.width / 2 - tip.width / 2;

    // Keep within viewport
    if (top < 8) top = anchor.bottom + gap;
    if (left < 8) left = 8;
    if (left + tip.width > window.innerWidth - 8)
      left = window.innerWidth - tip.width - 8;

    setPos({ top: top + window.scrollY, left });
  }, [anchorRef, tooltipVoters, pinned]);

  // Close on click outside or scroll when pinned
  useEffect(() => {
    if (!pinned) return;
    const handleClick = (e) => {
      if (tipRef.current?.contains(e.target)) return;
      if (anchorRef?.current?.contains(e.target)) return;
      onClose?.();
    };
    const handleScroll = () => onClose?.();
    document.addEventListener('mousedown', handleClick);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handleClick);
      window.removeEventListener('scroll', handleScroll);
    };
  }, [pinned, onClose, anchorRef]);

  const content = (
    <div
      ref={tipRef}
      className={`votes-tooltip${pinned ? ' pinned' : ''}`}
      style={pos ? { top: pos.top, left: pos.left, opacity: 1 } : { opacity: 0 }}
    >
      <div className="votes-tooltip-header">
        <span>Top Voters</span>
        {pinned && (
          <button className="votes-tooltip-close" onClick={onClose}>
            <IoClose size={14} />
          </button>
        )}
      </div>
      <div className="votes-tooltip-list">
        {tooltipVoters.map((voter, index) => (
          <div key={index} className="votes-tooltip-row">
            <img
              className="votes-tooltip-avatar"
              src={`https://images.hive.blog/u/${voter.username}/avatar/small`}
              alt=""
              loading="lazy"
            />
            <a
              className="votes-tooltip-user"
              href={`/@${voter.username}`}
              onClick={(e) => { e.preventDefault(); navigate(`/@${voter.username}`); onClose?.(); }}
            >
              @{voter.username}
            </a>
            <span className="votes-tooltip-reward">${voter.reward.toFixed(3)}</span>
          </div>
        ))}
        {tooltipVoters.length === 0 && (
          <div className="votes-tooltip-empty">No votes yet</div>
        )}
      </div>
    </div>
  );

  return createPortal(content, document.body);
}

export default ToolTip
