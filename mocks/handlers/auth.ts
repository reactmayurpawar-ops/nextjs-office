/**
 * MSW request handlers for Authentication and Session endpoints.
 *
 * Provides the test persona matching the B2B customer context:
 *   - Name: PCDIG12User React POC
 *   - Email: riddhi.debnath@contractor.tranetechnologies.com
 *   - Company: React POC test account
 *   - Role: cso
 *   - Account: 001TEST000001ACME
 */
import { http, HttpResponse } from 'msw';

export const SESSION_URL = '/api/v1/auth/session';

// ── Test-user persona ─────────────────────────────────────────────────────────

export const csoUserSession = {
  success: true,
  data: {
    authMode: 'sso' as const,
    federationId: 'pcdig12user.b2b',
    role: 'cso' as const,
    user: {
      id: '005PCDIG12User0001',
      firstName: 'PCDIG12User',
      lastName: 'React POC',
      email: 'riddhi.debnath@contractor.tranetechnologies.com',
      companyName: 'React POC test account',
    },
    effectiveAccountId: '001TEST000001ACME',
    webstoreId: '0ZETEST000001',
    impersonation: null,
  },
};

// ── MSW handlers ──────────────────────────────────────────────────────────────

/** CSO user is signed in. */
export const handleCsoUser = http.get(SESSION_URL, () =>
  HttpResponse.json(csoUserSession),
);

/** No active session — 401. */
export const handleSignedOut = http.get(SESSION_URL, () =>
  HttpResponse.json({ success: false, errorCode: 'NOT_AUTHENTICATED' }, { status: 401 }),
);

export const authHandlers = [handleSignedOut];
export const handlers = [handleSignedOut];
