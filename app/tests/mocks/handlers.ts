/**
 * MSW request handlers.
 *
 * Each handler represents a test-user persona. Tests pick the persona they
 * need by calling server.use(handlers.csoUser) before rendering. No real
 * Salesforce credentials are involved — this is purely in-process interception.
 *
 * Session shape matches what GET /api/v1/auth/session returns via
 * use-session.ts fetchSession() → RestResponse<ClientSession>.
 */
import { http, HttpResponse } from 'msw';

const SESSION_URL = '/api/v1/auth/session';

// ── Test-user personas ────────────────────────────────────────────────────────

/**
 * PCDIG12User — CSO (Customer Service Officer).
 *
 * Maps to E2E_TEST_USERNAME=PCDIG12User in integration tests.
 * Used here as an MSW mock — no credentials needed in unit tests.
 */
export const csoUserSession = {
  success: true,
  data: {
    authMode: 'sso' as const,
    federationId: 'pcdig12user.b2b',
    role: 'cso' as const,
    user: {
      id: '005PCDIG12User0001',
      firstName: 'PCDIG12',
      lastName: 'User',
      email: 'pcdig12user@test.pcdigires.com',
      companyName: 'Acme HVAC Supply',
    },
    effectiveAccountId: '001TEST000001ACME',
    webstoreId: '0ZETEST000001',
    impersonation: null,
  },
};

/** Unauthenticated — no active session (401). */
export const noSession = null;

// ── MSW handlers ──────────────────────────────────────────────────────────────

/** CSO user is signed in. */
export const handleCsoUser = http.get(SESSION_URL, () =>
  HttpResponse.json(csoUserSession),
);

/** No active session — 401. */
export const handleSignedOut = http.get(SESSION_URL, () =>
  HttpResponse.json({ success: false, errorCode: 'NOT_AUTHENTICATED' }, { status: 401 }),
);

/**
 * Default handler list — signed out.
 * Tests that need a signed-in user call server.use(handleCsoUser) to override.
 */
export const handlers = [handleSignedOut];
