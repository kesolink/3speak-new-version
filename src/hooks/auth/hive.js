import { Aioha, KeyTypes, Providers } from "@aioha/aioha";
import { establishWalletSession } from "../../hive-api/aioha";
import { ENABLE_METAMASK_SNAP } from "../../utils/config";

// Manual Aioha setup — MetaMask Snap only registered when env var is set,
// because it probes window.ethereum which triggers the Phantom wallet
// "Which extension do you want to connect with?" popup.
const buildAioha = () => {
  const a = new Aioha();
  if (typeof window === "undefined") return a;
  a.registerKeychain();
  a.registerLedger();
  a.registerPeakVault();
  if (ENABLE_METAMASK_SNAP) {
    a.registerMetaMaskSnap();
  }
  a.registerHiveAuth({ name: "3Speak" });
  a.registerHiveSigner({
    app: "3speak.tv",
    callbackURL: window.location.origin + "/hivesigner.html",
    scope: ["login", "vote"],
  });
  a.loadAuth();
  return a;
};

const aioha = buildAioha();

function generatePayload(account) {
  const payload = {
    ts: Date.now(),
    account,
  };
  const serializedPayload = JSON.stringify(payload);
  return {
    payload,
    serializedPayload,
  };
}

export const hive = {
  login(provider, username) {
    const { payload, serializedPayload } = generatePayload(username);
    
    // Check if postingKey is provided
    // if (!postingKey) {
    //   return Promise.reject(new Error("Posting key is required for login"));
    // }

    // Log in with the provided postingKey
    return aioha
      .login(provider, username, {
        keyType: KeyTypes.Posting,
        msg: serializedPayload,
      })
      .then(async (res) => {
        if (res.success) {
          // Mint the server session now, while the wallet is already unlocked
          // and the user is expecting prompts.
          //
          // It used to be created only lazily, by the first /api/broadcast that
          // came back 401 — fine for posting or voting, but a viewer who only
          // watches never triggers one. The gate identifies gated-video viewers
          // from that cookie, so a wallet user who had not yet broadcast
          // anything looked anonymous and hit the paywall on a video they were
          // entitled to.
          //
          // Never fatal: a declined signature still leaves the user logged in,
          // and the lazy path remains as the fallback. No-ops for HiveSigner
          // and ManteAuth, which carry their own server auth.
          try {
            await establishWalletSession();
          } catch (err) {
            console.warn("[auth] wallet session not established at login:", err?.message || err);
          }
          const reqBody = {
            proof_payload: payload,
            proof: res.result,
          };
          return {
            request: {
              method: "POST",
              data: reqBody,
              url: "/v1/auth/login/singleton/hive",
            },
            userId: username,
          };
        }
        throw new Error(res.error);
      });
  },
  logout() {
    return aioha.logout();
  },
};
