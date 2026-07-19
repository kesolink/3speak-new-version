import { Route, Routes, useLocation, useNavigate, Navigate } from "react-router-dom";
import { useRef, lazy, Suspense } from "react";
import "./App.css";
// import Home from './page/Home'
// import Treanding from './page/Treanding'
import Nav from "./components/nav/Nav";
import { useState } from "react";
import Watch from "./page/Watch";
import WatchStream from "./page/WatchStream";
import Sidebar from "./components/Sidebar/Sidebar";
import Feed from "./components/Feed/Feed";
import FirstUploads from "./page/FirstUploads";
import Trend from "./page/Trend";
import Discover from "./page/Discover";
import NewVideos from "./page/NewVideos";
import HomeGrouped from "./page/HomeGrouped";
import UploadVideo from "./page/UploadVideo";
import Login from "./page/Login/Login";
// KeyChainLogin replaced by LoginRedirect (opens aioha modal)
import LoginNew from "./page/Login/LoginNew";
import { useAppStore } from "./lib/store";
import { useSupportBlock } from "./lib/supportBlockStore";
import { getCreatorSettings, isBanned } from "./utils/creatorSettings";
import SupportModal from "./components/SupportModal/SupportModal";
import CookieConsent from "./components/CookieConsent/CookieConsent";
import { useEffect } from "react";
import { readAppVersion } from "./utils/appVersion";
import ChangelogModal from "./components/Changelog/ChangelogModal";
import ProfileNav from "./components/nav/ProfileNav";
// Legacy studio is retired: /studio routes now redirect to /embed-studio
// (the embed-studio uploader in non-short mode is the only video upload flow).
// import StudioPage from "./components/legacy-studio/StudioPage";
import CommunitiesRender from "./components/Communities/CommunitiesRender";
import CommunityPage from "./components/Communities/CommunityPage";
import TagFeed from "./page/TagFeed";
import Leaderboard from "./page/Leaderboard";
import ProfilePage from "./page/ProfilePage";
import Wallet from "./page/Wallet";
import UserProfilePage from "./components/Userprofilepage/UserProfilePage";
import DraftStudio from "./components/studio/DraftStudio";
import EditVideo from "./page/EditVideo";
import EditScheduledPost from "./page/EditScheduledPost";
import ScrollToTop from "./components/ScrollToTop";
import RouteTitle from "./components/RouteTitle";
import OpenShortsOnStart from "./components/OpenShortsOnStart";
import AddAccount_modal from "./components/modal/AddAccount_modal";
// import TestingLogin from "./page/Login/TestingLogin";
import AboutPage from "./components/LandingPage/AboutPage";
import Legal from "./page/Legal";
import { toast, Toaster } from 'sonner'
import { CircleCheck, CircleX, TriangleAlert, Info } from 'lucide-react'
import './toast.css'
import { fetchNewerVersion, reloadForUpdate } from './utils/checkLatestVersion'
// Retired alongside the legacy /studio flow — kept here as comments for ease of
// roll-back; the embed-studio equivalents at /embed-studio/{thumbnail,details,preview}
// are what users hit now.
// import Thumbnail from "./components/legacy-studio/Thumbnail";
// import Details from "./components/legacy-studio/Details";
// import Preview from "./components/legacy-studio/Preview";
import Short from "./page/Short";
import ShortsStoryFeed from "./page/ShortsStoryFeed";
import ShortsPreloader from "./components/ShortsPreloader";
// import Email from "./page/Login/Email"
// import AuthCallback from "./page/Login/AuthCallback";
// import {AUTH_JWT_SECRET} from "../src/utils/config";


import { jwtDecode } from "jwt-decode";
import AuthCallback from "./page/Login/AuthCallback";
import ManteAuthCallback from "./page/Login/ManteAuthCallback";
import NotFound from "./page/NotFound";
import ProfileModal from "./components/modal/ProfileModal";
import HiveImageUploader from "./page/HiveImageUploader";
import PlaylistView from "./page/PlaylistView";
import WatchedView from "./page/WatchedView";
import Notifications from "./page/Notifications";
import PostView from "./page/PostView";
import Audio from "./page/Audio";
import AudioPost from "./page/AudioPost";
import { EmbedUploadProvider } from "./context/EmbedUploadContext";
import { HiveAuthProvider } from "./context/HiveAuthContext";
import { HangoutContextProvider, useHangout } from "./context/HangoutContext";
import { ChatProvider } from "./context/ChatContext";
import ChatPage from "./components/Chat/ChatPage";
import OpenPods from "./page/OpenPods";
import OpenPodPublish from "./page/OpenPodPublish";

const OpenPodModal = lazy(() => import("./components/OpenPod/OpenPodModal"));

function OpenPodModalMounter() {
  const { activeRoom, closeRoom, sessionToken, hangoutsUser } = useHangout();
  const { provider } = useAioha();
  if (!activeRoom) return null;
  // Treat the user as a real hangouts participant (vs. listen-only guest) only
  // when we have a session token, or a wallet that can still hand one over. A
  // stale `authenticated` flag with no signable provider must fall through to
  // guest mode so the modal joins via /listen instead of hanging on
  // "Authenticating with OpenPods…".
  const canParticipate = !!sessionToken || (!!provider && provider !== Providers.HiveSigner);
  return (
    <Suspense fallback={null}>
      <OpenPodModal
        isOpen
        onClose={closeRoom}
        roomName={activeRoom}
        sessionToken={sessionToken}
        username={hangoutsUser}
        isAuthenticated={canParticipate}
      />
    </Suspense>
  );
}

// Embed studio pages
import EmbedStudioPage from "./components/embed-studio/EmbedStudioPage";
import EmbedThumbnail from "./components/embed-studio/EmbedThumbnail";
import EmbedDetails from "./components/embed-studio/EmbedDetails";
import EmbedPreview from "./components/embed-studio/EmbedPreview";
import FollowFeed from "./page/FollowFeed";
import { useAioha } from "@aioha/react-ui";
import LoginModal from "./components/LoginModal/LoginModal";
import ActiveAuthModal from "./components/ActiveAuthModal/ActiveAuthModal";
import InterestsPrompt from "./components/InterestsPrompt/InterestsPrompt";
import EditorModal from "./components/modal/EditorModal";
import { FEATURE_EDITOR } from "./utils/config";
import BottomNav from "./components/BottomNav/BottomNav";
import MiniPlayer from "./components/MiniPlayer/MiniPlayer";
import GlobalAudioPlayer from "./components/GlobalAudioPlayer/GlobalAudioPlayer";
import AudioUploadModal from "./components/AudioUploadModal/AudioUploadModal";
import { KeyTypes, Providers } from "@aioha/aioha";
import '@aioha/react-ui/dist/build.css';
import { LOCAL_STORAGE_USER_ID_KEY } from "./hooks/localStorageKeys";

// Hive-like URL redirects: /@user → profile, /@user/permlink → post view, /@user/shorts → profile shorts tab
// PostView handles 3Speak video detection and redirects to /watch when appropriate
const HiveLinkRedirect = () => {
  const location = useLocation();
  const path = location.pathname;
  const match = path.match(/^\/@([^/]+)(?:\/(.+))?$/);
  if (match) {
    const [, user, permlink] = match;
    if (permlink === 'shorts') {
      return <Navigate to={`/p/${user}?tab=shorts`} replace />;
    }
    if (permlink) {
      return <Navigate to={`/post/${user}/${permlink}${location.search || ''}`} replace />;
    }
    // Preserve query string (e.g. ?tab=audio) when redirecting /@user → /p/user
    return <Navigate to={`/p/${user}${location.search || ''}`} replace />;
  }
  return <NotFound />;
};

// /login and /auth/login open the aioha modal and redirect to home
const LoginRedirect = ({ openLoginModal }) => {
  const navigate = useNavigate();
  useEffect(() => {
    // Replace /login in history with home, then open modal on next tick
    navigate('/', { replace: true });
    setTimeout(() => openLoginModal(), 0);
  }, []);
  return null;
};

function App() {
  const location = useLocation();
  const { initializeAuth, initializeTheme, authenticated, LogOut, setUser, user: appUser } = useAppStore();
  const sessionExpired = useAppStore((s) => s.sessionExpired);
  const homeCardSize = useAppStore((s) => s.homeCardSize);

  // Reflect the card-size preference on <html> so the card grids (home, profile,
  // playlists) can size themselves via CSS variables.
  useEffect(() => {
    document.documentElement.setAttribute('data-card-size', homeCardSize || 'large');
  }, [homeCardSize]);
  const clearSessionExpired = useAppStore((s) => s.clearSessionExpired);
  const { aioha, user: aiohaUser } = useAioha();
  const sidebar = useAppStore((s) => s.sidebarOpen);
  const setSideBar = useAppStore((s) => s.setSidebarOpen);
  const sidebarHidden = useAppStore((s) => s.sidebarHidden);
  const [profileNavVisible, setProfileNavVisible] = useState(false);

  const [globalCloseRender, setGlobalCloseRender] = useState(false)
  const [toggle, setToggle] = useState(false);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [loginProof, setLoginProof] = useState(() => Math.floor(Date.now() / 1000));
  const [editorModalOpen, setEditorModalOpen] = useState(false);
  const [audioUploadOpen, setAudioUploadOpen] = useState(false);
  // Carries an in-flight blob handed off from another flow (e.g. an
  // OpenPods recording stop). The AudioUploadModal seeds it as the
  // first track on open with the type its sender chose.
  const [pendingAudioTrack, setPendingAudioTrack] = useState(null);
  const loginInProgress = useRef(false); // Track if login is being processed
  const aiohaUserSeen = useRef(false); // Track if aiohaUser has ever been populated
  const sessionExpiredHandled = useRef(false); // Guard so the expiry prompt shows once (StrictMode-safe)

  // Hide nav on /shorts route on mobile — and on a live stream's watch page,
  // which uses the same full-bleed shorts layout.
  const isShorts = location.pathname.startsWith('/shorts')
    || /^\/(watch|l)\/[^/]+$/.test(location.pathname);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 767);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 767);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const hideNavOnMobile = isShorts && isMobile;

  // Listen for "open-shorts-editor" custom event from UploadLinks
  useEffect(() => {
    const handleOpenEditor = () => setEditorModalOpen(true);
    window.addEventListener('open-shorts-editor', handleOpenEditor);
    return () => window.removeEventListener('open-shorts-editor', handleOpenEditor);
  }, []);

  // Apply the saved theme on every route — Nav (which also calls this) isn't
  // rendered on the mobile shorts view, so a fresh /shorts deep link would
  // otherwise load unthemed.
  useEffect(() => { initializeTheme?.(); }, [initializeTheme]);

  // Listen for "open-audio-upload" custom event from UploadLinks. The
  // event may carry a payload with a pre-recorded blob (e.g. handed off
  // from the OpenPods modal) that the modal seeds as its first track.
  useEffect(() => {
    const handleOpenAudioUpload = (e) => {
      const detail = e?.detail;
      if (detail?.blob) {
        setPendingAudioTrack({
          blob: detail.blob,
          filename: detail.filename || 'recording.ogg',
          type: detail.type ?? null,
        });
      }
      setAudioUploadOpen(true);
    };
    window.addEventListener('open-audio-upload', handleOpenAudioUpload);
    return () => window.removeEventListener('open-audio-upload', handleOpenAudioUpload);
  }, []);

  useEffect(() => {
    initializeAuth();
    tokenVaildation()
  }, []);

  // When initializeAuth clears a stale/expired wallet session (e.g. an expired
  // HiveSigner token with a lingering user_id), it sets `sessionExpired` in the
  // store. Prompt a re-login. Driven by the store flag (not read-before-clear)
  // and ref-guarded so it fires exactly once under React StrictMode.
  useEffect(() => {
    if (sessionExpired && !sessionExpiredHandled.current) {
      sessionExpiredHandled.current = true;
      toast.error("Your session expired — please log in again");
      setLoginModalOpen(true);
      clearSessionExpired();
    }
  }, [sessionExpired]);

  // On load, decide whether to show the "what's new" popup. For an upgrade we expose
  // the previous version via the store; the stored version is advanced only after the
  // popup is shown (markVersionSeen on close). First-time visitors never see a prompt.
  useEffect(() => {
    const { previousVersion, shouldPrompt } = readAppVersion();
    if (shouldPrompt) useAppStore.getState().setAppUpdatedFrom(previousVersion);
  }, []);

  // Compare the running build against the latest version on GitHub (develop) and
  // prompt the user to refresh if they're on a stale (cached) build — so updates
  // don't require a manual reload. Re-checks on tab focus and every 30 min.
  useEffect(() => {
    let shown = false;
    const promptIfNewer = async () => {
      if (shown) return;
      const newer = await fetchNewerVersion();
      if (!newer) return;
      shown = true;
      toast(`A new version (${newer}) is available`, {
        description: 'Refresh to get the latest updates.',
        duration: Infinity,
        action: { label: 'Refresh', onClick: () => reloadForUpdate() },
      });
    };
    promptIfNewer();
    const onFocus = () => promptIfNewer();
    window.addEventListener('focus', onFocus);
    const id = setInterval(promptIfNewer, 30 * 60 * 1000);
    return () => { window.removeEventListener('focus', onFocus); clearInterval(id); };
  }, []);

  // Persist the last visited non-login route so the app can return
  // users to the same page after they sign in.
  useEffect(() => {
    if (!location) return;
    const path = `${location.pathname}${location.search || ''}`;
    // don't overwrite when on login or auth callback routes
    if (path.startsWith('/login') || path.startsWith('/auth/callback') || path.startsWith('/newlogin')) return;
    try {
      sessionStorage.setItem('preLoginPath', path);
    } catch {
      // ignore storage errors
    }
  }, [location]);

  // Watch for aioha user changes and sync with 3Speak
  useEffect(() => {
    if (loginInProgress.current) return; // handleAiohaLogin is already handling this
    if (aiohaUser) aiohaUserSeen.current = true;
    if (!aiohaUser && appUser && aiohaUserSeen.current) {
      // Aioha logged out - log out of 3Speak too
      console.log("Aioha logged out, logging out of 3Speak");
      LogOut(appUser);
      toast.success("Logged out successfully");
    } else if (aiohaUser && aiohaUser !== appUser && loginModalOpen) {
      // Account switch: modal is open and user clicked an existing account
      // Only sync aiohaUser when modal is open — when closed, handleAiohaLogin
      // is the sole authority, preventing aioha's stale user reports from overriding
      console.log("Aioha account switched:", aiohaUser);
      localStorage.removeItem('manteauth_login'); // switching to a wallet account clears any prior Butter Auth flag
      localStorage.setItem(LOCAL_STORAGE_USER_ID_KEY, aiohaUser);
      setUser(aiohaUser);
      setLoginModalOpen(false);
      toast.success("Login successful!");
    }
  }, [aiohaUser]);

  // Reconcile a Butter Auth (ManteAuth) session that's sitting on top of a still-
  // active aioha WALLET session for a different account. Butter Auth login does
  // not log aioha out, so `appUser` can be the Butter Auth name while aioha's
  // current user is still e.g. a Keychain account. In that state "Change account"
  // opens straight into aioha's modal with the wallet account already selected —
  // clicking it is a no-op (aiohaUser never changes) and nothing switches. When
  // the modal is opened in this mismatch, adopt the wallet session so the switch
  // actually lands (and tear down the now-unused Butter Auth backend session).
  useEffect(() => {
    if (!loginModalOpen) return;
    if (localStorage.getItem('manteauth_login') !== 'true') return;
    if (aiohaUser && aiohaUser !== appUser) {
      localStorage.removeItem('manteauth_login');
      localStorage.setItem(LOCAL_STORAGE_USER_ID_KEY, aiohaUser);
      setUser(aiohaUser);
      setLoginModalOpen(false);
      fetch('/api/manteauth/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
      toast.success(`Switched to @${aiohaUser}`);
    }
  }, [loginModalOpen, aiohaUser]);

  // Finalize a Butter Auth popup login. The popup (ManteAuthCallback) does the
  // token exchange, then writes `butrauth_login_result` to localStorage and
  // closes — which fires a `storage` event here in the opener window.
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key !== 'butrauth_login_result' || !e.newValue) return;
      let payload;
      try { payload = JSON.parse(e.newValue); } catch { return; }
      localStorage.removeItem('butrauth_login_result');
      // Close the login popup from the opener side — more reliable than the
      // popup closing itself (browsers can block window.close() after the
      // cross-origin auth hop, leaving it stuck on the callback page).
      try { window.__butrauthLoginPopup?.close(); } catch { /* ignore */ }
      window.__butrauthLoginPopup = null;
      if (payload?.error) {
        toast.error('Butter Auth login failed: ' + payload.error);
        return;
      }
      if (payload?.username) {
        useAppStore.getState().setUser(payload.username); // sets user + authenticated
        setLoginModalOpen(false);
        toast.success(`Logged in as @${payload.username} via Butter Auth`);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Banned-creator gate. Keyed on the persisted `appUser` (NOT `authenticated`)
  // so it reliably fires on a page refresh too: `user` is restored synchronously
  // from persistence, while `authenticated` only flips true later via
  // initializeAuth. So if a logged-in creator gets banned, refreshing forces a
  // logout + shows the "contact support" modal. Fails open if the check errors.
  useEffect(() => {
    if (!appUser) return;
    let cancelled = false;
    (async () => {
      const settings = await getCreatorSettings(appUser);
      if (cancelled) return;
      if (isBanned(settings)) {
        useSupportBlock.getState().showSupportBlock('banned');
        try { await LogOut(appUser); } catch { /* ignore */ }
      }
    })();
    return () => { cancelled = true; };
  }, [appUser]);

  const tokenVaildation = ()=>{
    const token = window.localStorage.getItem("access_token")
    if (token && authenticated){
      try {
    const decoded = jwtDecode(token);
    console.log(decoded)

    // exp is in seconds, Date.now() is in ms
    const isExpired = decoded.exp * 1000 < Date.now();
    if (isExpired) {
          // console.warn("Token expired — logging out user");
          toast.error("Secssion expired")
          LogOut(decoded.user_id); // this will already remove the token
          return false;
        }
    return !isExpired;
  } catch (err) {
    console.error("Invalid token:", err);
    return false;
  }
    }

  }

  

  // const closeProfileNav = ()=>{
  //   setProfileNavVisible(!profileNavVisible)
  // }
  const toggleProfileNav = () => {
    setProfileNavVisible((prev) => !prev);
    console.log(profileNavVisible);
  };

  const toggleAddAccount = () => {
    setToggle((prev) => !prev);
  }

  const openLoginModal = () => {
    setLoginProof(Math.floor(Date.now() / 1000)); // Fresh timestamp when modal opens
    if (!aioha.isLoggedIn()) {
      loginInProgress.current = true; // Only guard during fresh login, not account switch
    }
    setLoginModalOpen(true);
  }

  const closeLoginModal = () => {
    setLoginModalOpen(false);
    loginInProgress.current = false;
  }

  // Handle login callback from AiohaModal
  const handleAiohaLogin = (loginResult) => {
    console.log("Aioha login result:", loginResult);

    if (!loginResult || loginResult.error) {
      toast.error("Login failed: " + (loginResult?.error || "Unknown error"));
      loginInProgress.current = false;
      return;
    }

    // Switching in from a Butter Auth session → tear it down so the new wallet
    // account isn't still treated as a Butter Auth login (stale manteauth flag).
    if (localStorage.getItem('manteauth_login') === 'true') {
      localStorage.removeItem('manteauth_login');
      fetch('/api/manteauth/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
    }
    localStorage.setItem(LOCAL_STORAGE_USER_ID_KEY, loginResult.username);
    setUser(loginResult.username);
    setLoginModalOpen(false);
    loginInProgress.current = false;
    toast.success("Login successful!");
  }

  return (
    <HangoutContextProvider tokenStorage={import.meta.env.VITE_HANGOUTS_TOKEN_STORAGE || 'none'}>
    <HiveAuthProvider>
    <EmbedUploadProvider>
    <ChatProvider>
    <div onClick={()=> {setGlobalCloseRender(true)}}>
      <Toaster
        position="top-right"
        expand
        visibleToasts={6}
        gap={12}
        closeButton
        swipeDirections={['right']}
        icons={{
          success: <CircleCheck size={22} strokeWidth={2.25} />,
          error: <CircleX size={22} strokeWidth={2.25} />,
          warning: <TriangleAlert size={22} strokeWidth={2.25} />,
          info: <Info size={22} strokeWidth={2.25} />,
        }}
        toastOptions={{
          classNames: {
            toast: 'ts-toast',
            title: 'ts-toast-title',
            description: 'ts-toast-desc',
            icon: 'ts-toast-icon',
            closeButton: 'ts-toast-close',
          },
        }}
      />
      <ChangelogModal />
      <SupportModal />
      <CookieConsent />
      <ShortsPreloader />
      {!hideNavOnMobile && (
        <Nav setSideBar={setSideBar} toggleProfileNav={toggleProfileNav} globalClose={globalCloseRender} setGlobalClose={setGlobalCloseRender} openLoginModal={openLoginModal} />
      )}
      <div>
        {!hideNavOnMobile && !sidebarHidden && <Sidebar sidebar={sidebar} />}
        <div className={`container ${sidebar && !sidebarHidden ? "" : "large-container"} ${sidebarHidden ? "sidebar-fully-hidden" : ""} ${hideNavOnMobile ? "shorts-mobile-container" : ""}`}>
          <ScrollToTop />
          {/* Browser-tab title for every route (watch/shorts set their own). */}
          <RouteTitle />
          {/* Optional: land on /shorts when the app is opened (off by default). */}
          <OpenShortsOnStart />
          {/* <Toaster richColors position="top-right" /> */}
          <Routes>
            <Route path="/" element={<HomeGrouped />} />
            <Route path="/home-feed" element={<Feed />} />
            <Route path="/follow-feed" element={<FollowFeed />} />
            <Route path="/watch" element={<Watch v2 />} />
            {/* Live OpenPods stream at /watch/<roomName> (path param, distinct
                from the ?v= VOD route above). */}
            <Route path="/watch/:streamId" element={<WatchStream />} />
            {/* Short alias for stream share links — see buildOpenPodShareUrl. */}
            <Route path="/l/:streamId" element={<WatchStream />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/post/:author/:permlink" element={<PostView />} />
            <Route path="/upload" element={<UploadVideo />} />
            <Route path="/firstupload" element={<FirstUploads />} />
            <Route path="/trend" element={<Trend />} />
            <Route path="/discover" element={<Discover />} />
            <Route path="/audio" element={<Audio />} />
            <Route path="/audio/:author/:permlink" element={<AudioPost />} />
            <Route path="/new" element={<NewVideos />} />
            <Route path="/login" element={<LoginRedirect openLoginModal={openLoginModal} />} />
            <Route path="/auth/login" element={<LoginRedirect openLoginModal={openLoginModal} />} />
             <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/callback" element={<ManteAuthCallback />} />
            {/* <Route path="/email" element={<Email/>} />  */}
            <Route path="/newlogin" element={<LoginNew />} />
            {/* Legacy /studio retired — redirect to the embed-studio non-short uploader.
                The embed-studio defaults to non-short mode when no ?from=stories|shorts
                query string is present, which is the case for these plain redirects. */}
            <Route path="/studio" element={<Navigate to="/embed-studio" replace />} />
            <Route path="/studio/thumbnail" element={<Navigate to="/embed-studio/thumbnail" replace />} />
            <Route path="/studio/details" element={<Navigate to="/embed-studio/details" replace />} />
            <Route path="/studio/preview" element={<Navigate to="/embed-studio/preview" replace />} />
            {/* Embed studio (uses embed.okinoko.io upload service) */}
            <Route path="/embed-studio" element={<EmbedStudioPage />} />
            <Route path="/embed-studio/thumbnail" element={<EmbedThumbnail />} />
            <Route path="/embed-studio/details" element={<EmbedDetails />} />
            <Route path="/embed-studio/preview" element={<EmbedPreview />} />
            <Route path="/draft" element={<DraftStudio />} />
            <Route path="/editvideo/:d" element={<EditVideo />} />
            <Route path="/edit-scheduled/:permlink" element={<EditScheduledPost />} />
            <Route path="/communities" element={<CommunitiesRender />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/privacy" element={<Legal />} />
            <Route path="/imprint" element={<Legal />} />
            <Route path="/shorts/stories" element={<ShortsStoryFeed />} />
            <Route path="/shorts" element={<Short />} />
            <Route
              path="/community/:communityName"
              element={<CommunityPage />}
            />
            <Route path="/t/:tag" element={<TagFeed />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/p/:user" element={<UserProfilePage />} />
            <Route path="/user/:user" element={<UserProfilePage />} />
            <Route path="/playlist/:playlistId" element={<PlaylistView />} />
            <Route path="/watched/:username" element={<WatchedView />} />
            <Route path="/wallet/:user" element={<Wallet />} />
            <Route path="/test" element={<ProfileModal />} />
            <Route path="/image" element={<HiveImageUploader />} />
            <Route path="/openpods" element={<OpenPods />} />
            <Route path="/openpods/publish" element={<OpenPodPublish />} />
            <Route path="/openpods/:roomName" element={<OpenPods />} />
            <Route path="/chat" element={<ChatPage />} />
            <Route path="*" element={<HiveLinkRedirect />} />
          </Routes>
          <OpenPodModalMounter />
        </div>
        {!hideNavOnMobile && (
          <ProfileNav isVisible={profileNavVisible} onclose={toggleProfileNav} toggleAddAccount={toggleAddAccount} openLoginModal={openLoginModal} />
        )}
        <MiniPlayer />
        <GlobalAudioPlayer />
        <AudioUploadModal
          isOpen={audioUploadOpen}
          onClose={() => { setAudioUploadOpen(false); setPendingAudioTrack(null); }}
          initialTrack={pendingAudioTrack}
        />
        {!hideNavOnMobile && <BottomNav openLoginModal={openLoginModal} />}
        {toggle && <AddAccount_modal close={toggleAddAccount} isOpen={toggle} /> }
        <LoginModal
          displayed={loginModalOpen}
          onLogin={handleAiohaLogin}
          onClose={closeLoginModal}
          loginTitle="Login to 3Speak"
          loginOptions={{
            msg: `${loginProof}`,
            keyType: KeyTypes.Posting
          }}
        />
        <ActiveAuthModal />
        <InterestsPrompt />
        {FEATURE_EDITOR && (
          <EditorModal
            isOpen={editorModalOpen}
            onClose={() => setEditorModalOpen(false)}
          />
        )}
      </div>
    </div>

    </ChatProvider>
    </EmbedUploadProvider>
    </HiveAuthProvider>
    </HangoutContextProvider>
  );
}

export default App;