import React, { useRef, useLayoutEffect, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { IoClose } from 'react-icons/io5'

import "./BeneficiariesTooltip.scss"

function BeneficiariesTooltip({ beneficiaries, anchorRef, pinned, onClose }) {
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
  }, [anchorRef, beneficiaries, pinned]);

  // Close on click outside when pinned
  useEffect(() => {
    if (!pinned) return;
    const handleClick = (e) => {
      if (tipRef.current?.contains(e.target)) return;
      if (anchorRef?.current?.contains(e.target)) return;
      onClose?.();
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [pinned, onClose, anchorRef]);

  const content = (
    <div
      ref={tipRef}
      className={`beneficiaries-tooltip${pinned ? ' pinned' : ''}`}
      style={pos ? { top: pos.top, left: pos.left, opacity: 1 } : { opacity: 0 }}
    >
      <div className="beneficiaries-tooltip-header">
        <span>Beneficiaries</span>
        {pinned && (
          <button className="beneficiaries-tooltip-close" onClick={onClose}>
            <IoClose size={14} />
          </button>
        )}
      </div>
      <div className="beneficiaries-tooltip-list">
        {beneficiaries.map((b, index) => (
          <div key={index} className="beneficiaries-tooltip-row">
            <img
              className="beneficiaries-tooltip-avatar"
              src={`https://images.hive.blog/u/${b.account}/avatar/small`}
              alt=""
              loading="lazy"
            />
            <a
              className="beneficiaries-tooltip-user"
              href={`/@${b.account}`}
              onClick={(e) => { e.preventDefault(); navigate(`/@${b.account}`); onClose?.(); }}
            >
              @{b.account}
            </a>
            <span className="beneficiaries-tooltip-pct">{b.weight}%</span>
          </div>
        ))}
      </div>
    </div>
  );

  return createPortal(content, document.body);
}

export default BeneficiariesTooltip
