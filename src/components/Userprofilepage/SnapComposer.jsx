import { useState } from 'react';
import { toast } from 'sonner';
import { MdPeopleAlt, MdClose } from 'react-icons/md';
import MarkdownComposer from '../studio/MarkdownComposer';
import { useAppStore } from '../../lib/store';
import { publishSnap } from '../../lib/snaps';

/**
 * Owner-only composer for a written "snap" — same fields as the shorts description
 * tab (body via MarkdownComposer, tags, rewards distribution, beneficiaries, NSFW),
 * minus the video-only "Allow Remix/Clip". Publishes under @peak.snaps and calls
 * onPosted(snap) with an optimistic snap object so the list can show it immediately.
 */
export default function SnapComposer({ onPosted }) {
  const user = useAppStore((s) => s.user);

  const [body, setBody] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [rewards, setRewards] = useState('default');
  const [nsfw, setNsfw] = useState(false);
  const [beneficiaries, setBeneficiaries] = useState([]); // { account, weight } (weight: 10000 = 100%)
  const [benAccount, setBenAccount] = useState('');
  const [benPercent, setBenPercent] = useState('');
  const [showOptions, setShowOptions] = useState(false);
  const [posting, setPosting] = useState(false);

  const totalBenWeight = beneficiaries.reduce((s, b) => s + Number(b.weight || 0), 0);

  const addBeneficiary = () => {
    const account = benAccount.toLowerCase().replace(/^@/, '').trim();
    const pct = Math.round(Number(benPercent) * 100); // percent → weight
    if (!account) { toast.error('Enter an account'); return; }
    if (!pct || pct <= 0) { toast.error('Enter a percent above 0'); return; }
    if (beneficiaries.some((b) => b.account === account)) { toast.error('Already added'); return; }
    if (totalBenWeight + pct > 10000) { toast.error('Beneficiaries can’t exceed 100%'); return; }
    setBeneficiaries([...beneficiaries, { account, weight: pct }]);
    setBenAccount('');
    setBenPercent('');
  };
  const removeBeneficiary = (account) => setBeneficiaries(beneficiaries.filter((b) => b.account !== account));

  const handlePost = async () => {
    if (!user) { toast.error('Please log in'); return; }
    const text = body.trim();
    if (!text) { toast.error('Write something first'); return; }

    const tags = tagsInput.split(/[\s,]+/).map((t) => t.replace(/^#/, '')).filter(Boolean);
    setPosting(true);
    try {
      const res = await publishSnap({ user, body: text, tags, rewards, beneficiaries, nsfw });
      toast.success('Snap posted!');
      const snap = res.indexed || {
        _id: `${user}/${res.permlink}`,
        owner: user,
        permlink: res.permlink,
        title: '',
        body: text,
        tags,
        nsfw,
        created: new Date().toISOString(),
      };
      // reset
      setBody(''); setTagsInput(''); setRewards('default'); setNsfw(false);
      setBeneficiaries([]); setShowOptions(false);
      onPosted?.(snap);
    } catch (e) {
      toast.error(e?.message || 'Could not post the snap');
    } finally {
      setPosting(false);
    }
  };

  if (!user) return null;

  return (
    <div className="snap-composer">
      <MarkdownComposer
        value={body}
        onChange={setBody}
        placeholder="Share an update with your followers…"
      />

      <div className="snap-composer-row">
        <input
          className="snap-tags-input"
          placeholder="tags (space separated)"
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
        />
        <button type="button" className="snap-options-toggle" onClick={() => setShowOptions((v) => !v)}>
          {showOptions ? 'Hide options' : 'More options'}
        </button>
      </div>

      {showOptions && (
        <div className="snap-options">
          <label className="snap-field">
            <span className="snap-field-label">Rewards Distribution</span>
            <select value={rewards} onChange={(e) => setRewards(e.target.value)}>
              <option value="default">Default 50% / 50%</option>
              <option value="powerup">Power up 100%</option>
              <option value="decline">Decline payout</option>
            </select>
          </label>

          <div className="snap-field">
            <span className="snap-field-label">Beneficiaries</span>
            <div className="snap-benefic-add">
              <input
                placeholder="account"
                value={benAccount}
                onChange={(e) => setBenAccount(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addBeneficiary(); } }}
              />
              <input
                type="number" min="1" max="100" placeholder="%"
                value={benPercent}
                onChange={(e) => setBenPercent(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addBeneficiary(); } }}
              />
              <button type="button" onClick={addBeneficiary}><MdPeopleAlt /> Add</button>
            </div>
            {beneficiaries.length > 0 && (
              <ul className="snap-benefic-list">
                {beneficiaries.map((b) => (
                  <li key={b.account}>
                    <span>@{b.account} — {Math.round(b.weight / 100)}%</span>
                    <button type="button" onClick={() => removeBeneficiary(b.account)} aria-label="Remove"><MdClose /></button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <label className="snap-toggle">
            <input type="checkbox" checked={nsfw} onChange={(e) => setNsfw(e.target.checked)} />
            <span>Mark as adult / NSFW</span>
          </label>
        </div>
      )}

      <div className="snap-composer-actions">
        <button type="button" className="snap-post-btn" disabled={posting || !body.trim()} onClick={handlePost}>
          {posting ? 'Posting…' : 'Post snap'}
        </button>
      </div>
    </div>
  );
}
