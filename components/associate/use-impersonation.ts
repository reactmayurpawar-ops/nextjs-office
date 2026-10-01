'use client';

/**
 * Client half of the act-as-customer flow. Mirrors components/auth/use-session.ts: the
 * browser learns who it is acting as, never how.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { RestResponse } from '@/lib/types';
import {
  readCsrfToken,
  SESSION_QUERY_KEY,
  type ClientSession,
} from '@/components/auth/use-session';

export interface TargetSummary {
  userId: string;
  name: string;
  username: string;
  accountName: string;
  eligible: boolean;
  /** Why this customer cannot be selected. Shown next to the disabled row. */
  reason?: string;
}

async function unwrap<T>(res: Response): Promise<T> {
  const body = (await res.json()) as RestResponse<T>;
  if (!body.success || body.data === null) {
    throw new Error(body.errorMessage ?? 'Request failed');
  }
  return body.data;
}

/**
 * Whether to offer the act-as-customer affordance.
 *
 * Deliberately NOT `session.role === 'csa'`. Role is null for every real login — it is a
 * Salesforce permission fact that the OAuth identity resource does not return, and the BFF
 * refuses to guess one (see docs/AUTHENTICATION.md §9). Gating on it hides the feature from
 * exactly the people who have it. `permissions.canImpersonate` is resolved server-side by
 * the same authorizer that guards the route, so the button and the API cannot disagree.
 */
export function useCanImpersonate() {
  return useQuery({
    queryKey: ['associate', 'can-impersonate'],
    queryFn: async () => {
      const res = await fetch('/api/v1/context', { credentials: 'same-origin' });
      if (!res.ok) return false;
      const body = (await res.json()) as RestResponse<{
        permissions?: Record<string, boolean>;
      }>;
      return Boolean(body.data?.permissions?.canImpersonate);
    },
    staleTime: 5 * 60_000,
    retry: false,
  });
}

export function useTargetSearch(term: string) {
  return useQuery({
    queryKey: ['associate', 'targets', term],
    // The API requires 3 characters; don't fire a request that is going to 400.
    enabled: term.trim().length >= 3,
    queryFn: async () => {
      const res = await fetch(`/api/v1/associate/targets?q=${encodeURIComponent(term.trim())}`, {
        credentials: 'same-origin',
      });
      return unwrap<{ policy: string; targets: TargetSummary[] }>(res);
    },
    retry: false,
  });
}

/**
 * Both mutations clear the whole query cache and reload rather than invalidating selected
 * keys. Impersonation changes the cart, pricing, context, saved lists and order history at
 * the same instant; enumerating those keys here produces a list that goes stale the moment
 * someone adds a feature, and the failure mode is a page showing one customer's data under
 * another's name. A reload is blunt, honest and cheap.
 */
function reloadAfterIdentityChange(
  queryClient: ReturnType<typeof useQueryClient>,
  destination?: string,
) {
  queryClient.clear();
  /**
   * A full document load, not a router push. The cache clear only empties React Query;
   * anything already rendered from the previous identity is still in the DOM, and the
   * session cookie was just rotated. Reloading is the only way to be certain the page
   * the user ends up looking at was built entirely under the new identity.
   */
  if (destination) window.location.assign(destination);
  else window.location.reload();
}

export function useStartImpersonation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      targetUserId: string;
      reason?: string;
      /** Where to land afterwards. Omit to reload in place (the header picker's case). */
      redirectTo?: string;
    }) => {
      const res = await fetch('/api/v1/associate/impersonate', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json', 'x-csrf-token': readCsrfToken() },
        body: JSON.stringify({ targetUserId: args.targetUserId, reason: args.reason }),
      });
      return unwrap<ClientSession>(res);
    },
    onSuccess: (_data, args) => reloadAfterIdentityChange(queryClient, args.redirectTo),
  });
}

export function useEndImpersonation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/v1/associate/impersonate', {
        method: 'DELETE',
        credentials: 'same-origin',
        headers: { 'x-csrf-token': readCsrfToken() },
      });
      return unwrap<ClientSession & { ended: boolean; auditCleared: boolean }>(res);
    },
    onSuccess: () => reloadAfterIdentityChange(queryClient),
  });
}

export { SESSION_QUERY_KEY };
