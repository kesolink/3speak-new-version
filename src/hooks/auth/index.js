import { create } from "zustand";
import { hive } from "../auth/hive";
import { api, setAuthorization } from "../auth/api";
import {
  LOCAL_STORAGE_ACCESS_TOKEN_KEY,
  LOCAL_STORAGE_USER_ID_KEY,
  LOCAL_STORAGE_DID_ENTROPY_KEY,
  LOCAL_STORAGE_DID_PUBLIC_KEY_KEY,
} from "./../localStorageKeys";
// import { useAppStore } from "../../lib/store";



// const AuthStore = create(() => {
  
//   if (typeof window === "undefined") {
//     return {
//       authenticated: false,
//     };
//   } else {
//     const userId = window.localStorage.getItem(LOCAL_STORAGE_USER_ID_KEY);
//     if (userId) {
//       return {
//         authenticated: true,
//         userId,
//       };
//     }
//     return {
//       authenticated: false,
//     };
//   }
// });



// const AuthStore = create(() => {
//   if (typeof window === "undefined") {
//     return {
//       authenticated: false,
//     };
//   } else {
//     const userId = window.localStorage.getItem(LOCAL_STORAGE_USER_ID_KEY);
//     // const { checkAuth } = useAppStore.getState(); // 👈 Call `useAppStore` properly
//     if (userId) {
//       // checkAuth(); // 👈 Call checkAuth only after it is properly loaded
//       return {
//         authenticated: true,
//         userId,
//       };
//     }
//     return {
//       authenticated: false,
//     };
//   }
// });


// export const useAuth = AuthStore;

const authenticators = {
  Hive: hive,
};

const requestLogin = async ({ request, userId }) => {
  request.data = JSON.stringify(request.data);
  console.log(request)
  const res = await api.request(request);
  const { access_token } = res.data;
  console.log("auth data", res.data);
  setAuthorization(access_token);
  window.localStorage.setItem(LOCAL_STORAGE_ACCESS_TOKEN_KEY, access_token);
  window.localStorage.setItem(LOCAL_STORAGE_USER_ID_KEY, userId);
  // AuthStore.setState(
  //   {
  //     authenticated: true,
  //     userId,
  //   },
  //   true
  // );
};

export const AuthActions = {
  login(method, ...args) {
    return authenticators[method]
      .login(...args)
      .then(requestLogin);
  },
  logout() {
    window.localStorage.removeItem(LOCAL_STORAGE_ACCESS_TOKEN_KEY);
    window.localStorage.removeItem(LOCAL_STORAGE_USER_ID_KEY);
    for (const authenticator of Object.values(authenticators)) {
      authenticator.logout();
    }
  },
};
