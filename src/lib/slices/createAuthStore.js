import axios from "axios";
import { api } from "../../utils/api";
import { API_URL_FROM_WEST } from "../../utils/config";
import {persist} from "zustand/middleware"

const LOCAL_STORAGE_USER_ID_KEY = "user_id";

export const createAuthUserSlice = (set) => ({
  authenticated: false,
  userId: null,
  user: null,
  listAccounts: [],
  allowAccess: null,
  userDetails: null,



  // Initialize the store on app load
  initializeAuth: () => {
    if (typeof window !== "undefined") {
      const userId = window.localStorage.getItem(LOCAL_STORAGE_USER_ID_KEY);
      const accessToken = window.localStorage.getItem("access_token");
      if (accessToken && userId) {
        set({ authenticated: true, userId });
      } else {
        set({ authenticated: false });
      }
    }
  },

  setActiveUser: async () => {
    const accounts = localStorage.getItem("user_id");
    if (accounts) {
      set({ user: accounts });
      // console.log("im from setAccounts now", user);
    }
  },

  LogOut: ()=>{
      if (typeof window !== "undefined") {
        // Clear local storage
        window.localStorage.removeItem(LOCAL_STORAGE_USER_ID_KEY);
        window.localStorage.removeItem("access_token");
    
        // Reset authentication state in the store
        set({
          authenticated: false,
          userId: null,
          allowAccess: null,
          userDetails: null,
          listAccounts: [],
        });
    
        console.log("User has been logged out successfully.");
      }
  },

  // Set accounts from localStorage
  setAccounts: async () => {
    const accounts = localStorage.getItem("accountsList");
    if (accounts) {
      const toAppendAccounts = JSON.parse(accounts);
      set({ listAccounts: toAppendAccounts });
      console.log("im from setAccounts now", toAppendAccounts);
    }
  },

  // Check authentication using a token
  checkAuth: async () => {
    const token = localStorage.getItem("access_token");
    if (token) {
      const data = await api.auth.checkAuthentication(token);
      if (data) {
        console.log("checkAuthentication", data);
        set({ allowAccess: data, authenticated: true });
      }
    } else {
      set({ allowAccess: false, authenticated: false });
    }
  },

  // Get user details using a token
  getUserDetails: async () => {
    const token = localStorage.getItem("access_token");
    if (token) {
      const data = await api.auth.getUserDetails(token);
      if (data) {
        const account = { username: data };
        set({ userDetails: account });
      }
    } else {
      set({ userDetails: null });
    }
  },

  // Login using Hive Keychain
  login_with_hive: async (request) => {
    try {
      const keychain = window.hive_keychain;
      console.log("keychain", keychain);

      const proof_payload = {
        account: request.username,
        ts: request.dateNow,
      };

      keychain.requestSignBuffer(
        request.username,
        JSON.stringify(proof_payload),
        "Posting",
        request.callback,
        null,
        "Login using Hive",
        (response) => {
          console.log("response", response);
        }
      );
    } catch (error) {
      console.log({ error });
    }
  },

  // Login with email and password
  login: async (requestBody) => {
    const data = {
      username: requestBody.email,
      password: requestBody.password,
    };

    const response = await axios.post(
      `${API_URL_FROM_WEST}/v1/auth/login`,
      data,
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    console.log("response", response);
    localStorage.setItem("access_token", response.data.access_token);
    set({ authenticated: true, userId: response.data.user_id });
    return response;
  },

  // Register a new user
  register: async (requestBody) => {
    const body = {
      ...requestBody,
      username: requestBody.email,
    };

    const response = await axios.post(
      `${API_URL_FROM_WEST}/v1/auth/register`,
      body,
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    return response;
  },

  
});
