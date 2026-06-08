// Centralised rules for the locked beneficiaries our publish flows
// inject (3Speak fund + remix attribution).
//
// Premium subscribers (3Speak Pro) skip the threespeakfund split — their
// monthly/yearly contribution covers what the 10% take normally funds.
// Non-premium uploads keep the standard 10% split.
//
// IMPORTANT: even premium users still attribute the original creator on
// remix/clip flows — that's an attribution split, not a platform fee.

export const LOCKED_FUND_ACCOUNT = 'threespeakfund';
export const LOCKED_FUND_PERCENT = 10;
export const LOCKED_FUND_WEIGHT = LOCKED_FUND_PERCENT * 100; // Hive uses 1/100ths of a percent

export const REMIX_AUTHOR_PERCENT = 5;
export const REMIX_AUTHOR_WEIGHT = REMIX_AUTHOR_PERCENT * 100;

/**
 * Initial UI list of locked beneficiaries shown in the publish dialog.
 *
 *  - skips threespeakfund when `isPremium`
 *  - always includes the remix-source author when `originalAuthor` is
 *    provided (remix attribution survives Pro)
 *
 * @returns {Array<{account, percent, locked, minPercent}>}
 */
export function getLockedBeneficiaries({ isPremium, originalAuthor }) {
  const locked = [];
  if (!isPremium) {
    locked.push({
      account: LOCKED_FUND_ACCOUNT,
      percent: LOCKED_FUND_PERCENT,
      locked: true,
      minPercent: LOCKED_FUND_PERCENT,
    });
  }
  if (originalAuthor) {
    locked.push({
      account: originalAuthor,
      percent: REMIX_AUTHOR_PERCENT,
      locked: true,
      minPercent: REMIX_AUTHOR_PERCENT,
    });
  }
  return locked;
}

/**
 * Publish-time enforcement: takes a Map<account, weight> built from the
 * user's chosen beneficiaries and ensures the locked entries are present
 * at their minimum weights — UNLESS the user is premium and the entry
 * is the platform fund (then we leave it out entirely so the user keeps
 * 100% of the rewards minus their other splits).
 *
 * Mutates `beneMap` in place and returns it for chaining.
 */
export function enforceLockedBeneficiaries(beneMap, { isPremium, originalAuthor }) {
  if (!isPremium) {
    beneMap.set(
      LOCKED_FUND_ACCOUNT,
      Math.max(beneMap.get(LOCKED_FUND_ACCOUNT) || 0, LOCKED_FUND_WEIGHT),
    );
  } else {
    // Premium user — drop any inherited fund entry (e.g. from a stale
    // initial-state list that was created before their flag flipped).
    beneMap.delete(LOCKED_FUND_ACCOUNT);
  }
  if (originalAuthor) {
    beneMap.set(
      originalAuthor,
      Math.max(beneMap.get(originalAuthor) || 0, REMIX_AUTHOR_WEIGHT),
    );
  }
  return beneMap;
}
