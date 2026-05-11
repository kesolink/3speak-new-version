// User-facing labels and instructions for each Aioha provider.
//
// Used by any UI that's blocking on a signature/broadcast — e.g. the
// OpenPods "Connecting…" screen — so the user knows which wallet to
// look at and what they're being asked to do.

import { Providers } from '@aioha/aioha';

const PROVIDER_LABELS = {
  [Providers.Keychain]:     'Hive Keychain',
  [Providers.HiveAuth]:     'HiveAuth',
  [Providers.HiveSigner]:   'HiveSigner',
  [Providers.PeakVault]:    'PeakVault',
  [Providers.Ledger]:       'Ledger',
  [Providers.MetaMaskSnap]: 'MetaMask Snap',
  [Providers.ViewOnly]:     'View-only',
  [Providers.Custom]:       'Custom',
};

const PROVIDER_SIGN_VERBS = {
  [Providers.Keychain]:     'Confirm',
  [Providers.HiveAuth]:     'Acknowledge',
  [Providers.PeakVault]:    'Approve',
  [Providers.Ledger]:       'Confirm',
  [Providers.MetaMaskSnap]: 'Approve',
};

export function friendlyProviderName(provider) {
  if (!provider) return null;
  return PROVIDER_LABELS[provider] ?? provider;
}

export function providerSignPrompt(provider) {
  if (!provider) return 'Waiting for your wallet to sign…';
  // HiveSigner cannot sign arbitrary messages — call it out directly.
  if (provider === Providers.HiveSigner) {
    return "HiveSigner can't sign hangouts requests — please switch to another wallet";
  }
  const verb = PROVIDER_SIGN_VERBS[provider] ?? 'Confirm';
  const name = PROVIDER_LABELS[provider] ?? provider;
  return `${verb} the signing request via ${name}`;
}
