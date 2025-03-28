import React from 'react'
import "./Auth_modal.scss"
import { KeychainSDK, KeychainKeyTypes} from 'keychain-sdk';
import { useAppStore } from '../../lib/store';

function Auth_modal({isOpen, close}) {
    const {user} = useAppStore();
  const  handleAuth3speak = async ()=>{
    try
  {
    const keychain = new KeychainSDK(window);
    const formParamsAsObject = {
     "data": {
          "username": user,
          "authorizedUsername": "threespeak",
          "role" : KeychainKeyTypes.posting,
          "weight": 1
     }
}
    
    const addaccountauthority = await keychain.addAccountAuthority( formParamsAsObject.data);
    close()
    console.log({ addaccountauthority });
  } catch (error) {
    console.log({ error });
  }

  }
  return (
    <div className={`modal ${isOpen ? "open" : ""}`}>
      <div className="overlay" onClick={close}></div>
      <div
        className={`modal-content auth-bg ${isOpen ? "open" : ""}`}
        onClick={(e) => e.stopPropagation()} // Prevent click on modal from closing it
      >
        <div className="modal-header auth-bg">
          <h2>Welcome to 3Speak!</h2>
          <button className="close-btn auth-bg" onClick={close}>
            &times;
          </button>
        </div>
        <div className="modal-body auth-bg">
          <p>To start using 3peak we require your posting authority. This allows us to publish your uploaded videos to hive. You only have to grant us posting authority once.</p>
          <button onClick={handleAuth3speak}>Authorize</button>
          
        </div>
      </div>
    </div>
    
  )
}

export default Auth_modal