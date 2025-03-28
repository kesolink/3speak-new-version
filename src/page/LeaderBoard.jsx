import React from 'react'
import "./LeaderBoard.scss"
import { GET_LEADER_BOARD } from '../graphql/queries';
import { useQuery } from '@apollo/client';
import "./LeaderBoard.scss"
function LeaderBoard() {
    

    let data = [
        { rank: 1, score: 519, username: "rairfoundation" },
        { rank: 2, score: 505, username: "rair2" },
        { rank: 3, score: 400, username: "pouch22" },
        { rank: 4, score: 399, username: "vladtepesblog" },
        { rank: 5, score: 398, username: "maxigan" },
        { rank: 6, score: 398, username: "vldasarchiv" },
        { rank: 7, score: 398, username: "theouterlight" },
        { rank: 8, score: 398, username: "lunaticanto" },
        { rank: 9, score: 398, username: "cryptoalvirin" },
        { rank: 10, score: 398, username: "taskmaster4450" },
        { rank: 11, score: 398, username: "khaleesii" },
        { rank: 12, score: 398, username: "yisusth" },
        { rank: 13, score: 398, username: "eddiespino" },
        { rank: 14, score: 398, username: "rtonline" },
        { rank: 15, score: 398, username: "boeltermc" },
        { rank: 16, score: 398, username: "soyjosecc" },
        { rank: 17, score: 398, username: "bananasfallers" },
        { rank: 18, score: 398, username: "luizeba" },
        { rank: 19, score: 398, username: "nophoneman" },
        { rank: 20, score: 398, username: "musicandreview" },
        { rank: 21, score: 398, username: "zullyscott" },
        { rank: 22, score: 398, username: "davedickeyyall" },
        { rank: 23, score: 398, username: "carminasalazarte" },
        { rank: 24, score: 398, username: "lsnt" },
        { rank: 25, score: 398, username: "ksam" },
        { rank: 26, score: 398, username: "cahlen" },
        { rank: 27, score: 398, username: "uchihanagato" },
        { rank: 28, score: 398, username: "samgiset" },
        { rank: 29, score: 398, username: "daltono" },
        { rank: 30, score: 398, username: "anthony2019" },
        { rank: 31, score: 398, username: "palabras1" },
        { rank: 32, score: 398, username: "iamsaray" },
        { rank: 33, score: 398, username: "taskmaster4450le" },
      ];
      
      
        const firstRow = data.slice(0, 1); // 1 card
        const secondRow = data.slice(1, 3); // 2 cards
        const thirdRow = data.slice(3, 33); // 6 cards
      
  return (
    <div className='leaderboard-container'>
        <div className='headers'>Leaderboard</div>
        <div className="gridContainer">
      {/* First Row */}
      <div className="row ">
        {firstRow.map((item) => (
          <div key={item.rank} className="leader-card add-gold">
            <div className="wrap">
                <span> Rank: {item.rank}</span>
                <span> Score: {item.score}</span>
            </div>
            <div className="image-container">
             <img src={`https://images.hive.blog/u/${item.username}/avatar`} alt="" />
            </div>
            <button>View Channel</button>
            <h3>{item.username}</h3>
            
          </div>
        ))}
      </div>

      {/* Second Row */}
      <div className="row ">
        {secondRow.map((item) => (
          <div key={item.rank} className="leader-card add-gold-2">
          <div className="wrap">
              <span> Rank: {item.rank}</span>
              <span> Score: {item.score}</span>
          </div>
          <img src={`https://images.hive.blog/u/${item.username}/avatar`} alt="" />
          <button>View Channel</button>
          <h3>{item.username}</h3>
          
        </div>
        ))}
      </div>

      {/* Third Row */}
      <div className="row">
        {thirdRow.map((item) => (
          <div key={item.rank} className="leader-card">
          <div className="wrap">
              <span> Rank: {item.rank}</span>
              <span> Score: {item.score}</span>
          </div>
          <img src={`https://images.hive.blog/u/${item.username}/avatar`} alt="" />
          <button>View Channel</button>
          <h3>{item.username}</h3>
          
        </div>
        ))}
      </div>
    </div>

    </div>
  )
}

export default LeaderBoard