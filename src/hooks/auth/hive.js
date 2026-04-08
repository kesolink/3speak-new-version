import { Aioha, KeyTypes, Providers } from "@aioha/aioha";
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
      .then((res) => {
        if (res.success) {
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
