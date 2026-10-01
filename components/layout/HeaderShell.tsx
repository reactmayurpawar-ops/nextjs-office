'use client';

import { useState } from 'react';
import type { NavItem, SiteConfig } from '@/content/types';
import { Header } from './Header';
import { Nav } from './Nav';
import { MobileMenu } from './MobileMenu';

const MOBILE_MENU_ID = 'mobile-menu';

/**
 * Client wrapper owning the mobile-menu open state so Header/Nav/MobileMenu can
 * share it. Keeps the page itself a server component.
 */
export function HeaderShell({ config, navItems }: { config: SiteConfig; navItems: NavItem[] }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header>
      <Header
        config={config}
        menuOpen={menuOpen}
        onMenuToggle={() => setMenuOpen((o) => !o)}
        mobileMenuId={MOBILE_MENU_ID}
      />
      <Nav items={navItems} languages={config.languages} />
      <MobileMenu
        id={MOBILE_MENU_ID}
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        items={navItems}
        config={config}
      />
    </header>
  );
}
