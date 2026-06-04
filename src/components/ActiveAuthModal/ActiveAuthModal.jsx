import { useEffect, useRef, useState } from 'react';
import { getHiveClient } from '../../utils/hiveNode';
import { createPortal } from 'react-dom';
import { Client, PrivateKey } from '@hiveio/dhive';
import { KeyTypes, Providers } from '@aioha/aioha';
import { IoClose } from 'react-icons/io5';
import aioha, { setActiveAuthHandler } from '../../hive-api/aioha';
import { HIVE_API_NODES } from '../../utils/config';
import './ActiveAuthModal.scss';

const client = getHiveClient();

// Human-readable summary of what the user is about to sign.
function describeOps(operations) {
  try {
    return operations.map(([name, payload]) => {
      if (name === 'transfer') {
        return `Transfer ${payload.amount} to @${payload.to}${payload.memo ? ` — "${payload.memo}"` : ''}`;
      }
      if (name === 'transfer_to_vesting') {
        return `Power up ${payload.amount}`;
      }
      if (name === 'custom_json') {
        return `Custom action: ${payload.id}`;
      }
      if (name === 'account_create' || name === 'create_claimed_account') {
        return `Create account @${payload.new_account_name}`;
      }
      return name.replace(/_/g, ' ');
    });
  } catch {
    return ['Active-authority transaction'];
  }
}

/**
 * Active-authority signing modal for Butter Auth sessions.
 *
 * A Butter Auth login only carries POSTING authority, so active-key ops
 * (transfers, tips, 3Speak Pro, power-ups…) can't be signed by the broker.
 * Instead of failing, aioha.js hands the operations here via
 * setActiveAuthHandler(). We explain the situation and let the user finish
 * the signature themselves — with a Hive wallet (the aioha picker), or a
 * pasted private active key (held in memory only for the single broadcast,
 * never stored).
 */
export default function ActiveAuthModal() {
  // { operations, resolve, reject } while a request is in flight, else null
  const pending = useRef(null);
  const [ops, setOps] = useState(null);
  const [method, setMethod] = useState(null); // 'wallet' | 'key'
  const [activeKey, setActiveKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const username = (() => {
    try { return localStorage.getItem('user_id') || ''; } catch { return ''; }
  })();

  // Wallets the aioha instance has registered. We log in with the known
  // username so the user never has to type/confirm their account again.
  const WALLET_LABELS = {
    [Providers.Keychain]: 'Hive Keychain',
    [Providers.PeakVault]: 'PeakVault',
    [Providers.HiveAuth]: 'HiveAuth (mobile app)',
    [Providers.Ledger]: 'Ledger',
    [Providers.HiveSigner]: 'HiveSigner',
  };
  const wallets = Object.keys(WALLET_LABELS).filter((p) => {
    try { return aioha.isProviderRegistered(p); } catch { return false; }
  });

  useEffect(() => {
    setActiveAuthHandler((operations) => {
      return new Promise((resolve, reject) => {
        pending.current = { operations, resolve, reject };
        setOps(operations);
        setMethod(null);
        setActiveKey('');
        setError('');
        setBusy(false);
      });
    });
    return () => setActiveAuthHandler(null);
  }, []);

  function settleResolve(result) {
    const p = pending.current;
    pending.current = null;
    setOps(null);
    if (p) p.resolve({ success: true, result });
  }

  function close() {
    const p = pending.current;
    pending.current = null;
    setOps(null);
    setActiveKey('');
    if (p) p.reject(new Error('Signing cancelled'));
  }

  // Broadcast the pending ops with whatever wallet aioha is now logged into.
  async function signWithAioha() {
    setError('');
    setBusy(true);
    try {
      const res = await aioha.signAndBroadcastTx(pending.current.operations, KeyTypes.Active);
      if (res?.success) {
        settleResolve(res.result);
      } else {
        throw new Error(res?.error || 'The wallet rejected the transaction');
      }
    } catch (e) {
      setError(e.message || 'Wallet signing failed');
      setBusy(false);
    }
  }

  // "Sign with Hive Wallet": reuse the existing aioha session if there is
  // one, otherwise show our own wallet list and log in with the known
  // username (skips aioha's "connect / enter account" step entirely).
  function startWalletSign() {
    setError('');
    if (aioha.isLoggedIn()) {
      signWithAioha();
    } else {
      setMethod('wallet');
    }
  }

  async function loginWithProvider(provider) {
    setError('');
    if (!username) { setError('Could not determine your Hive username. Please log in again.'); return; }
    setBusy(true);
    try {
      const res = await aioha.login(provider, username, {
        msg: 'Authorize active transaction',
        keyType: KeyTypes.Active,
      });
      if (!res?.success) throw new Error(res?.error || 'Could not connect that wallet');
      await signWithAioha();
    } catch (e) {
      setError(e.message || 'Could not connect that wallet');
      setBusy(false);
    }
  }

  async function signWithKey() {
    setError('');
    if (!username) { setError('Could not determine your Hive username. Please log in again.'); return; }
    let key;
    try {
      key = PrivateKey.fromString(activeKey.trim());
    } catch {
      setError('That does not look like a valid private key.');
      return;
    }
    setBusy(true);
    try {
      const [acct] = await client.database.getAccounts([username]);
      if (!acct) throw new Error(`Account @${username} not found on chain.`);
      const pub = key.createPublic().toString();
      const activeKeys = (acct.active?.key_auths || []).map(([k]) => k);
      if (!activeKeys.includes(pub)) {
        throw new Error('That key is not the active key for @' + username + '. (Tip: do not paste your master password or posting key.)');
      }
      const result = await client.broadcast.sendOperations(pending.current.operations, key);
      // Drop the key reference as soon as the broadcast resolves.
      key = null;
      setActiveKey('');
      settleResolve(result);
    } catch (e) {
      setError(e.message || 'Broadcast failed');
      setBusy(false);
    }
  }

  if (!ops) return null;

  return createPortal(
    <div className="aauth-overlay" onClick={busy ? undefined : close}>
      <div className="aauth-content" onClick={(e) => e.stopPropagation()}>
        <button className="aauth-close" onClick={close} disabled={busy} aria-label="Cancel">
          <IoClose size={22} />
        </button>

        <h3 className="aauth-title">Confirm with your Hive wallet</h3>
        <p className="aauth-desc">
          You're signed in with <strong>Butter Auth</strong>, which only grants
          <strong> posting</strong> permission. This action needs your
          <strong> active</strong> authority, so please approve it yourself.
        </p>

        <div className="aauth-ops">
          {describeOps(ops).map((line, i) => (
            <div key={i} className="aauth-op">{line}</div>
          ))}
        </div>

        {error && <div className="aauth-error">{error}</div>}

        {!method && (
          <div className="aauth-choices">
            <button className="aauth-btn primary" onClick={startWalletSign}>
              Sign with Hive Wallet
            </button>
            <button className="aauth-btn" onClick={() => { setError(''); setMethod('key'); }}>
              Sign with a private active key
            </button>
          </div>
        )}

        {method === 'wallet' && (
          <div className="aauth-panel">
            <p className="aauth-hint">
              Connecting as <strong>@{username}</strong>. Pick your wallet — it
              will ask you to approve this transaction.
            </p>
            {wallets.map((p) => (
              <button
                key={p}
                className="aauth-btn"
                disabled={busy}
                onClick={() => loginWithProvider(p)}
              >
                {WALLET_LABELS[p]}
              </button>
            ))}
            {busy && <p className="aauth-hint">Waiting for your wallet…</p>}
            <button className="aauth-link" disabled={busy} onClick={() => setMethod(null)}>
              ← Choose another method
            </button>
          </div>
        )}

        {method === 'key' && (
          <div className="aauth-panel">
            <p className="aauth-hint">
              Paste the <strong>private active key</strong> for @{username}. It's
              used once to sign this transaction and never stored or sent anywhere.
            </p>
            <input
              type="password"
              className="aauth-input"
              autoComplete="off"
              spellCheck={false}
              placeholder="5K… (private active key)"
              value={activeKey}
              onChange={(e) => setActiveKey(e.target.value)}
            />
            <button
              className="aauth-btn primary"
              disabled={busy || !activeKey.trim()}
              onClick={signWithKey}
            >
              {busy ? 'Broadcasting…' : 'Sign & broadcast'}
            </button>
            <button className="aauth-link" disabled={busy} onClick={() => setMethod(null)}>
              ← Choose another method
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
