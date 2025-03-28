import React from 'react'
import { WifiLoader } from "react-awesome-loaders";
import "./NetworkLoader.scss"

function NetworkLoader() {
  return (
    <div className='networkloader-container'>
        <WifiLoader
        background={"transparent"}
        desktopSize={"150px"}
        mobileSize={"150px"}
        text={"Wifi Loader"}
        // backColor="#E8F2FC"
        backColor="#FF0000"
        frontColor="#FF0000"
      />
    </div>
  )
}

// link for awesome loaders => https://awesome-loaders.netlify.app/docs/loaders/wifiloader/

export default NetworkLoader