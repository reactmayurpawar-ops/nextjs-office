'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { NavItem, SiteConfig } from '@/content/types';
import { NavDropdown } from './NavDropdown';
import { LanguageSelector } from './LanguageSelector';
import styles from './Nav.module.css';

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Desktop category nav bar (light-gray row) with the language selector pinned to
 * the right (matches the Trane Supply site). Hidden at <=768px in favor of the
 * hamburger drawer. Renders a dropdown for items that declare children.
 */
export function Nav({
  items,
  languages,
}: {
  items: NavItem[];
  languages: SiteConfig['languages'];
}) {
  const pathname = usePathname();

  return (
    <nav className={styles.nav} aria-label="Primary">
      <div className={`ts-container ${styles.row}`}>
        <ul className={styles.list}>
          {items.map((item) => {
            const active = isActive(pathname, item.href);
            if (item.children && item.children.length > 0) {
              return <NavDropdown key={item.id} item={item} active={active} />;
            }
            return (
              <li key={item.id} className={styles.item}>
                <Link href={item.href} className={`${styles.link} ${active ? styles.active : ''}`}>
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
        <div className={styles.lang}>
          <LanguageSelector languages={languages} />
        </div>
      </div>
    </nav>
  );
}
