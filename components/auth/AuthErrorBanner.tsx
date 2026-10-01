'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import styles from './AuthErrorBanner.module.css';

/**
 * Surfaces a failed login. The OAuth callback cannot render a message itself — it is
 * mid-redirect — so it sends the browser back with `?auth_error=<code>` and this turns
 * that code into something a person can act on.
 *
 * The codes are deliberately coarse. The callback is unauthenticated, so the detail stays
 * in the server log (searchable by correlation id) rather than in the URL.
 */
const MESSAGES: Record<string, string> = {
  idp_error: 'Sign-in was cancelled or refused. Please try again.',
  invalid_request: 'That sign-in link was incomplete. Please try again.',
  invalid_state: 'Your sign-in attempt expired. Please try again.',
  identity_incomplete: 'We signed you in but could not read your profile. Contact support.',
  exchange_failed: 'We could not complete sign-in. Please try again.',
  identity_failed: 'We signed you in but could not read your profile. Please try again.',
  context_failed: 'We signed you in but could not load your account. Please try again.',
  session_failed: 'We signed you in but could not start your session. Please try again.',
};

export function AuthErrorBanner() {
  const params = useSearchParams();
  const router = useRouter();
  const code = params.get('auth_error');
  if (!code) return null;

  return (
    <div className={styles.banner} role="alert">
      <span>{MESSAGES[code] ?? 'Sign-in failed. Please try again.'}</span>
      <button
        type="button"
        className={styles.dismiss}
        aria-label="Dismiss"
        // Drop the param so a refresh or a shared URL does not resurrect the error.
        onClick={() => router.replace(window.location.pathname)}
      >
        ×
      </button>
    </div>
  );
}
