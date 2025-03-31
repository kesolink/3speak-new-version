import React from 'react'
import { Waveform } from 'ldrs/react'
import 'ldrs/react/Waveform.css'
import "./BarLoader.scss"
// Default values shown

function BarLoader() {
  return (
    <div className="barloader-container">
    <Waveform
    size="35"
    stroke="3.5"
    speed="1"
    color="red" 
  />
  </div>
  )
}

export default BarLoader