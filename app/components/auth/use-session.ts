
'use client';

/**
 * Client-side view of the BFF session.
 *
 * Deliberately separate from `lib/auth/session.ts`, which is server-only (it uses
 * next/headers and holds the Salesforce tokens). The browser only ever learns who it is
 * — never a token — so this hook reads the same safe projection the session route returns.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { RestResponse, Role } from '@/lib/types';
import type { ClientImpersonation } from '@/lib/auth/session-projection';

export interface SessionUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  companyName: string;
}

export interface ClientSession {
  authMode: 'dev' | 'sso';
  federationId: string;
  role: Role | null;
  /**
   * The EFFECTIVE identity. While `impersonation` is set this is the customer being acted
   * as — the associate's own name is under `impersonation.actor`.
   */
  user: SessionUser;
  effectiveAccountId: string;
  webstoreId: string;
  /** null on an ordinary session. */
  impersonation: ClientImpersonation | null;
}

export const SESSION_QUERY_KEY = ['auth', 'session'] as const;

/**
 * `null` means definitively signed out (the route answered 401), which is different from
 * `undefined` while the first request is still in flight — the header must not flash a
 * "Sign in" button at a user who is actually signed in.
 */
async function fetchSession(): Promise<ClientSession | null> {
  const res = await fetch('/api/v1/auth/session', { credentials: 'same-origin' });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`Session request failed (${res.status})`);
  const body = (await res.json()) as RestResponse<ClientSession>;
  return body.data ?? null;
}

export function useSession() {
  return useQuery({
    queryKey: SESSION_QUERY_KEY,
    queryFn: fetchSession,
    // The session cookie can be dropped by a logout in another tab, or expire server-side.
    refetchOnWindowFocus: true,
    staleTime: 60_000,
    retry: false,
  });
}

/** Read the double-submit CSRF token the BFF set as a readable cookie. */
export function readCsrfToken(): string {
  return (
    document.cookie
      .split('; ')
      .find((c) => c.startsWith('on_csrf='))
      ?.split('=')[1] ?? ''
  );
}

export interface LogoutResult {
  loggedOut: boolean;
  revoked: boolean;
  /**
   * Where to send the browser to end the Experience Cloud and Azure B2C sessions.
   * null for dev-login sessions, which have no upstream IdP session.
   */
  logoutUrl: string | null;
}

/**
 * Sign out. Clearing the BFF session is only the first of three — the returned
 * `logoutUrl` must be followed by a real top-level navigation to drop the Salesforce site
 * session and cascade to B2C. A fetch() to it would not do that: the browser has to go
 * there so the upstream cookies are cleared on their own domains.
 */
export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<LogoutResult> => {
      const res = await fetch('/api/v1/auth/logout', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'x-csrf-token': readCsrfToken() },
      });
      const body = (await res.json()) as RestResponse<LogoutResult>;
      if (!body.success || !body.data) {
        throw new Error(body.errorMessage ?? 'Logout failed');
      }
      return body.data;
    },
    onSuccess: (result) => {
      queryClient.setQueryData(SESSION_QUERY_KEY, null);
      if (result.logoutUrl) {
        window.location.assign(result.logoutUrl);
      } else {
        // Dev session: nothing upstream to end, so just refresh the current page.
        window.location.reload();
      }
    },
  });
}

/**
 * Start the login, returning the user to where they were.
 *
 * A plain navigation, not fetch(): the flow is a chain of cross-origin redirects through
 * Salesforce and Azure B2C that only a top-level navigation can follow.
 *
 * `audience` picks the authorization server, and it genuinely matters:
 *   'customer' → the Experience site, whose SAML config appends `.b2b`. Buyers only.
 *   'employee' → My Domain, running the org's ordinary employee SSO. Internal staff only,
 *                because their federation ids have no `.b2b` suffix and so match nothing
 *                at the site host.
 *
 * There is no way to detect which a visitor is before they authenticate — that is what
 * authenticating establishes — so this has to be a choice the person makes.
 */
export function startLogin(
  returnTo?: string,
  audience: 'customer' | 'employee' = 'customer',
): void {
  const target = returnTo ?? `${window.location.pathname}${window.location.search}`;
  const as = audience === 'employee' ? '&as=associate' : '';
  window.location.assign(`/api/v1/auth/login?returnTo=${encodeURIComponent(target)}${as}`);
}