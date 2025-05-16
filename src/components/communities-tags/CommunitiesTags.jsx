
import { Link, useNavigate } from "react-router-dom";
import "./CommunitriesTags.scss"
import { FaVideo } from 'react-icons/fa'
import { useAppStore } from "../../lib/store";
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
function CommunitiesTags() {
  const { authenticated } = useAppStore();
  const navigate = useNavigate();
  const handleSelectTag = (tag) => {
    console.log(tag)
    navigate(`/t/${tag}`);
  };
  const handleNavigate = ()=>{
    if(!authenticated){
      toast.error("Login to upload video")
    }else{
      navigate(`/upload`)
    }
    
  }
  return (
    <div className="wrap-community">
        <div className="wrap">
        <span onClick={()=>{handleSelectTag("splinterlands"); console.log("click")}}>splinterlands</span>
        <span onClick={()=>{handleSelectTag("vibes"); console.log("click")}}>vibes</span>
        <span onClick={()=>{handleSelectTag("music"); console.log("click")}}>music</span>
        <span className="tags">garden</span>
        <span className="tags">motivation</span>
        <span className="tags">Qurator</span>
        <span className="tags tab-out">Foodies Bee Hive</span>
        <span className="tab-out" onClick={()=>{handleSelectTag("leofinance"); console.log("click")}}>LeoFinance</span>
        {/* <span>garden</span>
        <span>motivation</span>
        <span>Qurator</span>
        <span>Foodies Bee Hive</span>
        <span>LeoFinance</span>
        <span>garden</span>
        <span>motivation</span>
        <span>Qurator</span> */}
        <span className="tags tab-out">Foodies Bee Hive</span>
        <span className="tags tab-out">LeoFinance</span>
        </div>

        <div className="wrap-upload-video" onClick={handleNavigate}>
        <FaVideo />
        </div>

    </div>
  )
}

export default CommunitiesTags