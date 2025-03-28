// import { keychainBroadcast, addAccountTokeychain } from "../helpers/keychain";
import { Client, PrivateKey } from "@hiveio/dhive";
 const SERVERS = [
    "https://rpc.ecency.com",
    "https://api.deathwing.me",
    "https://api.hive.blog",
    "https://api.openhive.network"
  ];
const client = new Client(SERVERS, {
    timeout: 3000,
    failoverThreshold: 3,
    consoleOnFailover: true
  });
  const bridgeApiCall = (endpoint, params) =>
    client.call("bridge", endpoint, params);



  export const getCommunity = async (name, observer = "") => {
    try {
          const result = await bridgeApiCall("get_community", { name, observer });
          return result;
      } catch (error) {
          console.error(error);
          return null;
      }
  };

  export const isAccountValid = async (username)=>{
    try {
      const accounts = await client.database.getAccounts([username]);
      return accounts.length > 0;
    } catch (error) {
      console.error('Error fetching account:', error);
      return false;
    }
  }


  export const createHiveCommunityKY = async (username, communityName, keys, activeKey) => {
    return new Promise(async (resolve, reject) => {
      const op_name = "account_create";
  
      const owner = {
        weight_threshold: 1,
        account_auths: [],
        key_auths: [[keys.ownerPubkey, 1]]
      };
  
      const active = {
        weight_threshold: 1,
        account_auths: [],
        key_auths: [[keys.activePubkey, 1]]
      };
  
      const posting = {
        weight_threshold: 1,
        account_auths: [["ecency.app", 1]], // Example: granting access to Ecency
        key_auths: [[keys.postingPubkey, 1]]
      };
  
      const params = {
        fee: "3.000 HIVE", // Required fee for account creation
        creator: username, // The existing account creating the new community
        new_account_name: communityName, // The name of the new community
        owner,
        active,
        posting,
        memo_key: keys.memoPubkey,
        json_metadata: "",
        extensions: []
      };
  
      const operation = [op_name, params];
  
      try {
        // Sign and broadcast the transaction using the creator's active key
        const privateKey = PrivateKey.fromString(activeKey);
        const result = await client.broadcast.sendOperations([operation], privateKey);
        
        resolve(result);
      } catch (error) {
        console.log("Error creating community:", error);
        reject(error);
      }
    });
  };

  export const createHiveCommunity = async (username, communityName, keys) => {
    return new Promise(async (resolve, reject) => {
      const op_name = "account_create";
      const memoKey = keys.memo
      const activeKey = keys.active
      const postingKey = keys.posting
      
      const owner = {
        weight_threshold: 1,
        account_auths: [],
        key_auths: [[keys.ownerPubkey, 1]]
      };
      const active = {
        weight_threshold: 1,
        account_auths: [],
        key_auths: [[keys.activePubkey, 1]]
      };
      const posting = {
        weight_threshold: 1,
        account_auths: [["ecency.app", 1]],
        key_auths: [[keys.postingPubkey, 1]]
      };
  
      const ops = [];
      const params = {
        creator: username,
        new_account_name: communityName,
        owner,
        active,
        posting,
        memo_key: keys.memoPubkey,
        json_metadata: "",
        extensions: [],
        fee: "3.000 HIVE"
      };
  
      const operation = [op_name, params];
      ops.push(operation);
  
      try {
        const response = await keychainBroadcast(username, [operation], "Active");
        if (response) {
          resolve(response);
        } else {
          reject("Account creation failed");
        }
      } catch (err) {
        console.log(err);
        reject(err);
      }
  
      try {
        await addAccountTokeychain(communityName, {
          active: activeKey, 
          posting: postingKey,
          memo: memoKey
        })
      } catch (error) {
        console.log(error)
      }
    });
  };

  export const  genCommuninityName = () => {
    return `hive-${Math.floor(Math.random() * 100000) + 100000}`;
  };

  export const getPrivateKeys = (username, password) => {
    const roles = ["owner", "active", "posting", "memo"];
    
    let privKeys = {
      owner: "",
      active: "",
      posting: "",
      memo: "",
      ownerPubkey: "",
      activePubkey: "",
      postingPubkey: "",
      memoPubkey: ""
    };
  
    roles.forEach((role) => {
      privKeys[role] = PrivateKey.fromLogin(username, password, role).toString();
      privKeys[`${role}Pubkey`] = PrivateKey.from(privKeys[role]).createPublic().toString();
    });
  
    return privKeys;
  };

  export const arrayToHex = (array) => {
    return Array.from(array, (byte) => {
      return ('0' + (byte & 0xff).toString(16)).slice(-2);
    }).join('');
  }
  
  export const generatePassword = async (length) => {
    if (typeof window.crypto !== "undefined" && typeof window.crypto.getRandomValues === "function") {
      const randomValues = new Uint8Array(length);
      window.crypto.getRandomValues(randomValues);
      const password = `P${PrivateKey.fromSeed(arrayToHex(randomValues)).toString()}`;
      return password;
    } else {
      throw new Error("crypto.getRandomValues is not supported in this browser.");
    }
  };

  export const createHiveCommunityX = async (user, communityName, communityKeys, userKey) => {
    // Ensure that the userKey is either an Active or Owner key
    if (!userKey) {
      throw new Error("Owner or Active Key is required");
    }
  
    // Use the provided key for authentication
    const response = await keychainBroadcast("custom_json", {
      required_auths: [user], 
      required_posting_auths: [],
      id: "community_create",
      json: JSON.stringify({
        creator: user,
        name: communityName,
        keys: communityKeys,
      }),
    }, userKey); // Use userKey for signing the transaction
  
    return response;
  };
  


//   ***********Keychain***************

export const keychainBroadcast = (account, operations, key, rpc = null) => {
    return new Promise((resolve, reject) => {
      window.hive_keychain?.requestBroadcast(
        account,
        operations,
        key,
        (resp) => {
          if (!resp.success) {
            reject(resp);
          }
          resolve(resp);
        },
        rpc
      );
    });
  };

export const addAccountTokeychain = (username, keys) => new Promise((resolve, reject) => {
  if (window.hive_keychain) {
      window.hive_keychain.requestAddAccount(username, keys, (resp) => {
          if (!resp.success) {
              reject({ message: "Operation cancelled" });
          }
          resolve(resp);
      });
  } else {
      reject({ message: "Hive Keychain not available" });
  }
});