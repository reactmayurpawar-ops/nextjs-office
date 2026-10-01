'use client';

import { useId, useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import type { NavItem } from '@/content/types';
import styles from './Nav.module.css';

/**
 * Desktop dropdown for a nav item with children. Opens on hover and on
 * keyboard focus; closes on blur-out or Escape.
 */
export function NavDropdown({ item, active }: { item: NavItem; active: boolean }) {
  const [open, setOpen] = useState(false);
  const menuId = useId();

  return (
    <li
      className={styles.item}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') setOpen(false);
      }}
    >
      <Link
        href={item.href}
        className={`${styles.link} ${active ? styles.active : ''}`}
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={menuId}
      >
        {item.label}
        <Icon name="chevron-down" size={14} className={styles.caret} />
      </Link>
      {item.children && item.children.length > 0 && (
        <ul id={menuId} className={`${styles.dropdown} ${open ? styles.dropdownOpen : ''}`}>
          {item.children.map((child) => (
            <li key={child.id}>
              <Link href={child.href} className={styles.dropdownLink}>
                {child.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
