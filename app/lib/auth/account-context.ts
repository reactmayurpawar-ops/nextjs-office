/**
 * Resolves the buyer's account scope after login: which account they shop for, and which
 * webstore they shop in.
 *
 * These are Salesforce *state*, not identity claims — the OAuth identity resource does not
 * carry them — so they cannot come from the token. Migration plan §3.3 makes the BFF own
 * them precisely so the browser can never assert its own account.
 *
 * INTERIM. Phase 2 replaces this with the Apex `/v1/context` endpoint, which will also
 * return permissions, delegated accounts and the account switcher's options. Until that
 * exists, we read the same facts through the standard Salesforce REST query API using the
 * user's own token — so record-level security still applies and no integration user is
 * involved. When `/v1/context` lands, delete this file.
 */
import { resilientFetch } from '../http-resilient';
import { config } from '../config';
import { logger } from '../logger';

export interface AccountContext {
  effectiveAccountId: string;
  /** Account name — shown as "Shopping for …", matching the Experience Cloud header. */
  companyName: string;
  webstoreId: string;
}

export const EMPTY_ACCOUNT_CONTEXT: AccountContext = {
  effectiveAccountId: '',
  companyName: '',
  webstoreId: '',
};

/**
 * Salesforce ids are 15 or 18 alphanumeric characters. The id we interpolate comes from
 * Salesforce's own identity resource, but it still travels through a redirect the browser
 * can see, so it is validated before reaching SOQL. The Yext implementation interpolated a
 * user-supplied value straight into a query.
 */
const SF_ID = /^[a-zA-Z0-9]{15,18}$/;

async function soql<T>(
  instanceUrl: string,
  token: string,
  query: string,
  correlationId?: string,
): Promise<T[]> {
  const url = `${instanceUrl.replace(/\/$/, '')}/services/data/${config.sfApiVersion}/query?q=${encodeURIComponent(query)}`;

  const res = await resilientFetch(
    url,
    { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } },
    { key: 'sf:query', timeoutMs: 8_000, retries: 2, correlationId },
  );

  if (!res.ok) {
    throw new Error(`Salesforce query failed (HTTP ${res.status})`);
  }
  const body = (await res.json()) as { records?: T[] };
  return body.records ?? [];
}

/**
 * Best-effort: a failure here must not fail the login. A user with no account context can
 * still sign in and browse; the routes that genuinely need it fail on their own terms with
 * a clear error, which is easier to diagnose than a login that mysteriously does not work.
 */
export async function resolveAccountContext(
  instanceUrl: string,
  token: string,
  userId: string,
  correlationId?: string,
): Promise<AccountContext> {
  if (!instanceUrl || !token || !SF_ID.test(userId)) {
    return { ...EMPTY_ACCOUNT_CONTEXT, webstoreId: config.sfWebstoreId };
  }

  const context = { ...EMPTY_ACCOUNT_CONTEXT };

  try {
    const users = await soql<{ Contact?: { AccountId?: string; Account?: { Name?: string } } }>(
      instanceUrl,
      token,
      `SELECT Contact.AccountId, Contact.Account.Name FROM User WHERE Id = '${userId}'`,
      correlationId,
    );
    context.effectiveAccountId = users[0]?.Contact?.AccountId ?? '';
    context.companyName = users[0]?.Contact?.Account?.Name ?? '';
  } catch (e) {
    logger.error('auth.account-context', `account lookup failed: ${(e as Error).message}`, {
      correlationId,
    });
  }

  // Webstore comes from config, not from the community id Salesforce hands us on the
  // callback: WebStoreNetwork is not queryable by buyer users (400), and widening their
  // access to a setup object just to read a deployment constant is not worth it.
  context.webstoreId = config.sfWebstoreId;

  return context;
}

