import React, { useEffect, useState } from "react";
import "./TrxHistory.scss";
import { Client } from "@hiveio/dhive";
import Skeleton from "./Skeleton";

const client = new Client([
  "https://api.hive.blog",
  "https://api.hivekings.com",
  "https://anyx.io",
  "https://api.openhive.network",
]);

const BATCH_SIZE = 100;
const MAX_TRANSACTIONS = 100;

async function fetchAllTransactions(username) {
  let transactions = [];
  let start = -1;
  let attempts = 0;

  while (transactions.length < MAX_TRANSACTIONS && attempts < 10) {
    try {
      const batch = await client.database.getAccountHistory(username, start, BATCH_SIZE);

      const processed = batch
        .map(([index, op]) => {
          const [type, data] = op.op;

          if (type === "transfer") {
            const isSend = data.from === username;
            const [amount, currency] = data.amount.split(" ");

            return {
              id: index,
              type: isSend ? "send" : "receive",
              amount: parseFloat(amount),
              coin: currency,
              address: isSend ? data.to : data.from,
              date: new Date(op.timestamp + "Z"),
              memo: data.memo,
            };
          }

          if (type === "claim_reward_balance") {
            return {
              id: index,
              type: "claim",
              amount: {
                HIVE: data.reward_hive_balance ? parseFloat(data.reward_hive_balance.split(" ")[0]) : 0,
                HBD: data.reward_hbd_balance ? parseFloat(data.reward_hbd_balance.split(" ")[0]) : 0,
                HP: data.reward_vests ? parseFloat(data.reward_vests.split(" ")[0]) : 0,
              },
              date: new Date(op.timestamp + "Z"),
              memo: "Claimed Rewards",
            };
          }

          return null;
        })
        .filter((tx) => tx !== null);

      transactions = [...transactions, ...processed];
      start = batch[0][0] - BATCH_SIZE;
      if (start < 0) break;

      attempts++;
      await new Promise((resolve) => setTimeout(resolve, 300));
    } catch (error) {
      console.error("Error fetching transactions:", error);
      break;
    }
  }

  return transactions.sort((a, b) => b.date - a.date);
}

function TrxHistory({ user }) {
  const [isLoading, setIsLoading] = useState(true);
  const [transactions, setTransactions] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadTransactions = async () => {
      try {
        setIsLoading(true);
        if (user) {
          const txns = await fetchAllTransactions(user);
          setTransactions(txns);
        }
      } catch (err) {
        setError("Failed to load transactions");
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    loadTransactions();
  }, [user]);

  return (
    <div className="transaction-history">
      <h2>Transaction History</h2>
      <div className="history-table">
        {isLoading ? (
          <Skeleton />
        ) : error ? (
          <div className="error-message">{error}</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th>Amount</th>
                <th>Account</th>
                <th>Date</th>
                <th>Memo</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((transaction) => (
                <tr key={transaction.id}>
                  <td>
                    <div className="tx-type">
                      <span className={`tx-icon ${transaction.type}`}>
                        <i
                          className={`fas fa-${
                            transaction.type === "send"
                              ? "arrow-up"
                              : transaction.type === "claim"
                              ? "gift"
                              : "arrow-down"
                          }`}
                        ></i>
                      </span>
                      {transaction.type === "send"
                        ? "Transfer"
                        : transaction.type === "claim"
                        ? "Claim Reward"
                        : "Received"}
                    </div>
                  </td>
                  <td>
                    {transaction.type === "claim" ? (
                      <>
                        {transaction.amount.HIVE > 0 && (
                          <div className="tx-amount">
                            {transaction.amount.HIVE.toFixed(3)} HIVE
                          </div>
                        )}
                        {transaction.amount.HBD > 0 && (
                          <div className="tx-amount">
                            {transaction.amount.HBD.toFixed(3)} HBD
                          </div>
                        )}
                        {transaction.amount.HP > 0 && (
                          <div className="tx-amount">
                            {transaction.amount.HP.toFixed(3)} HP
                          </div>
                        )}
                      </>
                    ) : (
                      <span className="tx-amount">
                        {transaction.amount.toFixed(3)}
                        <span>{transaction.coin}</span>
                      </span>
                    )}
                  </td>
                  <td>
                    <span className="tx-address">
                      {transaction.address || "-"}
                    </span>
                  </td>
                  <td>
                    {new Intl.DateTimeFormat("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    }).format(transaction.date)}
                  </td>
                  <td>
                    <span className="memo">{transaction.memo || "-"}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default TrxHistory;