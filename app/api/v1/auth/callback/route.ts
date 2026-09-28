/**
 * GET /api/v1/auth/callback — completes the Option B login (plan §"Option B", steps 9-13).
 *
 * By the time Salesforce redirects here the browser already holds a site session (created
 * during the SAML leg), so finishing the code exchange leaves the user with both sessions:
 * the site session renders Experience Cloud pages, our cookie powers the React pages.
 *
 * Failures redirect back to the app with an error code rather than rendering raw JSON at a
 * URL the user was navigated to. Detail is logged server-side only — an OAuth callback is
 * an unauthenticated endpoint and must not narrate why it rejected something.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { CORRELATION_HEADER, LOGIN_STATE_COOKIE } from '@/lib/config';
import { exchangeCodeForTokens, fetchIdentity } from '@/lib/auth/salesforce-oauth';
import { applySessionCookies, consumeLoginState, createSsoSession } from '@/lib/auth/session';
import { resolveAccountContext } from '@/lib/auth/account-context';
import { logger } from '@/lib/logger';

/** One `auth_error` code per leg, so the banner and the log agree on where it broke. */
const STEP_ERROR_CODES = {
  'token-exchange': 'exchange_failed',
  identity: 'identity_failed',
  'account-context': 'context_failed',
  session: 'session_failed',
} as const;

function finish(to: URL, correlationId: string) {
  const res = NextResponse.redirect(to, { status: 302 });
  // The login is over either way — drop the binding cookie so it cannot be reused.
  res.cookies.delete(LOGIN_STATE_COOKIE);
  res.headers.set(CORRELATION_HEADER, correlationId);
  res.headers.set('Cache-Control', 'no-store');
  return res;
}

function redirectWithError(req: NextRequest, code: string, correlationId: string) {
  const url = new URL('/', req.nextUrl.origin);
  url.searchParams.set('auth_error', code);
  return finish(url, correlationId);
}

export async function GET(req: NextRequest) {
  const correlationId = req.headers.get(CORRELATION_HEADER) ?? crypto.randomUUID();
  const params = req.nextUrl.searchParams;

  // Salesforce reports a refused authorization in-band.
  const oauthError = params.get('error');
  if (oauthError) {
    logger.error(
      'auth.callback',
      `IdP returned error: ${oauthError} ${params.get('error_description') ?? ''}`,
      { correlationId },
    );
    return redirectWithError(req, 'idp_error', correlationId);
  }

  const code = params.get('code');
  const state = params.get('state');
  if (!code || !state) {
    logger.error('auth.callback', 'callback missing code or state', { correlationId });
    return redirectWithError(req, 'invalid_request', correlationId);
  }

  // The state must match the cookie set when THIS browser started the login. Checking the
  // server-side store alone would accept a login started by someone else: an attacker could
  // run their own login and hand the victim the resulting callback URL, landing the
  // attacker's Salesforce identity inside the victim's session (login CSRF).
  const boundState = req.cookies.get(LOGIN_STATE_COOKIE)?.value;
  if (!boundState || boundState !== state) {
    logger.error('auth.callback', 'state does not match the login cookie for this browser', {
      correlationId,
    });
    return redirectWithError(req, 'invalid_state', correlationId);
  }

  // Single-use: a replayed callback finds nothing here even inside the TTL.
  const loginState = await consumeLoginState(state);
  if (!loginState) {
    logger.error('auth.callback', 'unknown, expired, or replayed state', { correlationId });
    return redirectWithError(req, 'invalid_state', correlationId);
  }

  // Each leg reports its own failure code. Collapsing all four into `exchange_failed` meant
  // a developer on another machine could not tell a blocked network from a bad secret from a
  // dead Redis without adding logging first — which is exactly when they can least afford to.
  let step: 'token-exchange' | 'identity' | 'account-context' | 'session' = 'token-exchange';

  try {
    logger.info('auth.callback', 'exchanging authorization code', { correlationId });
    // Same host that issued the code. `authority` is absent on a login started before
    // this field existed; those were all site logins.
    const authority = loginState.authority ?? 'site';
    const tokens = await exchangeCodeForTokens(code, loginState.codeVerifier, authority);

    step = 'identity';
    const identity = await fetchIdentity(tokens);

    // An authenticated session with no user id is worse than no session — it would scope
    // every downstream Salesforce call to nobody. Refuse it rather than persist it.
    if (!identity.userId || !identity.username) {
      logger.error('auth.callback', 'identity response missing user_id/username', {
        correlationId,
      });
      return redirectWithError(req, 'identity_incomplete', correlationId);
    }

    // Loud, but not fatal: whether Partner/Customer Community users get a refresh token here
    // is still unverified against the sandbox. A silently absent one turns into mystery
    // logouts weeks later, so surface it — but do not block the POC login on it.
    if (!tokens.refreshToken) {
      logger.error(
        'auth.callback',
        'no refresh_token returned — this session cannot be refreshed; check the Connected App scopes and the site OAuth settings',
        { correlationId },
      );
    }

    step = 'account-context';
    const account = await resolveAccountContext(
      tokens.instanceUrl,
      tokens.accessToken,
      identity.userId,
      correlationId,
    );

    step = 'session';
    const session = await createSsoSession(tokens, identity, account, authority);

    logger.info('auth.callback', 'session established', {
      correlationId,
      // Identifiers only — never the tokens.
      userId: identity.userId,
      hasRefreshToken: Boolean(tokens.refreshToken),
      effectiveAccountId: account.effectiveAccountId || '(unresolved)',
      webstoreId: account.webstoreId || '(unresolved)',
    });

    const res = finish(new URL(loginState.returnTo, req.nextUrl.origin), correlationId);
    // Set-Cookie must ride on THIS response — see applySessionCookies.
    applySessionCookies(res, session);
    return res;
  } catch (e) {
    const code = STEP_ERROR_CODES[step];
    logger.error('auth.callback', `login failed at the ${step} step: ${(e as Error).message}`, {
      correlationId,
      step,
      authError: code,
      // The stack names the module that actually threw, which matters for `session` — a
      // Redis failure and a cookie failure look identical from the message alone.
      stack: (e as Error).stack?.split('\n').slice(0, 4).join(' | '),
    });
    return redirectWithError(req, code, correlationId);
  }
}