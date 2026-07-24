import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAppStore } from '../../lib/store';
import { fetchUserInterests, saveInterestsToHive } from '../../utils/interests';
import { refreshHomeFeeds } from '../../utils/feedSeed';
import TagsV2Picker from '../tooltip/TagsV2Picker';
import './InterestsPrompt.scss';

// Per-user "already asked" flag (browser storage) so a given account is prompted
// at most once — set when they save a selection OR dismiss the prompt.
const PROMPTED_KEY = '3speak_interests_prompted';
const loadPrompted = () => {
  try { return JSON.parse(localStorage.getItem(PROMPTED_KEY) || '[]'); } catch { return []; }
};
const wasPrompted = (username) => loadPrompted().includes(username);
const markPrompted = (username) => {
  try {
    const set = new Set(loadPrompted());
    set.add(username);
    localStorage.setItem(PROMPTED_KEY, JSON.stringify([...set]));
  } catch { /* ignore storage errors */ }
};

/**
 * One-time, kind nudge for logged-in users who haven't set any interests yet.
 * Mounted once at the app root. Shows at most once per account per browser.
 */
export default function InterestsPrompt() {
  const user = useAppStore((s) => s.user);
  const authenticated = useAppStore((s) => s.authenticated);
  const setInterests = useAppStore((s) => s.setInterests);
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authenticated || !user || wasPrompted(user)) return;
    let alive = true;
    // Small delay so we don't collide with the login flow / other modals.
    const t = setTimeout(async () => {
      const server = await fetchUserInterests(user);
      if (!alive) return;
      if (server == null) return;      // couldn't read Hive — try again next session
      if (server.length > 0) {         // already has interests — remember + don't ask
        setInterests(server);
        markPrompted(user);
        return;
      }
      setSelected([]);
      setOpen(true);
    }, 1200);
    return () => { alive = false; clearTimeout(t); };
  }, [authenticated, user]);

  if (!open) return null;

  const dismiss = () => {
    if (user) markPrompted(user);
    setOpen(false);
  };

  const save = async () => {
    setSaving(true);
    try {
      const list = await saveInterestsToHive(user, selected);
      setInterests(list);
      if (user) markPrompted(user);
      toast.success('Interests saved — change them anytime in Settings');
      setOpen(false);
      // Refetch the home feeds in place (no page reload) so they immediately
      // reflect the new interests. Runs after setInterests so the feed params
      // read the fresh list from the store.
      refreshHomeFeeds(queryClient, { authenticated, user });
    } catch (e) {
      toast.error(e?.message || 'Could not save interests');
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="interests-prompt-overlay" onClick={dismiss}>
      <div className="interests-prompt" onClick={(e) => e.stopPropagation()}>
        <h3 className="interests-prompt-title">What are you into?</h3>
        <p className="interests-prompt-text">
          Pick a few topics you enjoy and we’ll show you more of the content you like.
          You can change these anytime in <strong>Settings</strong>.
        </p>
        {/* Same picker (and search box) as Settings → Interests, so the two
            screens look and behave identically. Values are topic slugs. */}
        <TagsV2Picker
          multi
          searchable
          value={selected}
          onChange={setSelected}
          disabled={saving}
        />
        <div className="interests-prompt-actions">
          <button type="button" className="interests-prompt-cancel" onClick={dismiss} disabled={saving}>
            Not now
          </button>
          <button
            type="button"
            className="interests-prompt-save"
            onClick={save}
            disabled={saving || selected.length === 0}
          >
            {saving ? 'Saving…' : 'Save interests'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
