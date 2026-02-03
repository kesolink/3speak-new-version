import React, { useEffect } from "react";
import { IoClose } from "react-icons/io5";
import { FaDiscord, FaTelegramPlane } from "react-icons/fa";
import { Twitter } from "lucide-react";
import "./AboutModal.scss";
import logo from "../../assets/image/3S_logo.svg";
import logoDark from "../../assets/image/3S_logodark.png";
import { useAppStore } from "../../lib/store";

function AboutModal({ onClose }) {
  const { theme } = useAppStore();

  // Get commit hash from Vite env (set during build)
  const commitHash = import.meta.env.VITE_COMMIT_SHA || "development";
  const shortCommit = commitHash.substring(0, 7);

  // Close on back button (TV mode)
  useEffect(() => {
    const handleBackButton = (e) => {
      e.preventDefault();
      onClose();
    };

    document.addEventListener("tv-back-button", handleBackButton);
    return () => document.removeEventListener("tv-back-button", handleBackButton);
  }, [onClose]);

  // Prevent body scroll while modal is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "auto";
    };
  }, []);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" || e.keyCode === 27 || e.keyCode === 10009) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="about-modal-overlay">
      <div className="modal-backdrop" onClick={onClose}></div>

      <div className="about-modal-container">
        <button className="btn-close" onClick={onClose}>
          <IoClose className="icon" size={24} />
        </button>

        <div className="about-content">
          <div className="logo-section">
            <img
              src={theme === "dark" ? logoDark : logo}
              alt="3Speak"
              className="about-logo"
            />
          </div>

          <h1 className="about-title">3Speak</h1>
          <p className="about-tagline">Protect Your Content. Tokenise Your Community.</p>

          <div className="about-description">
            <p>
              3Speak is a decentralized video platform built on the Hive blockchain.
              Content creators directly own their assets and communities through
              blockchain technology, ensuring censorship resistance and true ownership.
            </p>
          </div>

          <div className="about-features">
            <div className="feature">
              <span className="feature-icon">🔒</span>
              <span>Censorship Resistant</span>
            </div>
            <div className="feature">
              <span className="feature-icon">💰</span>
              <span>Earn Crypto Rewards</span>
            </div>
            <div className="feature">
              <span className="feature-icon">👥</span>
              <span>Community Owned</span>
            </div>
          </div>

          <div className="social-links">
            <a
              href="https://t.me/threespeak"
              target="_blank"
              rel="noopener noreferrer"
              className="social-link"
            >
              <FaTelegramPlane size={24} />
            </a>
            <a
              href="https://discord.com/invite/NSFS2VGj83"
              target="_blank"
              rel="noopener noreferrer"
              className="social-link"
            >
              <FaDiscord size={24} />
            </a>
            <a
              href="https://x.com/3speaktv"
              target="_blank"
              rel="noopener noreferrer"
              className="social-link"
            >
              <Twitter size={24} />
            </a>
          </div>

          <div className="version-info">
            <span>Version: {shortCommit}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AboutModal;
