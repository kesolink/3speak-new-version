import React, { useEffect, useState } from "react";
import { FaDiscord, FaTelegramPlane } from "react-icons/fa";
import { Twitter } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import "./AboutModal.scss";
import logo from "../../assets/image/3S_logo.svg";
import logoDark from "../../assets/image/3S_logodark.png";
import { useAppStore } from "../../lib/store";
import { useTVMode } from "../../context/TVModeContext";

const SOCIAL_LINKS = [
  {
    name: "Telegram",
    url: "https://t.me/threespeak",
    icon: FaTelegramPlane,
  },
  {
    name: "Discord",
    url: "https://discord.com/invite/NSFS2VGj83",
    icon: FaDiscord,
  },
  {
    name: "X (Twitter)",
    url: "https://x.com/3speaktv",
    icon: Twitter,
  },
];

function AboutModal({ onClose }) {
  const { theme } = useAppStore();
  const { isTVMode } = useTVMode();
  const [selectedLink, setSelectedLink] = useState(null);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  // Get commit hash from Vite env (set during build)
  const commitHash = import.meta.env.VITE_COMMIT_SHA || "development";
  const shortCommit = commitHash.substring(0, 7);

  // Close on back button (TV mode)
  useEffect(() => {
    const handleBackButton = (e) => {
      e.preventDefault();
      if (selectedLink) {
        setSelectedLink(null);
      } else {
        onClose();
      }
    };

    document.addEventListener("tv-back-button", handleBackButton);
    return () => document.removeEventListener("tv-back-button", handleBackButton);
  }, [onClose, selectedLink]);

  // Prevent body scroll while modal is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "auto";
    };
  }, []);

  // TV mode keyboard navigation
  useEffect(() => {
    if (!isTVMode) return;

    const handleKeyDown = (e) => {
      // If QR code is showing, any key closes it
      if (selectedLink) {
        if (e.keyCode === 13 || e.keyCode === 27 || e.keyCode === 10009) {
          e.preventDefault();
          setSelectedLink(null);
        }
        return;
      }

      const totalItems = SOCIAL_LINKS.length + 1; // social links + close button

      switch (e.keyCode) {
        case 37: // Left
          e.preventDefault();
          setFocusedIndex(prev => Math.max(0, prev - 1));
          break;
        case 39: // Right
          e.preventDefault();
          setFocusedIndex(prev => Math.min(totalItems - 1, prev + 1));
          break;
        case 38: // Up
          e.preventDefault();
          if (focusedIndex >= SOCIAL_LINKS.length) {
            setFocusedIndex(Math.floor(SOCIAL_LINKS.length / 2));
          }
          break;
        case 40: // Down
          e.preventDefault();
          if (focusedIndex < SOCIAL_LINKS.length) {
            setFocusedIndex(SOCIAL_LINKS.length); // Focus close button
          }
          break;
        case 13: // Enter
          e.preventDefault();
          if (focusedIndex >= 0 && focusedIndex < SOCIAL_LINKS.length) {
            setSelectedLink(SOCIAL_LINKS[focusedIndex]);
          } else if (focusedIndex === SOCIAL_LINKS.length) {
            onClose();
          }
          break;
        case 27: // Escape
        case 10009: // Samsung TV Back
          e.preventDefault();
          onClose();
          break;
        default:
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isTVMode, focusedIndex, selectedLink, onClose]);

  // Auto-focus close button in TV mode (it's the last item)
  useEffect(() => {
    if (isTVMode) {
      setFocusedIndex(SOCIAL_LINKS.length); // Focus close button by default
    }
  }, [isTVMode]);

  const handleSocialClick = (link) => {
    if (isTVMode) {
      // In TV mode, show QR code
      setSelectedLink(link);
    } else {
      // In non-TV mode, open link in new tab
      window.open(link.url, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div className={`about-modal-overlay ${theme === 'dark' ? 'dark-theme' : 'light-theme'}`}>
      <div className="modal-backdrop" onClick={onClose}></div>

      <div className="about-modal-container">
        {/* QR Code Overlay */}
        {selectedLink && (
          <div className="qr-overlay" onClick={() => setSelectedLink(null)}>
            <div className="qr-content" onClick={(e) => e.stopPropagation()}>
              <h3>Scan to open {selectedLink.name}</h3>
              <div className="qr-code-wrapper">
                <QRCodeSVG
                  value={selectedLink.url}
                  size={200}
                  bgColor="transparent"
                  fgColor={theme === 'dark' ? '#ffffff' : '#000000'}
                  level="H"
                />
              </div>
              <p className="qr-url">{selectedLink.url}</p>
              <button className="btn-close-qr" onClick={() => setSelectedLink(null)}>
                Close
              </button>
            </div>
          </div>
        )}

        <div className="about-content">
          {/* Centered Logo */}
          <div className="logo-section">
            <img
              src={theme === "dark" ? logoDark : logo}
              alt="3Speak"
              className="about-logo"
            />
          </div>

          <p className="about-tagline">Decentralized Video Platform</p>

          <div className="about-description">
            <p>
              3Speak is a decentralized video platform built on the Hive blockchain.
              Content creators directly own their content and communities through
              blockchain technology, ensuring censorship resistance and true ownership.
            </p>
          </div>

          <div className="about-features">
            <div className="feature">
              <span className="feature-icon">🔒</span>
              <span>Censorship Resistant</span>
            </div>
            <div className="feature">
              <span className="feature-icon">👥</span>
              <span>Community Owned</span>
            </div>
          </div>

          {/* Social Links */}
          <div className="social-section">
            <h4>Connect with us</h4>
            <div className="social-links">
              {SOCIAL_LINKS.map((link, index) => {
                const Icon = link.icon;
                return (
                  <button
                    key={link.name}
                    className={`social-link ${isTVMode && focusedIndex === index ? 'tv-focused' : ''}`}
                    onClick={() => handleSocialClick(link)}
                    title={link.name}
                  >
                    <Icon size={24} />
                    <span className="social-label">{link.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="version-info">
            <span>Version: {shortCommit}</span>
          </div>

          {/* Close Button at Bottom */}
          <button
            className={`btn-close-bottom ${isTVMode && focusedIndex === SOCIAL_LINKS.length ? 'tv-focused' : ''}`}
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default AboutModal;
