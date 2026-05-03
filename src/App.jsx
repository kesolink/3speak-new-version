import { Route, Routes, useLocation, useNavigate, Navigate, useParams } from "react-router-dom";
import { useRef, lazy, Suspense } from "react";
import "./App.css";
// import Home from './page/Home'
// import Treanding from './page/Treanding'
import Nav from "./components/nav/Nav";
import { useState } from "react";
import Watch from "./page/Watch";
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
import { useEffect } from "react";
import ProfileNav from "./components/nav/ProfileNav";
import StudioPage from "./components/legacy-studio/StudioPage";
// import StudioPage2 from "./components/legacy-studio/StudioPage";
import CommunitiesRender from "./components/Communities/CommunitiesRender";
import CommunityPage from "./components/Communities/CommunityPage";
import TagFeed from "./page/TagFeed";
import LeaderBoard from "./page/LeaderBoard";
import ProfilePage from "./page/ProfilePage";
import Wallet from "./page/Wallet";
import Testing from "./components/Testingfile/Testing";
import UserProfilePage from "./components/Userprofilepage/UserProfilePage";
import DraftStudio from "./components/studio/DraftStudio";
import EditVideo from "./page/EditVideo";
import ScrollToTop from "./components/ScrollToTop";
import AddAccount_modal from "./components/modal/AddAccount_modal";
import TestingLogin3 from "./page/Login/TestingLogin3";
// import TestingLogin from "./page/Login/TestingLogin";
import AboutPage from "./components/LandingPage/AboutPage";
import { toast, Toaster } from 'sonner'
import Thumbnail from "./components/legacy-studio/Thumbnail";
import Details from "./components/legacy-studio/Details";
import Preview from "./components/legacy-studio/Preview";
import Test from "./page/Test";
import Short from "./page/Short";
import ShortsStoryFeed from "./page/ShortsStoryFeed";
import ShortsPreloader from "./components/ShortsPreloader";
// import Email from "./page/Login/Email"
// import AuthCallback from "./page/Login/AuthCallback";
// import {AUTH_JWT_SECRET} from "../src/utils/config";


import { jwtDecode } from "jwt-decode";
import AuthCallback from "./page/Login/AuthCallback";
import NotFound from "./page/NotFound";
import ProfileModal from "./components/modal/ProfileModal";
import HiveImageUploader from "./page/HiveImageUploader";
import PlaylistView from "./page/PlaylistView";
import WatchedView from "./page/WatchedView";
import { LegacyUploadProvider } from "./context/LegacyUploadContext";
import { EmbedUploadProvider } from "./context/EmbedUploadContext";
import { HiveAuthProvider } from "./context/HiveAuthContext";
import { HangoutContextProvider, useHangout } from "./context/HangoutContext";
import OpenPods from "./page/OpenPods";
import OpenPodPublish from "./page/OpenPodPublish";
import PostView from "./page/PostView";

const OpenPodModal = lazy(() => import("./components/OpenPod/OpenPodModal"));

function OpenPodModalMounter() {
  const { activeRoom, closeRoom, sessionToken, hangoutsUser } = useHangout();
  if (!activeRoom) return null;
  return (
    <Suspense fallback={null}>
      <OpenPodModal
        isOpen
        onClose={closeRoom}
        roomName={activeRoom}
        sessionToken={sessionToken}
        username={hangoutsUser}
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
import EditorModal from "./components/modal/EditorModal";
import { FEATURE_EDITOR } from "./utils/config";
import BottomNav from "./components/BottomNav/BottomNav";
import MiniPlayer from "./components/MiniPlayer/MiniPlayer";
import { KeyTypes } from "@aioha/aioha";
import '@aioha/react-ui/dist/build.css';
import { LOCAL_STORAGE_USER_ID_KEY } from "./hooks/localStorageKeys";

// Hive-like URL redirects: /@user → profile, /@user/permlink → watch, /@user/shorts → profile shorts tab
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
      return <Navigate to={`/watch?v=${user}/${permlink}`} replace />;
    }
    return <Navigate to={`/p/${user}`} replace />;
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
  const { initializeAuth, authenticated, LogOut, switchAccount, setUser, user: appUser } = useAppStore();
  const { aioha, user: aiohaUser } = useAioha();
  const sidebar = useAppStore((s) => s.sidebarOpen);
  const setSideBar = useAppStore((s) => s.setSidebarOpen);
  const [profileNavVisible, setProfileNavVisible] = useState(false);

  const [globalCloseRender, setGlobalCloseRender] = useState(false)
  const [toggle, setToggle] = useState(false);
  const [reloadSwitch, setRelaodSwitch] = useState(false)
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [loginProof, setLoginProof] = useState(() => Math.floor(Date.now() / 1000));
  const [editorModalOpen, setEditorModalOpen] = useState(false);
  const loginInProgress = useRef(false); // Track if login is being processed
  const aiohaUserSeen = useRef(false); // Track if aiohaUser has ever been populated

  // Hide nav on /shorts route on mobile
  const isShorts = location.pathname.startsWith('/shorts');
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

  useEffect(() => {
    initializeAuth();
    tokenVaildation()

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
    } catch (err) {
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
      localStorage.setItem(LOCAL_STORAGE_USER_ID_KEY, aiohaUser);
      setUser(aiohaUser);
      setLoginModalOpen(false);
      toast.success("Login successful!");
    }
  }, [aiohaUser]);



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

    localStorage.setItem(LOCAL_STORAGE_USER_ID_KEY, loginResult.username);
    setUser(loginResult.username);
    setLoginModalOpen(false);
    loginInProgress.current = false;
    toast.success("Login successful!");
  }

  return (
    <HangoutContextProvider>
    <HiveAuthProvider>
    <LegacyUploadProvider>
    <EmbedUploadProvider>
    <div onClick={()=> {setGlobalCloseRender(true)}}>
      <Toaster richColors position="top-right" />
      <ShortsPreloader />
      {!hideNavOnMobile && (
        <Nav setSideBar={setSideBar} toggleProfileNav={toggleProfileNav} globalClose={globalCloseRender} setGlobalClose={setGlobalCloseRender} openLoginModal={openLoginModal} />
      )}
      <div>
        {!hideNavOnMobile && <Sidebar sidebar={sidebar} />}
        <div className={`container ${sidebar ? "" : "large-container"} ${hideNavOnMobile ? "shorts-mobile-container" : ""}`}>
          <ScrollToTop />
          {/* <Toaster richColors position="top-right" /> */}
          <Routes>
            <Route path="/" element={<HomeGrouped />} />
            <Route path="/home-feed" element={<Feed />} />
            <Route path="/follow-feed" element={<FollowFeed />} />
            <Route path="/watch" element={<Watch />} />
            <Route path="/upload" element={<UploadVideo />} />
            <Route path="/firstupload" element={<FirstUploads />} />
            <Route path="/trend" element={<Trend />} />
            <Route path="/discover" element={<Discover />} />
            <Route path="/new" element={<NewVideos />} />
            <Route path="/login" element={<LoginRedirect openLoginModal={openLoginModal} />} />
            <Route path="/auth/login" element={<LoginRedirect openLoginModal={openLoginModal} />} />
             <Route path="/auth/callback" element={<AuthCallback />} />
            {/* <Route path="/email" element={<Email/>} />  */}
            <Route path="/newlogin" element={<LoginNew />} />
            <Route path="/studio" element={<StudioPage />} />
            <Route path="/studio/thumbnail" element={<Thumbnail />} />
            <Route path="/studio/details" element={<Details />} />
            <Route path="/studio/preview" element={<Preview />} />
            {/* Embed studio (uses embed.okinoko.io upload service) */}
            <Route path="/embed-studio" element={<EmbedStudioPage />} />
            <Route path="/embed-studio/thumbnail" element={<EmbedThumbnail />} />
            <Route path="/embed-studio/details" element={<EmbedDetails />} />
            <Route path="/embed-studio/preview" element={<EmbedPreview />} />
            {/* <Route path="/studio2" element={<StudioPage2 />} /> */}
            <Route path="/draft" element={<DraftStudio />} />
            <Route path="/editvideo/:d" element={<EditVideo />} />
            <Route path="/communities" element={<CommunitiesRender />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/shorts/stories" element={<ShortsStoryFeed />} />
            <Route path="/shorts" element={<Short />} />
            <Route
              path="/community/:communityName"
              element={<CommunityPage />}
            />
            <Route path="/t/:tag" element={<TagFeed />} />
            <Route path="/leaderboard" element={<LeaderBoard />} />
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
            <Route path="/post/:user/:permlink" element={<PostView />} />
            <Route path="*" element={<HiveLinkRedirect />} />
          </Routes>
          <OpenPodModalMounter />
        </div>
        {!hideNavOnMobile && (
          <ProfileNav isVisible={profileNavVisible} onclose={toggleProfileNav} toggleAddAccount={toggleAddAccount} openLoginModal={openLoginModal} />
        )}
        <MiniPlayer />
        <BottomNav openLoginModal={openLoginModal} />
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
        {FEATURE_EDITOR && (
          <EditorModal
            isOpen={editorModalOpen}
            onClose={() => setEditorModalOpen(false)}
          />
        )}
      </div>
    </div>

    </EmbedUploadProvider>
    </LegacyUploadProvider>
    </HiveAuthProvider>
    </HangoutContextProvider>
  );
}

export default App;