'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { useLogout, useSession, startLogin } from '@/components/auth/use-session';
import type { NavItem, SiteConfig } from '@/content/types';
import styles from './MobileMenu.module.css';

interface MobileMenuProps {
  id: string;
  open: boolean;
  onClose: () => void;
  items: NavItem[];
  config: SiteConfig;
}

/** Slide-in drawer for <=768px: nav (accordion for children) + auth. */
export function MobileMenu({ id, open, onClose, items, config }: MobileMenuProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const logout = useLogout();
  const panelRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  // Close on route change.
  useEffect(() => {
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Escape to close + body scroll lock while open + focus the panel.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  return (
    <div className={`${styles.root} ${open ? styles.open : ''}`} aria-hidden={!open}>
      <div className={styles.overlay} onClick={onClose} />
      <div
        id={id}
        ref={panelRef}
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        tabIndex={-1}
      >
        <div className={styles.head}>
          <span className={styles.headTitle}>Menu</span>
          <button
            type="button"
            className={styles.closeBtn}
            aria-label="Close menu"
            onClick={onClose}
          >
            <Icon name="close" size={24} />
          </button>
        </div>

        <nav className={styles.nav} aria-label="Mobile">
          <ul className={styles.list}>
            {items.map((item) => {
              const hasChildren = !!item.children?.length;
              const isExpanded = expanded === item.id;
              return (
                <li key={item.id} className={styles.item}>
                  {hasChildren ? (
                    <>
                      <button
                        type="button"
                        className={styles.itemToggle}
                        aria-expanded={isExpanded}
                        onClick={() => setExpanded(isExpanded ? null : item.id)}
                      >
                        {item.label}
                        <Icon
                          name="chevron-down"
                          size={18}
                          className={`${styles.caret} ${isExpanded ? styles.caretUp : ''}`}
                        />
                      </button>
                      {isExpanded && (
                        <ul className={styles.sublist}>
                          {item.children!.map((child) => (
                            <li key={child.id}>
                              <Link href={child.href} className={styles.sublink} onClick={onClose}>
                                {child.label}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </>
                  ) : (
                    <Link href={item.href} className={styles.itemLink} onClick={onClose}>
                      {item.label}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>

        <div className={styles.auth}>
          {session ? (
            <Button
              variant="secondary"
              size="lg"
              className={styles.authBtn}
              onClick={() => logout.mutate()}
              disabled={logout.isPending}
            >
              {logout.isPending ? 'Signing out…' : 'Sign out'}
            </Button>
          ) : (
            <Button
              variant="primary"
              size="lg"
              className={styles.authBtn}
              onClick={() => startLogin()}
            >
              {config.auth.loginLabel}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
