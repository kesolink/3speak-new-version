import { useEffect, useState } from "react";
import { AiohaModal, useAioha } from "@aioha/react-ui";
import { Providers, KeyTypes } from "@aioha/aioha";
import { IoPower } from "react-icons/io5";
import { createPortal } from "react-dom";
import { ENABLE_METAMASK_SNAP, ENABLE_BUTRAUTH } from "../../utils/config";
import { useAppStore } from "../../lib/store";
import "./LoginModal.scss";

/**
 * Custom login modal wrapper that adds Butter Auth + MetaMask Snap login options to AiohaModal
 */
function LoginModal({ displayed, onLogin, onClose, loginTitle, loginOptions }) {
  const [topContainer, setTopContainer] = useState(null);
  // 'choose' = sign-up / log-in chooser screen; 'providers' = wallet/provider list.
  const [step, setStep] = useState('choose');
  const { aioha } = useAioha();
  const { user, LogOut } = useAppStore();

  // Logged in via Butter Auth → the chooser offers logout instead of
  // sign-up/login (matches the "Logout" item the nav shows for these users).
  const isManteAuth = typeof window !== 'undefined' && localStorage.getItem("manteauth_login") === "true";

  const handleLogout = async () => {
    try { await LogOut(user); } catch { /* ignore */ }
    onClose?.();
  };

  // When the modal opens: if the user is already logged in via an aioha wallet
  // (i.e. "Change account"), skip the sign-up/login chooser and go straight to
  // the aioha account modal (manage / switch / log out). Otherwise show the
  // chooser. (ManteAuth users aren't aioha-logged-in, so they still get the
  // chooser's logout screen.)
  useEffect(() => {
    if (!displayed) return;
    setStep(aioha.isLoggedIn() ? 'providers' : 'choose');
  }, [displayed, aioha]);

  // Start the Butter Auth flow in a popup (state='popup' → ManteAuthCallback
  // signals back via a localStorage 'storage' event handled in App). Falls back
  // to a full-page redirect if the popup is blocked.
  const startButrauthFlow = async (signup = false) => {
    try {
      const res = await fetch('/api/manteauth/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        // signup:true → butrauth jumps straight to account creation (screen_hint=signup)
        body: JSON.stringify({ redirect_uri: window.location.origin + '/callback', state: 'popup', signup }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || 'Failed to start Butter Auth login');
      const w = 480, h = 720;
      const left = window.screenX + Math.max(0, (window.outerWidth - w) / 2);
      const top = window.screenY + Math.max(0, (window.outerHeight - h) / 2);
      const popup = window.open(data.url, 'butrauth-login', `width=${w},height=${h},left=${left},top=${top}`);
      if (!popup) { window.location.href = data.url; return; } // popup blocked → full-page redirect
      // Keep a handle so the opener can close the popup once login completes —
      // more reliable than the popup closing itself after the cross-origin hop.
      window.__butrauthLoginPopup = popup;
    } catch (err) {
      console.error('Butter Auth start error:', err);
    }
  };

  // Inject the Butter Auth section into the aioha modal after it renders.
  // Only on the provider-selection page (has <ul> with wallet providers).
  useEffect(() => {
    if (!displayed || step !== 'providers') {
      setTopContainer(null);
      return;
    }

    const replaceHiveAuthQRText = () => {
      const modal = document.querySelector('#aioha-modal');
      if (!modal) return;
      const originalText = 'Scan the QR code using a HiveAuth-compatible mobile app.';
      const newText = 'Scan the QR code using a hiveauth compatible mobile app. If you have the app on this phone then just tap the qr code.';
      modal.querySelectorAll('p').forEach((p) => {
        if (p.textContent.trim() === originalText) {
          p.textContent = newText;
        }
      });
    };

    const styleHiveAuthQR = () => {
      const modal = document.querySelector('#aioha-modal');
      if (!modal) return;
      // The QR is inside a class-less <a> wrapping a div with w-64/aspect-square
      modal.querySelectorAll('a:not([class])').forEach((a) => {
        const inner = a.querySelector('div.aspect-square');
        if (!inner) return;
        a.style.display = 'block';
        a.style.textAlign = 'center';
        inner.style.width = '256px';
        inner.style.maxWidth = '100%';
        inner.style.marginLeft = 'auto';
        inner.style.marginRight = 'auto';
      });
    };

    const injectMetaMaskButton = () => {
      const modal = document.querySelector('#aioha-modal');
      if (!modal) return;
      const providerList = modal.querySelector('ul');
      if (!providerList) return;
      // Don't add if already injected
      if (providerList.querySelector('.metamask-snap-item')) return;

      // Clone style from existing provider items
      const existingItem = providerList.querySelector('li > a');
      if (!existingItem) return;

      const li = document.createElement('li');
      const a = document.createElement('a');
      a.className = existingItem.className;
      a.style.cursor = 'pointer';
      a.innerHTML = `
        <img src="https://upload.wikimedia.org/wikipedia/commons/3/36/MetaMask_Fox.svg"
             alt="MetaMask" style="width:32px;height:32px;" />
        <span class="flex-1 ms-3 whitespace-nowrap" style="font-size:14px;font-weight:500;">MetaMask Snap</span>
      `;
      a.classList.add('metamask-snap-item');
      a.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        // Prompt for username then trigger MetaMask Snap login
        const username = prompt('Enter your Hive username:');
        if (!username) return;
        try {
          // MetaMask Snap must login with Active key — contract calls require
          // Active authority and the snap derives different keys per role.
          const result = await aioha.login(Providers.MetaMaskSnap, username.trim(), {
            msg: loginOptions?.msg || 'Login',
            keyType: KeyTypes.Active,
          });
          if (result.success) {
            onLogin?.(result);
          } else {
            alert(result.error || 'MetaMask Snap login failed');
          }
        } catch (err) {
          alert(err.message || 'MetaMask Snap login failed');
        }
      });
      li.appendChild(a);
      providerList.appendChild(li);
    };

    const injectButton = () => {
      replaceHiveAuthQRText();
      styleHiveAuthQR();
      if (ENABLE_METAMASK_SNAP) injectMetaMaskButton();
      const modalContent = document.querySelector('#aioha-modal > div > div');
      if (modalContent) {
        // Only show on provider selection page (check for provider list)
        const providerList = modalContent.querySelector('ul');
        if (!providerList) {
          // Not on provider selection page — tear the injected section back down.
          modalContent.querySelector('.login-top-section')?.remove();
          setTopContainer(null);
          return;
        }

        // TOP section (Recommended + ButrAuth + "General Hive Logins" heading)
        // goes ABOVE the wallet-provider list so ButrAuth is the prominent,
        // first-seen option. Insert into the list's ACTUAL parent — the <ul> is
        // a descendant of modalContent, not necessarily a direct child.
        const listParent = providerList.parentNode;
        let top = modalContent.querySelector('.login-top-section');
        if (!top) {
          top = document.createElement('div');
          top.className = 'login-top-section';
        }
        if (listParent && (top.parentNode !== listParent || top.nextElementSibling !== providerList)) {
          listParent.insertBefore(top, providerList);
        }
        setTopContainer(top);
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
  }, [displayed, step]);

  // Only inject the extra login options when not logged in (i.e. showing the
  // provider list to pick from).
  const showLoginExtras = displayed && step === 'providers' && !aioha.isLoggedIn();

  return (
    <>
      {displayed && step === 'choose' && (
        <div className="login-chooser-overlay" onMouseDown={onClose}>
          <div className="login-chooser" onMouseDown={(e) => e.stopPropagation()}>
            {isManteAuth ? (
              <>
                <h3 className="login-chooser-title">You're signed in</h3>
                <p className="login-chooser-sub">
                  Signed in{user ? <> as <strong>@{user}</strong></> : ''} via Butter Auth.
                </p>
                <button className="login-chooser-login" onClick={handleLogout}>
                  <IoPower style={{ marginRight: 8, verticalAlign: 'middle' }} /> Log out
                </button>
                <button className="login-chooser-cancel" onClick={onClose}>Cancel</button>
              </>
            ) : (
              <>
                <h3 className="login-chooser-title">Welcome to 3Speak</h3>
                <p className="login-chooser-sub">
                  {ENABLE_BUTRAUTH
                    ? 'Create a new account, or log in if you already have one.'
                    : 'Log in to your account.'}
                </p>

                {/* Sign up is a Butter Auth flow — hide it (and avoid leaking the
                    not-yet-live feature) when Butter Auth is disabled. */}
                {ENABLE_BUTRAUTH && (
                  <button className="login-chooser-signup" onClick={() => startButrauthFlow(true)}>
                    <span className="butrauth-text">
                      <span className="butrauth-title">Sign up</span>
                      <span className="butrauth-subtitle">New here? Use Google, email &amp; more</span>
                    </span>
                  </button>
                )}

                <button className="login-chooser-login" onClick={() => setStep('providers')}>
                  <span style={{ display: 'block' }}>Log in</span>
                  <span style={{ display: 'block', fontWeight: 400, fontSize: '12.5px', opacity: 0.7, marginTop: '2px' }}>
                    {ENABLE_BUTRAUTH ? 'Log in with Butter Auth or any Hive wallet' : 'Log in with any Hive wallet'}
                  </span>
                </button>
                <button className="login-chooser-cancel" onClick={onClose}>Cancel</button>
              </>
            )}
          </div>
        </div>
      )}
      <AiohaModal
        displayed={displayed && step === 'providers'}
        onLogin={onLogin}
        onClose={onClose}
        loginTitle={loginTitle}
        loginOptions={loginOptions}
      />
      {showLoginExtras && topContainer && createPortal(
        <>
          {ENABLE_BUTRAUTH && (
          <button
            className="butrauth-login-btn"
            onClick={(e) => { e.stopPropagation(); startButrauthFlow(); }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <img src="/butrauth-logo.png" alt="" width={32} height={32} />
            <span className="butrauth-text">
              <span className="butrauth-title">Butter Auth <span className="recommended-suffix">(Recommended)</span></span>
              <span className="butrauth-subtitle">Sign in with Google, email &amp; more</span>
            </span>
          </button>
          )}
        </>,
        topContainer
      )}
    </>
  );
}

export default LoginModal;
