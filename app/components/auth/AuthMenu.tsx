
'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { useLogout, useSession, startLogin } from './use-session';
import { ImpersonateDialog } from '@/components/associate/ImpersonateDialog';
import { useCanImpersonate } from '@/components/associate/use-impersonation';
import styles from './AuthMenu.module.css';

/**
 * Header auth control: a sign-in button when signed out, the user's name plus a
 * sign-out menu when signed in.
 *
 * Mirrors what the Experience Cloud site shows in the same corner, so a user crossing
 * between React pages and Salesforce-rendered pages sees the same identity in both.
 */
export function AuthMenu({ loginLabel }: { loginLabel: string }) {
  const { data: session, isPending } = useSession();
  const logout = useLogout();
  const [open, setOpen] = useState(false);
  const [picking, setPicking] = useState(false);
  const { data: canImpersonate } = useCanImpersonate();
  const wrapRef = useRef<HTMLDivElement>(null);

  // Close on outside click / Escape — a menu that traps focus in a header is worse than none.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  // Reserve the space while the first session request is in flight. Rendering "Sign in"
  // here would flash the wrong state at users who are in fact signed in.
  if (isPending) {
    return <div className={styles.placeholder} aria-hidden="true" />;
  }

  if (!session) {
    return (
      <div className={styles.signedOut}>
        <Button variant="primary" size="md" onClick={() => startLogin()}>
          {loginLabel}
        </Button>
        {/*
          Employees cannot use the customer button: the Experience site's SAML config
          appends `.b2b` to the incoming identity, so an internal federation id matches no
          user. Nothing can tell the two apart before they authenticate, so it is a choice
          rather than a detection.
        */}
        <button
          type="button"
          className={styles.employeeLogin}
          onClick={() => startLogin(undefined, 'employee')}
        >
          Employee sign in
        </button>
      </div>
    );
  }

  const displayName =
    [session.user.firstName, session.user.lastName].filter(Boolean).join(' ') || session.user.email;

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        type="button"
        className={styles.trigger}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((o) => !o)}
      >
        <Icon name="user" size={20} />
        <span className={styles.name}>{displayName}</span>
        <span className={styles.caret} aria-hidden="true" />
      </button>

      {open && (
        <div className={styles.menu} role="menu">
          <div className={styles.identity}>
            <span className={styles.identityName}>{displayName}</span>
            <span className={styles.identityEmail}>{session.user.email}</span>
            {/* Effective account is the account being shopped for, not the user's own. */}
            {session.effectiveAccountId && (
              <span className={styles.identityAccount}>
                Shopping for {session.user.companyName || session.effectiveAccountId}
              </span>
            )}
          </div>

          {/*
            Offered on the associate role only. The server re-checks the permission set on
            every call, so this is an affordance; hiding it is a courtesy, not a control.
            Never shown while already impersonating — the banner's End button is the only
            way out, and pivoting to a third identity is refused server-side anyway.
          */}
          {canImpersonate && !session.impersonation && (
            <button
              type="button"
              role="menuitem"
              className={styles.signOut}
              onClick={() => {
                setOpen(false);
                setPicking(true);
              }}
            >
              Act as a customer…
            </button>
          )}

          <button
            type="button"
            role="menuitem"
            className={styles.signOut}
            onClick={() => logout.mutate()}
            disabled={logout.isPending}
          >
            {logout.isPending ? 'Signing out…' : 'Sign out'}
          </button>

          {logout.isError && (
            <p className={styles.error} role="alert">
              Could not sign out. Please try again.
            </p>
          )}
        </div>
      )}

      {picking && <ImpersonateDialog onClose={() => setPicking(false)} />}
    </div>
  );
}
