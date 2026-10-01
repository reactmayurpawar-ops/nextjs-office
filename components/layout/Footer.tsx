import Link from 'next/link';
import Image from 'next/image';
import type { FooterConfig } from '@/content/types';
import styles from './Footer.module.css';

function isExternal(href: string) {
  return href.startsWith('http');
}

function FooterLink({ href, label }: { href: string; label: string }) {
  if (isExternal(href)) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer">
        {label}
      </a>
    );
  }
  return <Link href={href}>{label}</Link>;
}

export function Footer({ config }: { config: FooterConfig }) {
  return (
    <footer className={styles.footer}>
      <div className={`ts-container ${styles.inner}`}>
        <div className={styles.logo}>
          <Image
            src="/images/logo-trane.png"
            alt="Trane — It's Hard To Stop A Trane."
            width={379}
            height={171}
            className={styles.logoImg}
          />
        </div>

        <ul className={styles.brandLinks}>
          {config.brandLinks.map((link) => (
            <li key={link.id}>
              <FooterLink href={link.href} label={link.label} />
            </li>
          ))}
        </ul>

        <hr className={styles.divider} />

        <div className={styles.legal}>
          <span className={styles.disclaimer}>
            Information displayed on our website is subject to change.
          </span>
          <ul className={styles.legalLinks}>
            {config.legalLinks.map((link) => (
              <li key={link.id}>
                <FooterLink href={link.href} label={link.label} />
              </li>
            ))}
            <li className={styles.copyright}>{config.copyright}</li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
