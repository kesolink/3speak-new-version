import { Client, PrivateKey } from "@hiveio/dhive";

const client = new Client(["https://api.hive.blog"]); // Use a Hive RPC node

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
