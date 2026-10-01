'use client';

import { useEffect, useState } from 'react';
import { useSession } from '@/components/auth/use-session';
import { useEndImpersonation } from './use-impersonation';
import styles from './ImpersonationBanner.module.css';

/**
 * Persistent "you are acting as someone else" indicator.
 *
 * Deliberately not dismissible and deliberately sticky. The failure this guards against is
 * an associate forgetting whose account they are in and taking an action the customer
 * appears to have taken — and the current Experience Cloud flow has no indicator at all
 * (the impersonated site page shows only the buyer's name). It also cannot cover
 * Salesforce-rendered pages, which is a known gap recorded in the plan.
 */
export function ImpersonationBanner() {
  const { data: session } = useSession();
  const endImpersonation = useEndImpersonation();
  const impersonation = session?.impersonation ?? null;

  if (!impersonation) return null;

  return (
    <div className={styles.banner} role="status" aria-live="polite">
      <span className={styles.who}>
        <span>
          Acting as <span className={styles.target}>{impersonation.target.name}</span>
        </span>
        {impersonation.target.accountName && (
          <span className={styles.account}>{impersonation.target.accountName}</span>
        )}
        <span className={styles.account}>· signed in as {impersonation.actor.name}</span>
      </span>
      <span className={styles.meta}>
        <Countdown expiresAt={impersonation.expiresAt} />
        <button
          type="button"
          className={styles.end}
          disabled={endImpersonation.isPending}
          onClick={() => endImpersonation.mutate()}
        >
          {endImpersonation.isPending ? 'Ending…' : 'End session'}
        </button>
      </span>
    </div>
  );
}

/**
 * The server enforces the cap on every session read, so this is an affordance, not the
 * control — it exists so the session does not simply vanish mid-task without warning.
 */
function Countdown({ expiresAt }: { expiresAt: number }) {
  const [remaining, setRemaining] = useState(() => expiresAt - Date.now());

  useEffect(() => {
    const id = setInterval(() => setRemaining(expiresAt - Date.now()), 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  if (remaining <= 0) return <span className={styles.countdown}>expired</span>;
  const totalSeconds = Math.floor(remaining / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return (
    <span className={styles.countdown}>
      {minutes}:{String(seconds).padStart(2, '0')} left
    </span>
  );
}
