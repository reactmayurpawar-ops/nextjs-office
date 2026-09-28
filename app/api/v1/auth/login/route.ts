
/**
 * GET /api/v1/auth/login — starts the Option B login (plan §"Option B", steps 1-2).
 *
 * Mints a `state` + PKCE pair, parks them server-side, and redirects the browser to the
 * Source Experience site's authorize endpoint. Salesforce delegates to Azure B2C from
 * there, so this one redirect ends with both a site session and an auth code for us.
 *
 * GET-with-side-effects is correct here: it is a top-level browser navigation, not a
 * state-changing API call, and it is the only way an OAuth redirect flow can begin.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { handle } from '@/lib/route';
import { fail } from '@/lib/types';
import { config, isDomainMocked, CORRELATION_HEADER, LOGIN_STATE_COOKIE } from '@/lib/config';
import {
  buildAuthorizeUrl,
  createPkcePair,
  createStateToken,
  type TokenAuthority,
} from '@/lib/auth/salesforce-oauth';
import { storeLoginState, LOGIN_STATE_TTL_SECONDS } from '@/lib/auth/session';
import { logger } from '@/lib/logger';

/**
 * Reduce `returnTo` to a same-origin path, or '/'.
 *
 * Do NOT do this with string prefix checks. The URL parser strips tab/newline characters
 * before resolving, so `/%09/evil.example` decodes to `/<TAB>/evil.example`, survives any
 * `startsWith('//')` test, and then resolves to `https://evil.example/`. The only reliable
 * test is to resolve the candidate and compare the resulting origin.
 */
export function safeReturnTo(raw: string | null, origin: string): string {
  if (!raw) return '/';
  try {
    const resolved = new URL(raw, origin);
    if (resolved.origin !== new URL(origin).origin) return '/';
    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
  } catch {
    return '/';
  }
}

/**
 * Which authorization server to send the browser to.
 *
 * `?as=associate` targets My Domain, because internal employees CANNOT authenticate
 * through the Experience site: its SAML config appends `.b2b` to the incoming identity via
 * DerivedUserID, so an associate whose federation id is `irfzjs` resolves to `irfzjs.b2b`
 * and matches no user. My Domain runs the org's ordinary employee SSO with no such
 * transform. Everyone else — buyers — keeps the site host, which is also what gives them
 * an Experience Cloud session as a side effect.
 */
function authorityFor(req: NextRequest): TokenAuthority {
  return req.nextUrl.searchParams.get('as') === 'associate' ? 'mydomain' : 'site';
}

export async function GET(req: NextRequest) {
  // Mock mode has no real IdP to talk to; dev-login is the supported path there.
  if (isDomainMocked('auth')) {
    return handle('auth.login', async () =>
      fail(
        'AUTH_MOCKED',
        'The auth domain is mocked. POST /api/v1/auth/dev-login instead, or start with MOCK_MODE=off.',
        400,
      ),
    );
  }

  const correlationId = req.headers.get(CORRELATION_HEADER) ?? crypto.randomUUID();

  try {
    const state = createStateToken();
    const { verifier, challenge } = createPkcePair();
    const returnTo = safeReturnTo(req.nextUrl.searchParams.get('returnTo'), req.nextUrl.origin);
    const authority = authorityFor(req);

    // Park the verifier AND the authority before redirecting: the callback cannot complete
    // without the verifier, and cannot pick the right token endpoint without the authority
    // (the redirect_uri is identical for both hosts, so nothing else tells them apart).
    await storeLoginState(state, {
      codeVerifier: verifier,
      returnTo,
      authority,
      createdAt: Date.now(),
    });

    const authorizeUrl = buildAuthorizeUrl(state, challenge, authority);
    logger.info('auth.login', 'redirecting to authorize endpoint', { correlationId, authority });

    const res = NextResponse.redirect(authorizeUrl, { status: 302 });

    // Bind this login to THIS browser. Without it the server-side state is global: an
    // attacker could start a login, hand the victim the resulting callback URL, and land
    // their own Salesforce identity inside the victim's session (login CSRF / fixation).
    res.cookies.set({
      name: LOGIN_STATE_COOKIE,
      value: state,
      httpOnly: true,
      sameSite: 'lax',
      secure: config.isProd,
      path: '/',
      maxAge: LOGIN_STATE_TTL_SECONDS,
    });

    res.headers.set(CORRELATION_HEADER, correlationId);
    // An authorize redirect must never be cached — the state is single-use.
    res.headers.set('Cache-Control', 'no-store');
    return res;
  } catch (e) {
    const err = e as Error & { statusCode?: number };
    logger.error('auth.login', err.message, { correlationId });
    // Outside production, name the missing config — it is the fastest way to fix setup.
    // In production this endpoint is unauthenticated, so say nothing specific.
    const message = config.isProd ? 'Unable to start login' : err.message;
    return handle('auth.login', async () =>
      fail('LOGIN_START_FAILED', message, err.statusCode ?? 500),
    );
  }
}