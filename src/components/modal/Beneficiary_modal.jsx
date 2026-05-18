import React, { useEffect, useState } from 'react';
import { getHiveClient } from '../../utils/hiveNode';
import './Beneficiary_modal.scss';
import { MdDeleteForever } from 'react-icons/md';

import { Client } from '@hiveio/dhive';
import { useAppStore } from '../../lib/store';
import { usePremiumStatus } from '../../hooks/usePremiumStatus';
import { HIVE_API_NODES } from '../../utils/config';

const client = getHiveClient();

// `variant` distinguishes the publish flow:
//   'studio' — keeps the 1% Video-Encoding split even for Pro users
//   'embed'  — no platform splits at all for Pro users
function Beneficiary_modal({ isOpen, close, setBeneficiaries, setBeneficiaryList, setList, list, remaingPercent, setRemaingPercent, variant = 'studio' }) {
  const {user} = useAppStore();
  const isPremium = !!usePremiumStatus(user)?.premium;
  const [account, setAccount] = useState('');
  const [percent, setPercent] = useState(0);
  const [error, setError] = useState('');


  useEffect(() => {
  setBeneficiaryList(prev => prev + list.length);
}, [list]);

  



  async function isAccountValid(username) {
    try {
      const accounts = await client.database.getAccounts([username]);
      return accounts.length > 0;
    } catch (error) {
      console.error('Error fetching account:', error);
      return false;
    }
  }

  const handleBeneficairy = async () => {

    

    if (account.trim() === '') {
        setError('Username cannot be empty.');
        return;
      }
      if (account ===  user){
        setError("Beneficiary can't be set to same user" )
        return;
      }
    
      if (percent <= 0) {
        setError('Reward percentage must be greater than 0.');
        return;
      }
    
      if (percent > remaingPercent) {
        setError(`Reward percentage exceeds remaining allocation of ${remaingPercent}%.`);
        return;
      }
    if (percent < 1) return
    if (percent === "") {
      setError("Enter a valid number")
      return;
    }
    if (!percent || isNaN(percent)) {
      setError("Enter a valid reward percent.");
      return;
    }

    setError('');

    


    // Check if the account already exists in the list
    const isDuplicate = list.some((item) => item.account === account.trim());
    if (isDuplicate) {
      setError('This account is already added to the list.');
      return;
    }

    // Validate account
    const isValid = await isAccountValid(account);
    if (!isValid) {
      setError('Invalid username or community ID.');
      return;
    }

    setError('');

    const total = remaingPercent- percent
    setRemaingPercent(total)

    if (percent > remaingPercent) {
      setError(`Reward percentage exceeds remaining allocation of ${remaingPercent}%.`);
      return;
    }

  setError('');

    // Add new beneficiary
    const newItem = { account, percent: parseFloat(percent) };
    setList([...list, newItem]);

    // Clear inputs
    setAccount('');
    setPercent(0);
  };

  const handleDelete = (index) => {
  if (list[index].locked) return; // locked items cannot be deleted
  const deletedPercent = list[index].percent; // get the percent of the item being deleted
  const updatedList = list.filter((_, i) => i !== index); // remove the item
  setList(updatedList);
  setRemaingPercent((prev) => prev + deletedPercent); // add back the deleted percent
};

  const handleLockedPercentChange = (index, newPercent) => {
    const item = list[index];
    if (!item.locked) return;
    const minP = item.minPercent || 1;
    const value = Math.max(minP, parseFloat(newPercent) || minP);
    const diff = value - item.percent;
    if (diff > remaingPercent) {
      setError(`Cannot increase beyond remaining ${remaingPercent}%`);
      return;
    }
    setError('');
    const updatedList = list.map((it, i) => i === index ? { ...it, percent: value } : it);
    setList(updatedList);
    setRemaingPercent(prev => prev - diff);
  };

  const handleSave = () => {
    // Map the list to the required format
    const beneficiaries = list.map((item) => ({
      account: item.account,
      weight: Math.round(item.percent * 100), // Convert percent to weight
    }));

    // Convert to the required string format
    const beneficiariesString = JSON.stringify(beneficiaries);

    
    setBeneficiaries(beneficiariesString); // Set the formatted string to the parent component
    close(); // Close the modal after saving
  };

  return (
    <div className={`modal ${isOpen ? 'open' : ''}`}>
      <div className="overlay" onClick={close}></div>
      <div
        className={`modal-content video-upload-moadal-size bene ${
          isOpen ? 'open' : ''
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>Beneficiaries</h2>
          <button className="close-btn" onClick={close}>
            &times;
          </button>
        </div>

        <p className="bene-text">
          Add a user you want to automatically receive a portion of the rewards
          for this post.
        </p>

        {error && <span className="error">{error}</span>}

        <div className="bene-content-wrap">
          <div className="user-wrap">
            <span>{user}</span> <span>{remaingPercent}%</span>
          </div>

          {/* Render the beneficiary list */}
          <div className="beneficiary-list">
            {list.map((item, index) => (
              <div className="wrap" key={index}>
                <span>@{item.account}</span>
                {item.locked ? (
                  <>
                    <input
                      type="number"
                      value={item.percent}
                      min={item.minPercent || 1}
                      step="1"
                      style={{ width: '50px', textAlign: 'center' }}
                      onChange={(e) => handleLockedPercentChange(index, e.target.value)}
                    />
                    <span>% (min {item.minPercent}%)</span>
                  </>
                ) : (
                  <>
                    <span>{item.percent}%</span>
                    <MdDeleteForever
                      className="delete-icon"
                      onClick={() => handleDelete(index)}
                    />
                  </>
                )}
              </div>
            ))}
          </div>

          <div className="reward-main">
            <div className="wrap">
              <label>@</label>
              <input
                type="text"
                value={account}
                placeholder='Enter username'
                onChange={(e) => setAccount(e.target.value.toLowerCase())}
              />
            </div>
            <div className="num-wrap">
              <div className="input-tooltip-wrap">
                <input
                  type="number"
                  value={percent}
                  min="1"
                  step="1"
                  palaceholder="Enter usernmae"
                  onChange={(e) => {
                    const value = parseFloat(e.target.value);

                    if (value < 1) {
                      setPercent(value);
                      setError("Reward percent must be at least 1%");
                    } else {
                      setError("");
                      setPercent(value);
                    }
                  }}
                />

                {percent > 0 && percent < 1 && (
                  <div className="tooltip">
                    Minimum reward is <strong>1%</strong>
                  </div>
                )}
              </div>

              <span>%</span>
              <button onClick={handleBeneficairy} className="green">+</button>
            </div>

          </div>

          {/* Render the beneficiary list
          <div className="beneficiary-list">
            {list.map((item, index) => (
              <div className="wrap" key={index}>
                <span>@{item.account}</span>
                <span>{item.percent}%</span>
                <MdDeleteForever
                  className="delete-icon"
                  onClick={() => handleDelete(index)}
                />
              </div>
            ))}
          </div> */}

          <div className="last-btn-wrap">
            {/* <button onClick={close}>Cancel</button> */}
            <button onClick={handleSave}>Continue</button>
          </div>

          {(() => {
            if (list.some(item => item.locked)) return null;
            // Pro users skip the 10% threespeakfund split entirely. The 1%
            // encoder split is kept for /studio uploads (3Speak encodes
            // them) but not for /embed (external media, no encoding).
            const entries = [];
            if (!isPremium) {
              entries.push(<div key="fund" className="wrap"><span>threespeakfund</span> <span>10% === Infrastructure</span></div>);
            }
            const keepEncoder = variant === 'studio' ? true : !isPremium;
            if (keepEncoder) {
              entries.push(<div key="enc" className="wrap"><span> Video Encoding === 1%</span></div>);
            }
            if (entries.length === 0) return null;
            return (
              <div className="default-bene-wrap">
                <p>Default Beneficiaries ({entries.length})</p>
                {entries}
              </div>
            );
          })()}

        </div>
      </div>
    </div>
  );
}

export default Beneficiary_modal;
