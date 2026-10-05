// @vitest-environment node
/**
 * HTTPOnly cookie security contract — requirement #5.
 *
 * sessionCookieSpecs() is a private function inside session.ts. We exercise
 * it through the public applySessionCookies(), which is exactly what the
 * callback route calls. Asserting on the response cookies is the same thing
 * the browser receives via Set-Cookie.
 *
 * Two cookies, two very different httpOnly values — that asymmetry is the
 * whole point of the double-submit CSRF pattern and must never silently regress.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

process.env.MOCK_MODE = 'on';

// ── Dependency mocks ─────────────────────────────────────────────────────────
// applySessionCookies only uses config + NextResponse — everything else is
// pulled in transitively by session.ts imports. Mock them so the test stays
// offline and free of ioredis / next/headers machinery.

// Mutable so the prod-security test can flip isProd without a module reset.
const mockConfig = { isProd: false };

vi.mock('@/lib/config', () => ({
  get config() { return mockConfig; },
  SESSION_COOKIE: 'on_session',
  CSRF_COOKIE: 'on_csrf',
}));

vi.mock('@/lib/cache', () => ({
  cacheSetJson: vi.fn(),
  cacheGetJson: vi.fn(),
  cacheGetDelJson: vi.fn(),
  cacheDel: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

vi.mock('@/lib/auth/salesforce-oauth', () => ({
  refreshTokens: vi.fn(),
  revokeToken: vi.fn(),
}));

vi.mock('@/lib/auth/account-context', () => ({
  EMPTY_ACCOUNT_CONTEXT: { effectiveAccountId: '', companyName: '', webstoreId: '' },
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({ get: vi.fn(), set: vi.fn(), delete: vi.fn() }),
}));

// ── Imports (after mocks) ────────────────────────────────────────────────────
import { NextResponse } from 'next/server';
import { applySessionCookies } from '../lib/auth/session';
import type { Session } from '../lib/types';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    sid: 'test-sid-123',
    authMode: 'sso',
    federationId: '',
    username: 'buyer@example.com',
    role: null,
    user: { id: '005USER', firstName: 'Test', lastName: 'User', email: 'test@example.com', companyName: 'Test Co' },
    effectiveAccountId: '001ACCT',
    webstoreId: '0ZESTORE',
    customerType: 'DIRECT',
    csrf: 'csrf-token-value',
    sfAccessToken: 'access-token',
    sfRefreshToken: 'refresh-token',
    sfInstanceUrl: 'https://test.my.salesforce.com',
    createdAt: Date.now(),
    ...overrides,
  };
}

function redirectResponse() {
  return new NextResponse(null, { status: 302, headers: { Location: '/' } });
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('applySessionCookies — HTTPOnly cookie contract', () => {
  beforeEach(() => {
    mockConfig.isProd = false;
  });

  describe('httpOnly flag', () => {
    it('sets the session cookie as httpOnly so JS and XSS cannot read the session id', () => {
      const res = redirectResponse();
      applySessionCookies(res, makeSession());
      const cookie = res.cookies.get('on_session');
      expect(cookie, 'session cookie must be present').toBeDefined();
      expect(cookie!.httpOnly).toBe(true);
    });

    it('sets the CSRF cookie as NOT httpOnly so the browser can echo it in a request header', () => {
      const res = redirectResponse();
      applySessionCookies(res, makeSession());
      const cookie = res.cookies.get('on_csrf');
      expect(cookie, 'csrf cookie must be present').toBeDefined();
      expect(cookie!.httpOnly).toBe(false);
    });
  });

  describe('cookie values', () => {
    it('writes the session id into the session cookie', () => {
      const res = redirectResponse();
      applySessionCookies(res, makeSession({ sid: 'my-unique-sid' }));
      expect(res.cookies.get('on_session')!.value).toBe('my-unique-sid');
    });

    it('writes the csrf token into the csrf cookie', () => {
      const res = redirectResponse();
      applySessionCookies(res, makeSession({ csrf: 'my-csrf-token' }));
      expect(res.cookies.get('on_csrf')!.value).toBe('my-csrf-token');
    });
  });

  describe('sameSite', () => {
    it('sets sameSite=lax on the session cookie to block cross-site POST', () => {
      const res = redirectResponse();
      applySessionCookies(res, makeSession());
      expect(res.cookies.get('on_session')!.sameSite).toBe('lax');
    });

    it('sets sameSite=lax on the CSRF cookie', () => {
      const res = redirectResponse();
      applySessionCookies(res, makeSession());
      expect(res.cookies.get('on_csrf')!.sameSite).toBe('lax');
    });
  });

  describe('secure flag', () => {
    it('is NOT secure in dev so local http:// works (config.isProd = false)', () => {
      mockConfig.isProd = false;
      const res = redirectResponse();
      applySessionCookies(res, makeSession());
      expect(res.cookies.get('on_session')!.secure).toBe(false);
      expect(res.cookies.get('on_csrf')!.secure).toBe(false);
    });

    it('is secure in production so cookies only travel over HTTPS', () => {
      mockConfig.isProd = true;
      const res = redirectResponse();
      applySessionCookies(res, makeSession());
      expect(res.cookies.get('on_session')!.secure).toBe(true);
      expect(res.cookies.get('on_csrf')!.secure).toBe(true);
    });
  });

  describe('maxAge', () => {
    it('sets maxAge to 28800 seconds (8 hours) — matches the Connected App refresh-token policy', () => {
      const res = redirectResponse();
      applySessionCookies(res, makeSession());
      expect(res.cookies.get('on_session')!.maxAge).toBe(28800);
      expect(res.cookies.get('on_csrf')!.maxAge).toBe(28800);
    });
  });

  describe('return value', () => {
    it('returns the same response object it was passed', () => {
      const res = redirectResponse();
      const returned = applySessionCookies(res, makeSession());
      expect(returned).toBe(res);
    });
  });
});
