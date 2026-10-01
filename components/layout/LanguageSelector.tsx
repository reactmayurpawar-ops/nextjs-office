'use client';

import { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import styles from './LanguageSelector.module.css';

interface Language {
  code: string;
  label: string;
}

export function LanguageSelector({ languages }: { languages: Language[] }) {
  const [current, setCurrent] = useState(languages[0]);
  const [open, setOpen] = useState(false);

  if (languages.length === 0) return null;

  return (
    <div className={styles.wrap} onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        className={styles.trigger}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <Icon name="globe" size={18} />
        <span>{current.label}</span>
        <Icon name="chevron-down" size={14} />
      </button>
      {open && (
        <ul className={styles.menu} role="listbox">
          {languages.map((lang) => (
            <li key={lang.code} role="option" aria-selected={lang.code === current.code}>
              <button
                type="button"
                className={styles.option}
                onClick={() => {
                  setCurrent(lang);
                  setOpen(false);
                }}
              >
                {lang.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
