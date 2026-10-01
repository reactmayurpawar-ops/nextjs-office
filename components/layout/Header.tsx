import Link from 'next/link';
import Image from 'next/image';
import { Icon } from '@/components/ui/Icon';
import { AuthMenu } from '@/components/auth/AuthMenu';
import type { SiteConfig } from '@/content/types';
import { SearchBar } from './SearchBar';
import styles from './Header.module.css';

interface HeaderProps {
  config: SiteConfig;
  menuOpen: boolean;
  onMenuToggle: () => void;
  mobileMenuId: string;
}

/** Top bar: hamburger (mobile) + logo, centered search, auth + language. */
export function Header({ config, menuOpen, onMenuToggle, mobileMenuId }: HeaderProps) {
  return (
    <div className={styles.bar}>
      <div className={`ts-container ${styles.inner}`}>
        <div className={styles.left}>
          <button
            type="button"
            className={styles.hamburger}
            aria-label="Open menu"
            aria-expanded={menuOpen}
            aria-controls={mobileMenuId}
            onClick={onMenuToggle}
          >
            <Icon name={menuOpen ? 'close' : 'menu'} size={26} />
          </button>
          <Link href="/" className={styles.logo} aria-label={config.brandName}>
            <Image
              src={config.logo.src}
              alt={config.logo.alt}
              width={config.logo.width}
              height={config.logo.height}
              className={styles.logoImg}
              priority
            />
          </Link>
        </div>

        <div className={styles.searchWrap}>
          <SearchBar placeholder={config.search.placeholder} action={config.search.action} />
        </div>

        <div className={styles.right}>
          <AuthMenu loginLabel={config.auth.loginLabel} />
        </div>
      </div>
    </div>
  );
}
