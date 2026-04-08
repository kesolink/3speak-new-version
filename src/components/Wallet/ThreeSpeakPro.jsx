import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { useAppStore } from '../../lib/store';
import { isLoggedIn } from '../../hive-api/aioha';
import {
  callSubsContract,
  buildTransferIntent,
  pollTxStatus,
  queryHasura,
  getVscBalance,
  depositAndCallContract,
  SUBS_CONTRACT_ID,
} from '../../utils/vscContract';
import { KeyTypes } from '@aioha/aioha';
import './ThreeSpeakPro.scss';

const SUB_OFFER_ID = 5;
const ONETIME_OFFER_ID = 6;

const INTERVAL_LABELS = {
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
};

const INTERVAL_DURATIONS = {
  monthly: '30 days',
  quarterly: '90 days',
  yearly: '365 days',
};

function ThreeSpeakPro() {
  const { user, authenticated } = useAppStore();
  const loggedIn = authenticated && isLoggedIn();

  // VSC L2 balances
  const [vscBalances, setVscBalances] = useState({ hive: 0, hbd: 0 });

  // Offer data from the contract
  const [subOffer, setSubOffer] = useState(null);
  const [onetimeOffer, setOnetimeOffer] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [onetimePurchase, setOnetimePurchase] = useState(null);
  const [loadingOffer, setLoadingOffer] = useState(true);
  const [loadingSub, setLoadingSub] = useState(false);

  // UI state — selected plan: 'onetime' or an interval name like 'monthly'/'yearly'
  const [selectedPlan, setSelectedPlan] = useState('monthly');
  const [topUpAmount, setTopUpAmount] = useState('');
  const [processing, setProcessing] = useState(false);
  const [txStatus, setTxStatus] = useState(null); // { state: 'broadcasting'|'polling'|'done'|'error', msg }

  // Parse offer intervals from string "monthly=5.000,yearly=50.000"
  const parseIntervals = (intervalsStr) => {
    if (!intervalsStr) return {};
    const result = {};
    const pairs = intervalsStr.split(',');
    for (const pair of pairs) {
      const [interval, price] = pair.split('=');
      if (interval && price) {
        result[interval.trim()] = parseFloat(price);
      }
    }
    return result;
  };

  // Fetch both offers from Hasura (instant, no tx needed)
  const fetchOffer = useCallback(async () => {
    setLoadingOffer(true);
    try {
      const data = await queryHasura(`
        query {
          sub: oki_subs_offer_current(where: { id: { _eq: ${SUB_OFFER_ID} } }) {
            id name type state asset one_time intervals description
            total_subscribers active_subscribers
          }
          onetime: oki_subs_offer_current(where: { id: { _eq: ${ONETIME_OFFER_ID} } }) {
            id name type state asset one_time intervals description
          }
        }
      `);

      const sub = data?.sub?.[0];
      const ot = data?.onetime?.[0];

      if (sub) {
        setSubOffer(sub);
        const intervals = parseIntervals(sub.intervals);
        const first = Object.keys(intervals)[0];
        if (first && selectedPlan !== 'onetime') setSelectedPlan(first);
      }
      if (ot) setOnetimeOffer(ot);
    } catch (err) {
      console.error('Failed to fetch offers:', err);
    } finally {
      setLoadingOffer(false);
    }
  }, []);

  // Fetch user's subscription + one-time purchase status from Hasura
  const fetchSubscription = useCallback(async () => {
    if (!user) return;
    setLoadingSub(true);
    try {
      const data = await queryHasura(`
        query {
          oki_subs_subscription_current(where: {
            subscriber: { _eq: "hive:${user}" },
            offer_id: { _eq: ${SUB_OFFER_ID} }
          }) {
            subscriber offer_id interval balance next_billing_at status asset subscriber_index
          }
          oki_subs_onetime_paid_events(
            where: {
              buyer: { _eq: "hive:${user}" },
              id: { _eq: ${ONETIME_OFFER_ID} }
            },
            order_by: { indexer_ts: desc },
            limit: 1
          ) {
            id buyer amount asset indexer_ts
          }
        }
      `);

      const sub = data?.oki_subs_subscription_current?.[0];
      setSubscription(sub || null);

      const purchase = data?.oki_subs_onetime_paid_events?.[0];
      setOnetimePurchase(purchase || null);
    } catch (err) {
      console.log('No subscription found (normal for new users)');
      setSubscription(null);
      setOnetimePurchase(null);
    } finally {
      setLoadingSub(false);
    }
  }, [user]);

  const fetchBalance = useCallback(async () => {
    if (!user) return;
    try {
      const bal = await getVscBalance(user);
      setVscBalances(bal);
    } catch (err) {
      console.error('Failed to fetch VSC balance:', err);
    }
  }, [user]);

  useEffect(() => {
    fetchOffer();
    if (loggedIn) {
      fetchSubscription();
      fetchBalance();
    }
  }, [fetchOffer, fetchSubscription, fetchBalance, loggedIn]);

  const intervals = subOffer ? parseIntervals(subOffer.intervals) : {};
  const subAsset = subOffer?.asset || 'hive';
  const subAssetUpper = subAsset.toUpperCase();
  const onetimePrice = onetimeOffer ? (parseFloat(onetimeOffer.one_time) || 0) : 0;
  const onetimeAsset = onetimeOffer?.asset || 'hive';
  const onetimeAssetUpper = onetimeAsset.toUpperCase();
  const isActive = subscription?.status === 'active';
  const currentBalance = subscription ? parseFloat(subscription.balance || '0') : 0;
  const currentInterval = subscription?.interval;
  const nextBilling = subscription?.next_billing_at ? new Date(parseInt(subscription.next_billing_at) * 1000) : null;
  const hasAnyOffer = subOffer || onetimeOffer;

  // One-time purchase: active for 24h after purchase timestamp
  const ONETIME_DURATION_MS = 24 * 60 * 60 * 1000;
  const onetimePurchaseTime = onetimePurchase?.indexer_ts
    ? new Date(onetimePurchase.indexer_ts + (onetimePurchase.indexer_ts.endsWith('Z') ? '' : 'Z'))
    : null;
  const onetimeExpiresAt = onetimePurchaseTime
    ? new Date(onetimePurchaseTime.getTime() + ONETIME_DURATION_MS)
    : null;
  const onetimeIsActive = onetimeExpiresAt ? onetimeExpiresAt > new Date() : false;
  const onetimeTimeLeft = onetimeExpiresAt ? Math.max(0, onetimeExpiresAt.getTime() - Date.now()) : 0;

  // Poll helper that updates txStatus with elapsed time
  const pollWithProgress = (txId) => {
    return pollTxStatus(txId, 120000, ({ elapsed }) => {
      setTxStatus({
        state: 'polling',
        msg: `Waiting for VSC confirmation… ${elapsed}s`,
      });
    });
  };

  /**
   * Determine how much L1 deposit is needed for a given price.
   * The contract has no free-floating balance — all funds are per-offer.
   * So we just check the Magi L2 balance and deposit the gap from L1.
   */
  const calcDepositNeeded = (price, asset) => {
    const l2 = vscBalances[asset.toLowerCase()] || 0;
    const remaining = price - l2;
    if (remaining <= 0) return 0;
    return Math.ceil(remaining * 1000) / 1000; // round up to 0.001
  };

  // Purchase: handles both one-time and subscription, with auto-deposit if needed
  const handlePurchase = async () => {
    if (!loggedIn || processing) return;

    const isOnetime = selectedPlan === 'onetime';
    const offerId = isOnetime ? ONETIME_OFFER_ID : SUB_OFFER_ID;
    const price = isOnetime ? onetimePrice : intervals[selectedPlan];
    const payAsset = isOnetime ? onetimeAsset : subAsset;
    if (!price) return;

    const depositNeeded = calcDepositNeeded(price, payAsset);

    setProcessing(true);
    setTxStatus({
      state: 'broadcasting',
      msg: depositNeeded > 0
        ? `Depositing ${depositNeeded.toFixed(3)} ${payAsset.toUpperCase()} to VSC and purchasing…`
        : 'Approve the transaction in your wallet…',
    });

    try {
      const intent = buildTransferIntent(price.toFixed(3), payAsset);
      const payload = isOnetime ? `${offerId}` : `${offerId}|${selectedPlan}`;
      let result;

      if (depositNeeded > 0) {
        result = await depositAndCallContract(
          depositNeeded.toFixed(3), payAsset, user, 'pay_offer', payload, [intent]
        );
      } else {
        result = await callSubsContract('pay_offer', payload, [intent]);
      }

      const pollResult = await pollWithProgress(result.result);

      if (pollResult.status === 'success') {
        const msg = isOnetime ? 'One-time purchase complete!' : 'Subscribed to 3Speak Pro!';
        setTxStatus({ state: 'done', msg });
        toast.success(msg);
        setTimeout(() => { fetchOffer(); fetchSubscription(); fetchBalance(); }, 3000);
      } else {
        setTxStatus({ state: 'error', msg: pollResult.result || 'Transaction failed' });
        toast.error(pollResult.result || 'Purchase failed');
      }
    } catch (err) {
      setTxStatus({ state: 'error', msg: err.message });
      toast.error(err.message || 'Purchase failed');
    } finally {
      setProcessing(false);
    }
  };

  // Top up prepaid balance (with auto-deposit if needed)
  const handleTopUp = async () => {
    if (!loggedIn || !isActive || processing) return;
    const amount = parseFloat(topUpAmount);
    if (!amount || amount <= 0) {
      toast.error('Enter a valid amount');
      return;
    }

    // For top-ups the contract balance is already locked (active sub), so
    // only check L2 balance → L1 deposit for the gap.
    const l2Balance = vscBalances[subAsset.toLowerCase()] || 0;
    const depositNeeded = l2Balance < amount
      ? Math.ceil((amount - l2Balance) * 1000) / 1000
      : 0;

    setProcessing(true);
    setTxStatus({
      state: 'broadcasting',
      msg: depositNeeded > 0
        ? `Depositing ${depositNeeded.toFixed(3)} ${subAssetUpper} to VSC and topping up…`
        : 'Approve the top-up in your wallet…',
    });

    try {
      const intent = buildTransferIntent(amount.toFixed(3), subAsset);
      const payload = `${SUB_OFFER_ID}|${currentInterval}`;
      let result;

      if (depositNeeded > 0) {
        result = await depositAndCallContract(
          depositNeeded.toFixed(3), subAsset, user, 'pay_offer', payload, [intent]
        );
      } else {
        result = await callSubsContract('pay_offer', payload, [intent]);
      }

      const pollResult = await pollWithProgress(result.result);

      if (pollResult.status === 'success') {
        setTxStatus({ state: 'done', msg: 'Balance topped up!' });
        toast.success('Balance topped up!');
        setTopUpAmount('');
        setTimeout(() => { fetchOffer(); fetchSubscription(); fetchBalance(); }, 3000);
      } else {
        setTxStatus({ state: 'error', msg: pollResult.result || 'Top-up failed' });
        toast.error(pollResult.result || 'Top-up failed');
      }
    } catch (err) {
      setTxStatus({ state: 'error', msg: err.message });
      toast.error(err.message || 'Top-up failed');
    } finally {
      setProcessing(false);
    }
  };

  // Cancel subscription
  const handleCancel = async () => {
    if (!loggedIn || !isActive || processing) return;

    setProcessing(true);
    setTxStatus({ state: 'broadcasting', msg: 'Approve cancellation in your wallet…' });

    try {
      const result = await callSubsContract(
        'cancel_subscription',
        `${SUB_OFFER_ID}`,
        []
      );

      const pollResult = await pollWithProgress(result.result);

      if (pollResult.status === 'success') {
        setTxStatus({ state: 'done', msg: 'Subscription canceled. Prepaid balance refunded.' });
        toast.success('Subscription canceled. Prepaid balance refunded.');
        setTimeout(() => { fetchOffer(); fetchSubscription(); fetchBalance(); }, 3000);
      } else {
        setTxStatus({ state: 'error', msg: pollResult.result || 'Cancellation failed' });
        toast.error(pollResult.result || 'Cancellation failed');
      }
    } catch (err) {
      setTxStatus({ state: 'error', msg: err.message });
      toast.error(err.message || 'Cancellation failed');
    } finally {
      setProcessing(false);
    }
  };

  if (!loggedIn) return null;

  return (
    <div className="tsp-container">
      <div className="tsp-header">
        <div className="tsp-header-text">
          <h2 className="tsp-title">
            <i className="fa-solid fa-crown" /> 3Speak Pro
          </h2>
          <p className="tsp-subtitle">Unlock premium features with a decentralized subscription</p>
        </div>
        {isActive && <span className="tsp-active-badge"><i className="fa-solid fa-check-circle" /> Active</span>}
      </div>

      {/* Magi L2 Balance */}
      {loggedIn && (
        <div className="tsp-l2-balances">
          <span className="tsp-l2-label">Your Magi Balance:</span>
          <span className="tsp-l2-amount">{vscBalances.hive.toFixed(3)} HIVE</span>
          <span className="tsp-l2-sep">·</span>
          <span className="tsp-l2-amount">{vscBalances.hbd.toFixed(3)} HBD</span>
        </div>
      )}

      {loadingOffer ? (
        <div className="tsp-loading">
          <div className="tsp-skeleton" />
          <div className="tsp-skeleton tsp-skeleton-sm" />
        </div>
      ) : !hasAnyOffer ? (
        <div className="tsp-empty">
          Subscription service is not available yet. Check back soon.
        </div>
      ) : (
        <>
          {/* Active one-time purchase */}
          {onetimeIsActive && onetimePurchase && (
            <div className="tsp-onetime-active">
              <div className="tsp-onetime-header">
                <i className="fa-solid fa-bolt" />
                <span>One-Time Access Active</span>
              </div>
              <div className="tsp-onetime-details">
                <div className="tsp-onetime-timer">
                  <i className="fa-regular fa-clock" />
                  <span>
                    {onetimeTimeLeft > 3600000
                      ? `${Math.floor(onetimeTimeLeft / 3600000)}h ${Math.floor((onetimeTimeLeft % 3600000) / 60000)}m remaining`
                      : onetimeTimeLeft > 60000
                        ? `${Math.floor(onetimeTimeLeft / 60000)}m remaining`
                        : 'Expiring soon'}
                  </span>
                </div>
                <div className="tsp-onetime-expires">
                  Expires {onetimeExpiresAt.toLocaleString()}
                </div>
              </div>
            </div>
          )}

          {/* Expired one-time purchase */}
          {onetimePurchase && !onetimeIsActive && (
            <div className="tsp-onetime-expired">
              <i className="fa-solid fa-clock-rotate-left" />
              <span>Your last one-time access expired on {onetimeExpiresAt?.toLocaleString()}</span>
            </div>
          )}

          {/* Active subscription info */}
          {isActive && subscription && (
            <div className="tsp-status">
              <div className="tsp-status-grid">
                <div className="tsp-status-item">
                  <span className="tsp-status-label">Plan</span>
                  <span className="tsp-status-value">{INTERVAL_LABELS[currentInterval] || currentInterval}</span>
                </div>
                <div className="tsp-status-item">
                  <span className="tsp-status-label">Prepaid Balance</span>
                  <span className="tsp-status-value tsp-balance">{currentBalance.toFixed(3)} {subAssetUpper}</span>
                </div>
                <div className="tsp-status-item">
                  <span className="tsp-status-label">Next Billing</span>
                  <span className="tsp-status-value">{nextBilling ? nextBilling.toLocaleDateString() : '—'}</span>
                </div>
                <div className="tsp-status-item">
                  <span className="tsp-status-label">Interval Price</span>
                  <span className="tsp-status-value">{intervals[currentInterval]?.toFixed(3) || '—'} {subAssetUpper}</span>
                </div>
              </div>

              {/* Top up */}
              <div className="tsp-topup">
                <label className="tsp-topup-label">Add funds to your prepaid balance</label>
                <div className="tsp-topup-row">
                  <input
                    type="number"
                    className="tsp-topup-input"
                    value={topUpAmount}
                    onChange={(e) => setTopUpAmount(e.target.value)}
                    placeholder={`Amount in ${subAssetUpper}`}
                    min="0.001"
                    step="0.001"
                    disabled={processing}
                  />
                  <button
                    className="tsp-topup-btn"
                    onClick={handleTopUp}
                    disabled={processing || !topUpAmount || parseFloat(topUpAmount) <= 0}
                  >
                    {processing ? <i className="fa-solid fa-spinner fa-spin" /> : <i className="fa-solid fa-plus" />}
                    Top Up
                  </button>
                </div>
              </div>

              {/* Cancel */}
              <button
                className="tsp-cancel-btn"
                onClick={handleCancel}
                disabled={processing}
              >
                <i className="fa-solid fa-xmark" /> Cancel Subscription
              </button>
            </div>
          )}

          {/* Plan selection (disabled when any offer is active) */}
          <div className={`tsp-plans${isActive || onetimeIsActive ? ' tsp-plans-disabled' : ''}`}>
            <p className="tsp-plans-label">Choose your plan:</p>
            <div className="tsp-plan-cards">
              {/* One-time offer — shown first */}
              {onetimeOffer && onetimeOffer.state === 'active' && (
                <div
                  className={`tsp-plan-card tsp-plan-onetime${selectedPlan === 'onetime' ? ' selected' : ''}`}
                  onClick={isActive || onetimeIsActive ? undefined : () => setSelectedPlan('onetime')}
                >
                  <span className="tsp-plan-name">One Time</span>
                  <span className="tsp-plan-price">{onetimePrice.toFixed(3)} {onetimeAssetUpper}</span>
                  {onetimeOffer.description && <span className="tsp-plan-desc">{onetimeOffer.description}</span>}
                </div>
              )}

              {/* Subscription intervals */}
              {Object.entries(intervals).map(([interval, price]) => (
                <div
                  key={interval}
                  className={`tsp-plan-card${selectedPlan === interval ? ' selected' : ''}`}
                  onClick={isActive || onetimeIsActive ? undefined : () => setSelectedPlan(interval)}
                >
                  {interval === 'yearly' && <span className="tsp-plan-badge">Save 2 months</span>}
                  <span className="tsp-plan-name">{INTERVAL_LABELS[interval] || interval}</span>
                  <span className="tsp-plan-price">{price.toFixed(3)} {subAssetUpper}</span>
                  {subOffer.description && <span className="tsp-plan-desc">{subOffer.description}</span>}
                </div>
              ))}
            </div>

            <button
              className="tsp-subscribe-btn"
              onClick={handlePurchase}
              disabled={processing || !selectedPlan || isActive || onetimeIsActive}
            >
              {processing ? (
                <><i className="fa-solid fa-spinner fa-spin" /> Processing…</>
              ) : selectedPlan === 'onetime' ? (
                <><i className="fa-solid fa-bolt" /> Buy 3Speak Pro</>
              ) : (
                <><i className="fa-solid fa-crown" /> Subscribe to 3Speak Pro</>
              )}
            </button>
          </div>

          {/* Transaction status */}
          {txStatus && (
            <div className={`tsp-tx-status tsp-tx-${txStatus.state}`}>
              {txStatus.state === 'broadcasting' && <i className="fa-solid fa-wallet" />}
              {txStatus.state === 'polling' && <i className="fa-solid fa-spinner fa-spin" />}
              {txStatus.state === 'done' && <i className="fa-solid fa-check-circle" />}
              {txStatus.state === 'error' && <i className="fa-solid fa-exclamation-circle" />}
              <span>{txStatus.msg}</span>
              {(txStatus.state === 'done' || txStatus.state === 'error') && (
                <button className="tsp-tx-dismiss" onClick={() => setTxStatus(null)}>
                  <i className="fa-solid fa-xmark" />
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default ThreeSpeakPro;
