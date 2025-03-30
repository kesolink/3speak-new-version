
import { Link, useNavigate } from "react-router-dom";
import "./CommunitriesTags.scss"
import { FaVideo } from 'react-icons/fa'
function CommunitiesTags() {
  const navigate = useNavigate();
  const handleSelectTag = (tag) => {
    console.log(tag)
    navigate(`/t/${tag}`);
  };
  return (
    <div className="wrap-community">
        <div className="wrap">
        <span onClick={()=>{handleSelectTag("splinterlands"); console.log("click")}}>splinterlands</span>
        <span onClick={()=>{handleSelectTag("vibes"); console.log("click")}}>vibes</span>
        <span onClick={()=>{handleSelectTag("music"); console.log("click")}}>music</span>
        <span className="tags">garden</span>
        <span className="tags">motivation</span>
        <span className="tags">Qurator</span>
        <span className="tags">Foodies Bee Hive</span>
        <span onClick={()=>{handleSelectTag("leofinance"); console.log("click")}}>LeoFinance</span>
        {/* <span>garden</span>
        <span>motivation</span>
        <span>Qurator</span>
        <span>Foodies Bee Hive</span>
        <span>LeoFinance</span>
        <span>garden</span>
        <span>motivation</span>
        <span>Qurator</span> */}
        <span className="tags">Foodies Bee Hive</span>
        <span className="tags">LeoFinance</span>
        </div>

        <Link to="/upload"><div className="wrap-upload-video">
        <FaVideo />
        </div></Link>

    </div>
  )
}

export default CommunitiesTags