import { useEffect, useState } from "react";
import { AiohaModal, useAioha } from "@aioha/react-ui";
import { MdEmail } from "react-icons/md";
import { createPortal } from "react-dom";
import "./LoginModal.scss";

/**
 * Custom login modal wrapper that adds an email login option to AiohaModal
 */
function LoginModal({ displayed, onLogin, onClose, loginTitle, loginOptions }) {
  const [buttonContainer, setButtonContainer] = useState(null);
  const { aioha } = useAioha();

  const handleEmailLogin = (e) => {
    e.stopPropagation();
    window.location.href = "https://legacy.3speak.tv";
  };

  // Inject email button container into aioha modal after it renders
  // Only show on provider selection page (has <ul> with wallet providers)
  useEffect(() => {
    if (!displayed) {
      setButtonContainer(null);
      return;
    }

    const injectButton = () => {
      const modalContent = document.querySelector('#aioha-modal > div > div');
      if (modalContent) {
        // Only show on provider selection page (check for provider list)
        const providerList = modalContent.querySelector('ul');
        if (!providerList) {
          // Not on provider selection page, remove container and class
          modalContent.classList.remove('has-email-btn');
          const existingContainer = modalContent.querySelector('.email-login-btn-container');
          if (existingContainer) {
            existingContainer.remove();
          }
          setButtonContainer(null);
          return;
        }

        // Add class for padding
        modalContent.classList.add('has-email-btn');

        let container = modalContent.querySelector('.email-login-btn-container');
        if (!container) {
          container = document.createElement('div');
          container.className = 'email-login-btn-container';
          modalContent.appendChild(container);
        }
        setButtonContainer(container);
      }
    };

    // Try with delays to ensure modal is rendered
    const timeouts = [
      setTimeout(injectButton, 50),
      setTimeout(injectButton, 150),
      setTimeout(injectButton, 300),
    ];

    // Also observe for page changes within the modal
    const observer = new MutationObserver(() => {
      injectButton();
    });

    const modal = document.querySelector('#aioha-modal');
    if (modal) {
      observer.observe(modal, { childList: true, subtree: true });
    }

    return () => {
      timeouts.forEach(clearTimeout);
      observer.disconnect();
    };
  }, [displayed]);

  // Only show email button when not logged in (showing login options)
  const showEmailButton = displayed && !aioha.isLoggedIn();

  return (
    <>
      <AiohaModal
        displayed={displayed}
        onLogin={onLogin}
        onClose={onClose}
        loginTitle={loginTitle}
        loginOptions={loginOptions}
      />
      {showEmailButton && buttonContainer && createPortal(
        <button
          className="email-login-btn"
          onClick={handleEmailLogin}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <MdEmail size={20} />
          <span>Login with E-Mail</span>
        </button>,
        buttonContainer
      )}
    </>
  );
}

export default LoginModal;
