import React, { useRef, useLayoutEffect, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { IoClose } from 'react-icons/io5'

import "./BeneficiariesTooltip.scss"

function BeneficiariesTooltip({ beneficiaries, payoutInfo, displayTotal, anchorRef, pinned, onClose }) {
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
  }, [anchorRef, beneficiaries, pinned, payoutInfo, displayTotal]);

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

  const isPaidOut = payoutInfo?.isPaidOut;

  // Use displayTotal (total_hive_reward from 3speak API) as the source of truth
  // since Hive's total_payout_value only includes the HBD portion (not vesting/HP).
  const totalPayout = displayTotal || 0;
  // Hive splits 50% to curators, 50% to author
  const curatorPayout = totalPayout * 0.5;
  const authorPayout = totalPayout * 0.5;

  const totalBeneWeight = beneficiaries.reduce((sum, b) => sum + b.weight, 0);
  const beneShare = (authorPayout * totalBeneWeight) / 100;
  const authorNet = authorPayout - beneShare;
  const showBreakdown = totalPayout > 0;

  const content = (
    <div
      ref={tipRef}
      className={`beneficiaries-tooltip${pinned ? ' pinned' : ''}`}
      style={pos ? { top: pos.top, left: pos.left, opacity: 1 } : { opacity: 0 }}
    >
      <div className="beneficiaries-tooltip-header">
        <span>
          {showBreakdown
            ? isPaidOut ? 'Payout Breakdown' : 'Estimated Breakdown'
            : 'Beneficiaries'}
        </span>
        {pinned && (
          <button type="button" className="beneficiaries-tooltip-close" onClick={onClose}>
            <IoClose size={14} />
          </button>
        )}
      </div>

      {showBreakdown && (
        <div className="beneficiaries-tooltip-breakdown">
          <div className="beneficiaries-tooltip-breakdown-row">
            <span className="beneficiaries-tooltip-breakdown-label">Curators (50%)</span>
            <span className="beneficiaries-tooltip-breakdown-value">
              {!isPaidOut && '~'}${curatorPayout.toFixed(2)}
            </span>
          </div>
          <div className="beneficiaries-tooltip-breakdown-row">
            <span className="beneficiaries-tooltip-breakdown-label">Author</span>
            <span className="beneficiaries-tooltip-breakdown-value">
              {!isPaidOut && '~'}${authorNet.toFixed(2)}
            </span>
          </div>
        </div>
      )}

      <div className="beneficiaries-tooltip-list">
        {showBreakdown && beneficiaries.length > 0 && (
          <div className="beneficiaries-tooltip-section-label">Beneficiaries</div>
        )}
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
            <span className="beneficiaries-tooltip-pct">
              {b.weight}%
              {showBreakdown && (
                <span className="beneficiaries-tooltip-amount">
                  {!isPaidOut && '~'}${((authorPayout * b.weight) / 100).toFixed(2)}
                </span>
              )}
            </span>
          </div>
        ))}
      </div>

      {showBreakdown && (
        <div className="beneficiaries-tooltip-total">
          <span>Total{!isPaidOut && ' (est.)'}</span>
          <span>{!isPaidOut && '~'}${totalPayout.toFixed(2)}</span>
        </div>
      )}
    </div>
  );

  return createPortal(content, document.body);
}

export default BeneficiariesTooltip
