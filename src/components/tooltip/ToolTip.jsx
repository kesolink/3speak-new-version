import React, { useEffect, useState } from 'react'

import "./ToolTip.scss"

function ToolTip({tooltipVoters}) {
    // const [data, setData] = useState([])
    // const [loading, setLoading] = useState(true); // Optional loading state
    // const [error, setError] = useState(null);

    // useEffect(()=>{
    //     const fetchData = async ()=>{
    //      try{
    //         setLoading(true)
    //         const result = await getTooltipVoters();
    //         setData(result);
    //      } catch(err){
    //         console.error("Failed to fetch tooltip voters:", err)
    //         setError("failed to load data")
    //      } finally{
    //         setLoading(false);
    //      }
    //     }
    //     fetchData()
    // },[getTooltipVoters])
    // console.log(tooltipVoters)

  return (
    <div className="tooltip" id="reward-tooltip">
                {/* {data.length > 0 ? ( */}
                    {tooltipVoters.map((voter, index) => (
                        <div key={index} className="tooltip-item">
                            <span className="username">@{voter.username}</span>
                            <span className="reward">: ${voter.reward.toFixed(2)}</span>
                        </div>
                    ))}
                {/* ) : (
                    <p>No upvotes yet.</p>
                )} */}
                <div className="arrow"></div>
            </div>
  )
}

export default ToolTip