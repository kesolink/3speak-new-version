import { Route, Routes } from "react-router-dom";
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
import NewVideos from "./page/NewVideos";
import UploadVideo from "./page/UploadVideo";
import Login from "./page/Login/Login";
// import KeyChainLogin from './page/Login/KeyChainLogin'
import KeyChainLogin from "./page/Login/KeyChainLogin";
import LoginNew from "./page/Login/LoginNew";
import { useAppStore } from "./lib/store";
import { useEffect } from "react";
import ProfileNav from "./components/nav/ProfileNav";
import StudioPage from "./components/studio/StudioPage";
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

function App() {
  const { initializeAuth, authenticated } = useAppStore();
  const [sidebar, setSideBar] = useState(true);
  const [profileNavVisible, setProfileNavVisible] = useState(false);
  const [globalCloseRender, setGlobalCloseRender] = useState(false)


  useEffect(() => {
    initializeAuth();
    // authenticated()
  }, []);

  

  // const closeProfileNav = ()=>{
  //   setProfileNavVisible(!profileNavVisible)
  // }
  const toggleProfileNav = () => {
    setProfileNavVisible((prev) => !prev);
    console.log(profileNavVisible);
  };

  return (
    <div onClick={()=> {setGlobalCloseRender(true)}}>
      <Nav setSideBar={setSideBar} toggleProfileNav={toggleProfileNav}  globalClose={globalCloseRender} setGlobalClose={setGlobalCloseRender} />
      <div>
        <Sidebar sidebar={sidebar} />
        <div className={`container ${sidebar ? "" : "large-container"}`}>
          <ScrollToTop />
          <Routes>
            <Route path="/" element={<Feed />} />
            <Route path="/watch" element={<Watch />} />
            <Route path="/upload" element={<UploadVideo />} />
            <Route path="/firstupload" element={<FirstUploads />} />
            <Route path="/trend" element={<Trend />} />
            <Route path="/new" element={<NewVideos />} />
            <Route path="/login" element={<KeyChainLogin />} />
            {/* <Route path="/keychain" element={<KeyChainLogin />} /> */}
            <Route path="/newlogin" element={<LoginNew />} />
            <Route path="/studio" element={<StudioPage />} />
            <Route path="/draft" element={<DraftStudio />} />
            <Route path="/editvideo/:d" element={<EditVideo />} />
            <Route path="/communities" element={<CommunitiesRender />} />
            <Route
              path="/community/:communityName"
              element={<CommunityPage />}
            />
            <Route path="/t/:tag" element={<TagFeed />} />
            <Route path="/leaderboard" element={<LeaderBoard />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/p/:user" element={<UserProfilePage />} />
            <Route path="/wallet/:user" element={<Wallet />} />
            <Route path="/testing" element={<Testing />} />
          </Routes>
        </div>
        <ProfileNav isVisible={profileNavVisible} onclose={toggleProfileNav} />
      </div>
    </div>
  );
}

export default App;
