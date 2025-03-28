import React, { useState, useEffect } from 'react';
import * as echarts from 'echarts';
import './Wallet.scss';
// import Skeleton, { SkeletonLoader } from '../components/Wallet/Skeleton';
import TrxHistory from '../components/Wallet/TrxHistory';
import { useAppStore } from '../lib/store';
import { Client } from '@hiveio/dhive';
import TransferModal from '../components/Wallet/TransferModal';

const client = new Client([
  'https://api.hive.blog',
  'https://api.hivekings.com',
  'https://anyx.io',
  'https://api.openhive.network'
]);

function Wallet() {
  const { user } = useAppStore();
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [selectedCoin, setSelectedCoin] = useState(null);
  const [amount, setAmount] = useState('');
  const [recipient, setRecipient] = useState('');
  const [balances, setBalances] = useState({
    hp: 0,
    hbd: 0,
    hive: 0,
    savings_hbd: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [usdPrices, setUsdPrices] = useState({
    HP: 0.85,
    HBD: 1.00
  });

  useEffect(() => {
    

    if (user) fetchBalances();
    fetchPrices();
  }, [user]);

  const fetchBalances = async () => {
    try {
      setIsLoading(true);
      const [account] = await client.database.getAccounts([user]);
      const dgp = await client.database.getDynamicGlobalProperties();

      const vestsToHP = (vests) => {
        const totalVests = parseFloat(dgp.total_vesting_shares.split(' ')[0]);
        const totalHP = parseFloat(dgp.total_vesting_fund_hive.split(' ')[0]);
        return (vests * totalHP) / totalVests;
      };

      setBalances({
        hp: vestsToHP(parseFloat(account.vesting_shares.split(' ')[0])),
        hbd: parseFloat(account.hbd_balance.split(' ')[0]),
        hive: parseFloat(account.balance.split(' ')[0]),
        savings_hbd: parseFloat(account.savings_hbd_balance.split(' ')[0])
      });

    } catch (err) {
      setError('Failed to fetch balances');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

// const fetchBalances = async () => {
//     try {
//       const [account] = await client.database.getAccounts([user]);
//       const dgp = await client.database.getDynamicGlobalProperties();
  
//       // Define vestsToHP before using it
//       const vestsToHP = (vests) => {
//         const totalVests = parseFloat(dgp.total_vesting_shares.split(' ')[0]);
//         const totalHP = parseFloat(dgp.total_vesting_fund_hive.split(' ')[0]);
//         return (vests * totalHP) / totalVests;
//       };
  
//       setBalances((prevBalances) => ({
//         ...prevBalances,
//         hp: vestsToHP(parseFloat(account.vesting_shares.split(' ')[0])),
//         hbd: parseFloat(account.hbd_balance.split(' ')[0]),
//         hive: parseFloat(account.balance.split(' ')[0]),
//         savings_hbd: parseFloat(account.savings_hbd_balance.split(' ')[0])
//       }));
//     } catch (err) {
//       console.error("Error fetching balances:", err);
//     }
//   };
  

  const fetchPrices = async () => {
    try {
      const marketData = await client.call('market_history_api', 'get_ticker', {});
      
      // Extract the latest market price
      const hivePrice = parseFloat(marketData.latest);

      setUsdPrices({
        HP: hivePrice, // HP is valued as HIVE
        HBD: 1.00 // HBD is roughly pegged to 1 USD
      });
    } catch (error) {
      console.error("Error fetching market prices:", error);
    }
  };

  const coins = [
    {
      name: 'HIVE',
      balance: balances.hive,
      usdPrice: usdPrices.HP,
      color: '#4F46E5',
      chartData: [] // Add real chart data implementation
    },
    {
      name: 'HBD',
      balance: balances.hbd,
      usdPrice: usdPrices.HBD,
      color: '#06B6D4',
      chartData: [] // Add real chart data implementation
    }
  ];

  const handleTransfer = (coinType) => {
    console.log(coinType)
    const coin = coins.find(c => c.name === coinType);
    setSelectedCoin(coin);
    setShowTransferModal(true);
  };



//   if (isLoading) return <SkeletonLoader count={2}><Skeleton type="card" /></SkeletonLoader>;
  if (error) return <div className="error">{error}</div>;

  return (
    <div className="wallet-container">
      <div className="main-content">
        <div className="wallet-header">
          <h1>My Wallet</h1>
          <p>Manage your cryptocurrency assets</p>
        </div>

        <div className="coins-grid">
          {coins.map((coin) => (
            <div key={coin.name} className="coin-card">
              <div className="coin-header">
                <div className="coin-info">
                  <h2>{coin.name}</h2>
                  <p>Current Balance</p>
                </div>
                <button
                  className="transfer-btn"
                  onClick={() => handleTransfer(coin.name)}
                >
                  Transfer {coin.name}
                </button>
              </div>

              <div className="balance-section">
                <div className="balance-amount">
                  {coin.balance.toFixed(3)}
                  <span>{coin.name}</span>
                </div>
                <p className="usd-value">
                  ≈ ${(coin.balance * coin.usdPrice).toFixed(2)} USD
                </p>
              </div>

              <div className="chart-container" id={`${coin.name}-chart`}></div>
            </div>
          ))}
        </div>

        <TrxHistory user={user} />

        {showTransferModal && selectedCoin && ( <TransferModal 
        showModal={setShowTransferModal} 
        selectedCoin={selectedCoin}
        balances={balances}
        fetchBalances={fetchBalances} />)}
      </div>
    </div>
  );
}

export default Wallet;

