import { FaDiscord } from 'react-icons/fa';
import { SiTelegram } from 'react-icons/si';
import { MdClose } from 'react-icons/md';
import { useSupportBlock } from '../../lib/supportBlockStore';
import './SupportModal.scss';

// Discord / Telegram — same links as the profile sidebar's support-wrap.
const DISCORD_URL = 'https://discord.com/invite/NSFS2VGj83';
const TELEGRAM_URL = 'https://t.me/threespeak';

const COPY = {
  banned: {
    title: 'Your account is banned',
    body: 'Your 3Speak account has been banned, so you can’t be logged in. If you think this is a mistake, please contact 3Speak support.',
  },
  upload: {
    title: 'Uploading is disabled for your account',
    body: 'Your 3Speak account isn’t allowed to upload right now. If you think this is a mistake, please contact 3Speak support.',
  },
};

export default function SupportModal() {
  const block = useSupportBlock((s) => s.block);
  const hide = useSupportBlock((s) => s.hideSupportBlock);
  if (!block) return null;

  const copy = COPY[block.reason] || COPY.banned;

  return (
    <div className="support-modal-overlay" onClick={hide}>
      <div className="support-modal" onClick={(e) => e.stopPropagation()}>
        <button className="support-modal-close" onClick={hide} aria-label="Close"><MdClose size={20} /></button>
        <h3 className="support-modal-title">{copy.title}</h3>
        <p className="support-modal-body">{copy.body}</p>
        <div className="support-modal-actions">
          <a className="support-modal-btn discord" href={DISCORD_URL} target="_blank" rel="noopener noreferrer">
            <FaDiscord size={20} /> <span>Discord</span>
          </a>
          <a className="support-modal-btn telegram" href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer">
            <SiTelegram size={20} /> <span>Telegram</span>
          </a>
        </div>
      </div>
    </div>
  );
}
