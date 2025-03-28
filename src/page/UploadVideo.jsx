import  { useState } from 'react'
import "./Uploadvideo.scss"
import Select from '../components/studio/Select'

function UploadVideo() {
  const [step, setStep] = useState(1)

  return (
    <div>
      <Select />
    </div>
  )
}

export default UploadVideo