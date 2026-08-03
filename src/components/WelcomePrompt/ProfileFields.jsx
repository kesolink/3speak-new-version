import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Camera, MapPin, Loader2 } from 'lucide-react';
import { saveProfileToHive } from '../../utils/profileMeta';
import { uploadThumbnail } from '../../utils/uploadThumbnail';
import { setAvatarOverride, clearAvatarOverride, useAvatarUrl } from '../../utils/avatarCache';

// The profile picture / display name / bio / location block, shared by the
// new-user welcome flow and the "Edit" button on your own profile page.

export const NAME_MAX = 30;
export const ABOUT_MAX = 160;
export const LOCATION_MAX = 30;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const EMPTY = { name: '', about: '', location: '', profile_image: '' };
const FIELDS = ['name', 'about', 'location', 'profile_image'];

/**
 * Form state + upload + save for the profile block. `seed` fills it from an
 * already-fetched Hive profile; `save` broadcasts and resolves true on success.
 */
export function useProfileEditor(username) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const seed = useCallback((profile) => {
    setForm({
      name: profile?.name || '',
      about: profile?.about || '',
      location: profile?.location || '',
      profile_image: profile?.profile_image || '',
    });
  }, []);

  const setField = useCallback(
    (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value })),
    [],
  );

  const pickImage = useCallback(async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error('That image is over 8MB, please pick a smaller one');
      return;
    }
    setUploading(true);
    try {
      // preferStatic: delegated logins (ButrAuth, HiveSigner) can't sign the
      // hive.blog challenge client-side, so skip that fallback.
      const url = await uploadThumbnail(file, username, { preferStatic: true });
      setForm((f) => ({ ...f, profile_image: url }));
    } catch (err) {
      toast.error(err?.message || 'Could not upload that image');
    } finally {
      setUploading(false);
    }
  }, [username]);

  const hasAnything = FIELDS.some((k) => String(form[k] || '').trim());

  const save = useCallback(async (successMessage = 'Profile saved') => {
    if (!username) return false;
    setSaving(true);
    try {
      await saveProfileToHive(username, form);
      // Render the picture we just uploaded straight away: the hive avatar
      // proxy would keep serving the old one for a while.
      if (form.profile_image) setAvatarOverride(username, form.profile_image);
      else clearAvatarOverride(username);
      toast.success(successMessage);
      return true;
    } catch (e) {
      toast.error(e?.message || 'Could not save your profile');
      return false;
    } finally {
      setSaving(false);
    }
  }, [username, form]);

  return { form, seed, setForm, setField, pickImage, uploading, saving, hasAnything, save };
}

export default function ProfileFields({ username, form, setField, pickImage, uploading, saving }) {
  const fileRef = useRef(null);
  const currentAvatar = useAvatarUrl(username, null);
  const avatar = form.profile_image || currentAvatar;

  return (
    <>
      <div className="welcome-avatar-row">
        <button
          type="button"
          className="welcome-avatar"
          onClick={() => fileRef.current && fileRef.current.click()}
          disabled={uploading || saving}
          aria-label="Upload a profile picture"
        >
          <img src={avatar} alt="" onError={(e) => { e.target.style.visibility = 'hidden'; }} />
          <span className="welcome-avatar-badge">
            {uploading ? <Loader2 size={15} className="welcome-spin" /> : <Camera size={15} />}
          </span>
        </button>
        <div className="welcome-avatar-text">
          <strong>Profile picture</strong>
          <span>{uploading ? 'Uploading…' : 'A face or a logo works best. JPG or PNG, up to 8MB.'}</span>
        </div>
        <input ref={fileRef} type="file" accept="image/*" onChange={pickImage} style={{ display: 'none' }} />
      </div>

      <label className="welcome-field">
        <span className="welcome-label">Display name</span>
        <input
          type="text"
          value={form.name}
          onChange={setField('name')}
          maxLength={NAME_MAX}
          placeholder={`How should we call you? (@${username})`}
          disabled={saving}
        />
      </label>

      <label className="welcome-field">
        <span className="welcome-label">
          Short bio
          <em>{form.about.length}/{ABOUT_MAX}</em>
        </span>
        <textarea
          rows={3}
          value={form.about}
          onChange={setField('about')}
          maxLength={ABOUT_MAX}
          placeholder="What do you make, and what should people expect from you?"
          disabled={saving}
        />
      </label>

      <label className="welcome-field">
        <span className="welcome-label">Location <em>optional</em></span>
        <div className="welcome-input-icon">
          <MapPin size={15} />
          <input
            type="text"
            value={form.location}
            onChange={setField('location')}
            maxLength={LOCATION_MAX}
            placeholder="Where in the world are you?"
            disabled={saving}
          />
        </div>
      </label>
    </>
  );
}
