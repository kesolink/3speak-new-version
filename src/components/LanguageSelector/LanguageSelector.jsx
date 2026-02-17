import { useState } from 'react';
import { MdTranslate } from 'react-icons/md';
import { SUPPORTED_LANGUAGES, getTargetLanguage, setTargetLanguage } from '../../utils/translate';
import './LanguageSelector.scss';

export default function LanguageSelector({ onChange }) {
  const [lang, setLang] = useState(getTargetLanguage);

  const handleChange = (e) => {
    const code = e.target.value;
    setLang(code);
    setTargetLanguage(code);
    onChange?.(code);
  };

  return (
    <div className="language-selector">
      <MdTranslate size={16} />
      <select value={lang} onChange={handleChange}>
        {SUPPORTED_LANGUAGES.map(l => (
          <option key={l.code} value={l.code}>
            {l.native}
          </option>
        ))}
      </select>
    </div>
  );
}
