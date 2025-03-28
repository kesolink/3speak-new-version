
// The exported code uses Tailwind CSS. Install Tailwind CSS in your dev environment to ensure all styles work.
import React, { useState } from 'react';
import * as echarts from 'echarts';
import { useEffect } from 'react';
interface CoinData {
    name: string;
    Expand
Wallet-- - HP - and - HBD.tsx.txt
10 KB

k - banti
o...

// The exported code uses Tailwind CSS. Install Tailwind CSS in your dev environment to ensure all styles work.
import React, { useState } from 'react';
import * as echarts from 'echarts';
import { useEffect } from 'react';
interface CoinData {
    name: string;
    balance: number;
    usdPrice: number;
    color: string;
    chartData: number[];
}
const App: React.FC = () => {
    const [showTransferModal, setShowTransferModal] = useState(false);
    const [selectedCoin, setSelectedCoin] = useState < CoinData | null > (null);
    const [amount, setAmount] = useState('');
    const [recipient, setRecipient] = useState('');
    interface Transaction {
        id: string;
        type: 'send' | 'receive';
        amount: number;
        coin: string;
        address: string;
        date: Date;
        status: 'completed' | 'pending' | 'failed';
    }

    const transactions: Transaction[] = [
        {
            id: '1',
            type: 'send',
            amount: 50.00,
            coin: 'HP',
            address: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
            date: new Date('2025-03-18T10:30:00'),
            status: 'completed'
        },
        {
            id: '2',
            type: 'receive',
            amount: 125.50,
            coin: 'HBD',
            address: '0x892dF3A5B77f76c413D5f2F390588D035a0E2674',
            date: new Date('2025-03-18T09:15:00'),
            status: 'completed'
        },
        {
            id: '3',
            type: 'send',
            amount: 75.25,
            coin: 'HP',
            address: '0x9B5c74A93C9DA8D3093E39B49f95B3855d6926ED',
            date: new Date('2025-03-17T16:45:00'),
            status: 'failed'
        },
        {
            id: '4',
            type: 'receive',
            amount: 200.00,
            coin: 'HP',
            address: '0x621c2C92D5faC64DdF4d5dA43C613Ebd3B229A69',
            date: new Date('2025-03-17T14:20:00'),
            status: 'completed'
        },
        {
            id: '5',
            type: 'send',
            amount: 30.75,
            coin: 'HBD',
            address: '0x8F3Cf7ad23Cd3CaDbD9735AFf958023239c6A063',
            date: new Date('2025-03-17T11:10:00'),
            status: 'pending'
        }
    ];

    const coins: CoinData[] = [
        {
            name: 'HP',
            balance: 1234.56,
            usdPrice: 0.85,
            color: '#4F46E5',
            chartData: [30, 40, 35, 50, 49, 60, 70, 91, 125, 160]
        },
        {
            name: 'HBD',
            balance: 567.89,
            usdPrice: 1.00,
            color: '#06B6D4',
            chartData: [20, 25, 30, 35, 40, 45, 50, 55, 58, 62]
        }
    ];
    useEffect(() => {
        coins.forEach((coin) => {
            const chartDom = document.getElementById(`${coin.name}-chart`);
            if (chartDom) {
                const myChart = echarts.init(chartDom);
                const option = {
                    animation: false,
                    grid: {
                        left: 0,
                        right: 0,
                        top: 0,
                        bottom: 0
                    },
                    xAxis: {
                        type: 'category',
                        show: false
                    },
                    yAxis: {
                        type: 'value',
                        show: false
                    },
                    series: [
                        {
                            data: coin.chartData,
                            type: 'line',
                            smooth: true,
                            symbol: 'none',
                            areaStyle: {
                                opacity: 0.2,
                                color: coin.color
                            },
                            lineStyle: {
                                color: coin.color
                            }
                        }
                    ]
                };
                myChart.setOption(option);
            }
        });
    }, []);
    const handleTransfer = (coin: CoinData) => {
        setSelectedCoin(coin);
        setShowTransferModal(true);
    };
    const handleSubmitTransfer = () => {
        if (!amount || !recipient) return;

        // Add new transaction to the list (in a real app, this would be handled by your backend)
        const newTransaction: Transaction = {
            id: (transactions.length + 1).toString(),
            type: 'send',
            amount: parseFloat(amount),
            coin: selectedCoin!.name,
            address: recipient,
            date: new Date(),
            status: 'pending'
        };

        transactions.unshift(newTransaction);

        setShowTransferModal(false);
        setAmount('');
        setRecipient('');
    };
    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-7xl mx-auto px-4 py-12">
                <div className="mb-8">
                    <h1 className="text-4xl font-bold text-gray-900">My Wallet</h1>
                    <p className="mt-2 text-gray-600">Manage your cryptocurrency assets</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {coins.map((coin) => (
                        <div
                            key={coin.name}
                            className="bg-white rounded-xl shadow-sm p-6 relative overflow-hidden"
                        >
                            <div className="relative z-10">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h2 className="text-2xl font-semibold text-gray-900">{coin.name}</h2>
                                        <p className="text-gray-500">Current Balance</p>
                                    </div>
                                    <button
                                        onClick={() => handleTransfer(coin)}
                                        className="!rounded-button bg-indigo-600 text-white px-4 py-2 text-sm font-medium hover:bg-indigo-700 transition-colors cursor-pointer whitespace-nowrap"
                                    >
                                        Transfer {coin.name}
                                    </button>
                                </div>
                                <div className="mt-6">
                                    <div className="flex items-baseline">
                                        <span className="text-4xl font-bold text-gray-900">
                                            {coin.balance.toFixed(2)}
                                        </span>
                                        <span className="ml-2 text-gray-500">{coin.name}</span>
                                    </div>
                                    <p className="mt-1 text-gray-600">
                                        ≈ ${(coin.balance * coin.usdPrice).toFixed(2)} USD
                                    </p>
                                </div>
                            </div>
                            <div className="absolute bottom-0 left-0 right-0 h-24" id={`${coin.name}-chart`}></div>
                        </div>
                    ))}
                </div>

                <div className="mt-12">
                    <h2 className="text-2xl font-bold text-gray-900 mb-6">Transaction History</h2>
                    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Type
                                        </th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Amount
                                        </th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Address
                                        </th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Date
                                        </th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Status
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {transactions.map((transaction) => (
                                        <tr key={transaction.id}>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center">
                                                    <span className={`mr-2 text-lg ${transaction.type === 'send' ? 'text-red-500' : 'text-green-500'}`}>
                                                        <i className={`fas fa-${transaction.type === 'send' ? 'arrow-up' : 'arrow-down'}`}></i>
                                                    </span>
                                                    <span className="font-medium">{transaction.type === 'send' ? 'Sent' : 'Received'}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="font-medium">{transaction.amount.toFixed(2)}</span>
                                                <span className="ml-1 text-gray-500">{transaction.coin}</span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="font-mono text-sm text-gray-600">
                                                    {`${transaction.address.slice(0, 6)}...${transaction.address.slice(-4)}`}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {new Intl.DateTimeFormat('en-US', {
                                                    month: 'short',
                                                    day: 'numeric',
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                }).format(transaction.date)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                  ${transaction.status === 'completed' ? 'bg-green-100 text-green-800' :
                                                        transaction.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                                            'bg-red-100 text-red-800'}`}>
                                                    {transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1)}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {showTransferModal && selectedCoin && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                        <div className="bg-white rounded-xl p-6 w-full max-w-md">
                            <h3 className="text-xl font-semibold mb-4">
                                Transfer {selectedCoin.name}
                            </h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Amount ({selectedCoin.name})
                                    </label>
                                    <input
                                        type="number"
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                        placeholder="0.00"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Recipient Address
                                    </label>
                                    <input
                                        type="text"
                                        value={recipient}
                                        onChange={(e) => setRecipient(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                        placeholder="Enter recipient address"
                                    />
                                </div>
                                <div className="flex space-x-3 mt-6">
                                    <button
                                        onClick={() => setShowTransferModal(false)}
                                        className="!rounded-button flex-1 bg-gray-100 text-gray-700 px-4 py-2 text-sm font-medium hover:bg-gray-200 transition-colors cursor-pointer whitespace-nowrap"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleSubmitTransfer}
                                        className="!rounded-button flex-1 bg-indigo-600 text-white px-4 py-2 text-sm font-medium hover:bg-indigo-700 transition-colors cursor-pointer whitespace-nowrap"
                                    >
                                        Confirm Transfer
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
export default App
Wallet-- - HP - and - HBD.tsx.txt
10 KB