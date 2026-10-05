// @vitest-environment node
/**
 * Callback route handler — requirement #2 (route), #3 (code exchange), #4 (session).
 *
 * All 10 code paths through GET /api/v1/auth/callback are exercised:
 *   - 6 error branches that redirect with a specific auth_error code
 *   - 4 happy-path assertions that confirm the full flow succeeds
 *
 * No requests reach Salesforce. Every external call is mocked so tests are
 * fast, offline, and deterministic. Only the route-handler logic is under test.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

process.env.MOCK_MODE = 'on';

// ── Mock all route dependencies BEFORE importing the route ───────────────────

vi.mock('@/lib/config', () => ({
  CORRELATION_HEADER: 'x-correlation-id',
  LOGIN_STATE_COOKIE: 'on_login_state',
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

const mockExchangeCodeForTokens = vi.fn();
const mockFetchIdentity = vi.fn();

vi.mock('@/lib/auth/salesforce-oauth', () => ({
  exchangeCodeForTokens: mockExchangeCodeForTokens,
  fetchIdentity: mockFetchIdentity,
}));

const mockConsumeLoginState = vi.fn();
const mockCreateSsoSession = vi.fn();
const mockApplySessionCookies = vi.fn((res: unknown) => res);

vi.mock('@/lib/auth/session', () => ({
  consumeLoginState: mockConsumeLoginState,
  createSsoSession: mockCreateSsoSession,
  applySessionCookies: mockApplySessionCookies,
}));

const mockResolveAccountContext = vi.fn();

vi.mock('@/lib/auth/account-context', () => ({
  resolveAccountContext: mockResolveAccountContext,
}));

// ── Import route after mocks are registered ──────────────────────────────────
import { GET } from '../api/v1/auth/callback/route';

// ── Shared fixtures ──────────────────────────────────────────────────────────

const ORIGIN = 'http://localhost:3000';
const VALID_CODE = 'sf-auth-code-abc';
const VALID_STATE = 'random-state-xyz';
const LOGIN_STATE_COOKIE = 'on_login_state';

const FAKE_TOKENS = {
  accessToken: 'access-abc',
  refreshToken: 'refresh-abc',
  instanceUrl: 'https://x.my.salesforce.com',
  idUrl: 'https://x.my.salesforce.com/id/00D/005',
};

const FAKE_IDENTITY = {
  userId: '005USER000001abc',
  username: 'buyer@example.com',
  email: 'buyer@example.com',
  firstName: 'Dana',
  lastName: 'Reyes',
};

const FAKE_ACCOUNT = {
  effectiveAccountId: '001ACME',
  companyName: 'Acme HVAC',
  webstoreId: '0ZESTORE',
};

const FAKE_SESSION = { sid: 'session-sid-123', csrf: 'csrf-value-456' };

const FAKE_LOGIN_STATE = {
  codeVerifier: 'pkce-verifier-value',
  returnTo: '/dashboard',
  authority: 'site' as const,
  createdAt: Date.now(),
};

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Build a NextRequest for the callback endpoint. */
function makeRequest(
  params: Record<string, string> = {},
  stateCookie?: string,
): NextRequest {
  const url = new URL(`${ORIGIN}/api/v1/auth/callback`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const headers: Record<string, string> = {};
  if (stateCookie !== undefined) {
    headers['Cookie'] = `${LOGIN_STATE_COOKIE}=${stateCookie}`;
  }

  return new NextRequest(url, { headers });
}

/** Extract the auth_error code from a redirect response Location header. */
function authErrorCode(res: Response): string {
  const location = res.headers.get('Location') ?? '';
  return new URL(location, ORIGIN).searchParams.get('auth_error') ?? '';
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/v1/auth/callback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Restore happy-path mocks before each test so error tests only override what they need.
    mockConsumeLoginState.mockResolvedValue(FAKE_LOGIN_STATE);
    mockExchangeCodeForTokens.mockResolvedValue(FAKE_TOKENS);
    mockFetchIdentity.mockResolvedValue(FAKE_IDENTITY);
    mockResolveAccountContext.mockResolvedValue(FAKE_ACCOUNT);
    mockCreateSsoSession.mockResolvedValue(FAKE_SESSION);
    mockApplySessionCookies.mockImplementation((res: unknown) => res);
  });

  // ── Error branches ───────────────────────────────────────────────────────

  it('redirects with idp_error when Salesforce returns an error query param', async () => {
    const req = makeRequest({ error: 'access_denied', error_description: 'User cancelled' });
    const res = await GET(req);
    expect(res.status).toBe(302);
    expect(authErrorCode(res)).toBe('idp_error');
  });

  it('redirects with invalid_request when code is absent', async () => {
    const req = makeRequest({ state: VALID_STATE }, VALID_STATE);
    const res = await GET(req);
    expect(res.status).toBe(302);
    expect(authErrorCode(res)).toBe('invalid_request');
  });

  it('redirects with invalid_request when state is absent', async () => {
    const req = makeRequest({ code: VALID_CODE }); // no state param, no cookie
    const res = await GET(req);
    expect(res.status).toBe(302);
    expect(authErrorCode(res)).toBe('invalid_request');
  });

  it('redirects with invalid_state when the state cookie is absent (login not started here)', async () => {
    // State param present but no binding cookie — could be a CSRF attempt.
    const req = makeRequest({ code: VALID_CODE, state: VALID_STATE }); // no cookie
    const res = await GET(req);
    expect(res.status).toBe(302);
    expect(authErrorCode(res)).toBe('invalid_state');
  });

  it('redirects with invalid_state when state param does not match the cookie', async () => {
    // Attacker started their own login and handed the victim the callback URL.
    const req = makeRequest(
      { code: VALID_CODE, state: VALID_STATE },
      'attacker-different-state', // cookie bound to a different login
    );
    const res = await GET(req);
    expect(res.status).toBe(302);
    expect(authErrorCode(res)).toBe('invalid_state');
  });

  it('redirects with invalid_state on a replayed callback (state already consumed)', async () => {
    // GETDEL already cleared it — a second request finds nothing.
    mockConsumeLoginState.mockResolvedValue(null);
    const req = makeRequest({ code: VALID_CODE, state: VALID_STATE }, VALID_STATE);
    const res = await GET(req);
    expect(res.status).toBe(302);
    expect(authErrorCode(res)).toBe('invalid_state');
  });

  it('redirects with exchange_failed when token exchange throws', async () => {
    mockExchangeCodeForTokens.mockRejectedValue(new Error('Network error'));
    const req = makeRequest({ code: VALID_CODE, state: VALID_STATE }, VALID_STATE);
    const res = await GET(req);
    expect(res.status).toBe(302);
    expect(authErrorCode(res)).toBe('exchange_failed');
  });

  it('redirects with identity_failed when fetchIdentity throws', async () => {
    mockFetchIdentity.mockRejectedValue(new Error('Identity endpoint unreachable'));
    const req = makeRequest({ code: VALID_CODE, state: VALID_STATE }, VALID_STATE);
    const res = await GET(req);
    expect(res.status).toBe(302);
    expect(authErrorCode(res)).toBe('identity_failed');
  });

  it('redirects with identity_incomplete when identity response has no userId', async () => {
    // An authenticated session with no user id would scope every downstream call to nobody.
    mockFetchIdentity.mockResolvedValue({ ...FAKE_IDENTITY, userId: '' });
    const req = makeRequest({ code: VALID_CODE, state: VALID_STATE }, VALID_STATE);
    const res = await GET(req);
    expect(res.status).toBe(302);
    expect(authErrorCode(res)).toBe('identity_incomplete');
  });

  it('redirects with session_failed when createSsoSession throws (e.g. Redis write failed)', async () => {
    mockCreateSsoSession.mockRejectedValue(new Error('Redis ECONNREFUSED'));
    const req = makeRequest({ code: VALID_CODE, state: VALID_STATE }, VALID_STATE);
    const res = await GET(req);
    expect(res.status).toBe(302);
    expect(authErrorCode(res)).toBe('session_failed');
  });

  // ── Happy path ───────────────────────────────────────────────────────────

  describe('happy path', () => {
    it('returns a 302 redirect with no auth_error', async () => {
      const req = makeRequest({ code: VALID_CODE, state: VALID_STATE }, VALID_STATE);
      const res = await GET(req);
      expect(res.status).toBe(302);
      expect(authErrorCode(res)).toBe(''); // no error code in success redirect
    });

    it('redirects to the returnTo path stored in the login state', async () => {
      const req = makeRequest({ code: VALID_CODE, state: VALID_STATE }, VALID_STATE);
      const res = await GET(req);
      const location = res.headers.get('Location') ?? '';
      expect(new URL(location, ORIGIN).pathname).toBe('/dashboard'); // FAKE_LOGIN_STATE.returnTo
    });

    it('calls exchangeCodeForTokens with the auth code, PKCE verifier, and authority', async () => {
      const req = makeRequest({ code: VALID_CODE, state: VALID_STATE }, VALID_STATE);
      await GET(req);
      expect(mockExchangeCodeForTokens).toHaveBeenCalledWith(
        VALID_CODE,
        FAKE_LOGIN_STATE.codeVerifier,
        FAKE_LOGIN_STATE.authority,
      );
    });

    it('calls createSsoSession with tokens, identity, account, and authority', async () => {
      const req = makeRequest({ code: VALID_CODE, state: VALID_STATE }, VALID_STATE);
      await GET(req);
      expect(mockCreateSsoSession).toHaveBeenCalledWith(
        FAKE_TOKENS,
        FAKE_IDENTITY,
        FAKE_ACCOUNT,
        FAKE_LOGIN_STATE.authority,
      );
    });

    it('applies session cookies to the redirect response', async () => {
      const req = makeRequest({ code: VALID_CODE, state: VALID_STATE }, VALID_STATE);
      await GET(req);
      expect(mockApplySessionCookies).toHaveBeenCalledWith(
        expect.objectContaining({ status: 302 }),
        FAKE_SESSION,
      );
    });

    it('sets Cache-Control: no-store so the callback redirect is never cached', async () => {
      const req = makeRequest({ code: VALID_CODE, state: VALID_STATE }, VALID_STATE);
      const res = await GET(req);
      expect(res.headers.get('Cache-Control')).toBe('no-store');
    });
  });
});
