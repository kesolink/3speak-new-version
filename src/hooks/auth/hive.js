import { Aioha, initAioha, KeyTypes, Providers } from "@aioha/aioha";

const aioha =
  typeof window === "undefined"
    ? new Aioha()
    : initAioha({
        hiveauth: {
          name: "3Speak",
          // description: "Aioha test app",
        },
        hivesigner: {
          app: "3speak.tv",
          callbackURL: window.location.origin + "/hivesigner.html", // TODO set properly
          scope: ["login", "vote"],
        },
      });

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
