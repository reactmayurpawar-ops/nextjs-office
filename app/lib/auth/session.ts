
/**
 * Server-side session management. The session (Salesforce tokens, effective account, CSRF
 * secret) lives in Redis/ioredis-mock keyed by an HttpOnly cookie — route handlers are
 * stateless, so nothing is kept in process memory. The browser never holds a token.
 *
 * Also owns the short-lived OAuth login state (PKCE verifier + `state`), which must survive
 * the redirect to Salesforce/B2C and back but must not outlive it.
 *
 * Node runtime only (uses next/headers cookies()).
 */
import { cookies } from 'next/headers';
import type { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { config, SESSION_COOKIE, CSRF_COOKIE } from '../config';
import { cacheSetJson, cacheGetJson, cacheGetDelJson, cacheDel } from '../cache';
import {
  refreshTokens,
  revokeToken,
  type SalesforceIdentity,
  type SalesforceTokenSet,
} from './salesforce-oauth';
import { EMPTY_ACCOUNT_CONTEXT, type AccountContext } from './account-context';
import { logger } from '../logger';
import type { Persona, Session } from '../types';

const SESSION_TTL_SECONDS = 60 * 60 * 8; // 8h — matches the Connected App refresh-token policy
/** 10m — one redirect round-trip, no more. Also the login-binding cookie's max age. */
export const LOGIN_STATE_TTL_SECONDS = 60 * 10;

function sessionKey(sid: string) {
  return `sess:${sid}`;
}

function loginStateKey(state: string) {
  return `oauth:state:${state}`;
}

/** In-flight login, held between /auth/login and /auth/callback. */
export interface LoginState {
  codeVerifier: string;
  /** Relative path to return the browser to; always validated before it is stored. */
  returnTo: string;
  /**
   * Which host this login was started against. Parked here because the callback has to
   * exchange the code at the SAME authorization server, and the callback URL is identical
   * for both — nothing else in the request says which one issued the code.
   */
  authority: 'site' | 'mydomain';
  createdAt: number;
}

export async function storeLoginState(state: string, value: LoginState): Promise<void> {
  await cacheSetJson(loginStateKey(state), value, LOGIN_STATE_TTL_SECONDS);
}

/**
 * Single-use read. Atomic (GETDEL) rather than GET-then-DEL: two callbacks racing on the
 * same state must not both succeed, and a non-atomic pair leaves exactly that window open.
 */
export async function consumeLoginState(state: string): Promise<LoginState | null> {
  return cacheGetDelJson<LoginState>(loginStateKey(state));
}

/** The two cookies a session needs, as plain specs so either delivery path can apply them. */
function sessionCookieSpecs(session: Session) {
  const secure = config.isProd;
  const base = { sameSite: 'lax' as const, secure, path: '/', maxAge: SESSION_TTL_SECONDS };
  return [
    { name: SESSION_COOKIE, value: session.sid, options: { ...base, httpOnly: true } },
    // Double-submit CSRF cookie: readable by the browser so it can echo it back in a header.
    { name: CSRF_COOKIE, value: session.csrf, options: { ...base, httpOnly: false } },
  ];
}

/**
 * Apply session cookies to a specific response. Required for redirect responses: a route
 * handler that returns its own NextResponse must carry the Set-Cookie headers on that
 * object rather than relying on the request-scoped cookie jar being merged into it.
 */
export function applySessionCookies(res: NextResponse, session: Session): NextResponse {
  for (const c of sessionCookieSpecs(session)) {
    res.cookies.set({ ...c.options, name: c.name, value: c.value });
  }
  return res;
}

/** Apply session cookies via the request-scoped jar — for handlers returning JSON. */
async function setSessionCookies(session: Session): Promise<void> {
  const jar = await cookies();
  for (const c of sessionCookieSpecs(session)) {
    jar.set(c.name, c.value, c.options);
  }
}

/** Seconds left of this session's original 8h lifetime; at least 1 so the write lands. */
function remainingTtlSeconds(session: Session): number {
  const elapsed = Math.floor((Date.now() - session.createdAt) / 1000);
  return Math.max(1, SESSION_TTL_SECONDS - elapsed);
}

async function persist(session: Session, ttlSeconds = SESSION_TTL_SECONDS): Promise<void> {
  await cacheSetJson(sessionKey(session.sid), session, ttlSeconds);
}

/** Create a session for a mock persona (dev-login), set cookies, return it. */
export async function createSession(persona: Persona): Promise<Session> {
  const session: Session = {
    sid: randomUUID(),
    authMode: 'dev',
    federationId: persona.federationId,
    personaId: persona.id,
    role: persona.role,
    user: persona.user,
    effectiveAccountId: persona.effectiveAccountId,
    webstoreId: persona.webstoreId,
    customerType: persona.customerType,
    csrf: randomUUID(),
    sfAccessToken: '',
    sfRefreshToken: '',
    sfInstanceUrl: '',
    createdAt: Date.now(),
  };
  await persist(session);
  await setSessionCookies(session);
  return session;
}

/**
 * Create a session from a completed Option B login. A fresh `sid` is minted on every login
 * (session fixation defence, plan §3.6).
 *
 * `account` carries the buyer's scope, resolved server-side from Salesforce (see
 * ./account-context). It is passed in rather than read from the token because it is
 * Salesforce state, not an identity claim — and never taken from the browser.
 *
 * `role` stays null until Phase 2: it is a permission fact, and guessing one here would
 * hand the wrong UI to partner and associate users.
 */
export async function createSsoSession(
  tokens: SalesforceTokenSet,
  identity: SalesforceIdentity,
  account: AccountContext = EMPTY_ACCOUNT_CONTEXT,
  tokenAuthority: 'site' | 'mydomain' = 'site',
): Promise<Session> {
  const session: Session = {
    sid: randomUUID(),
    authMode: 'sso',
    // Salesforce's `username` is NOT the FederationIdentifier — the SAML config matches on
    // FederationIdentifier (DerivedUserID, `.b2b`-suffixed) but the identity resource does
    // not return it. Left blank rather than mislabelled; resolved by the Apex /v1/context
    // endpoint in Phase 2.
    federationId: '',
    username: identity.username,
    // Role is a Salesforce permission fact, not an identity claim. Guessing 'cso' here
    // would silently grant the wrong UI to partner and associate users.
    role: null,
    user: {
      id: identity.userId,
      firstName: identity.firstName,
      lastName: identity.lastName,
      email: identity.email,
      companyName: account.companyName,
    },
    effectiveAccountId: account.effectiveAccountId,
    webstoreId: account.webstoreId,
    customerType: '',
    csrf: randomUUID(),
    sfAccessToken: tokens.accessToken,
    sfRefreshToken: tokens.refreshToken,
    sfInstanceUrl: tokens.instanceUrl,
    // Recorded so refresh and revoke go back to the host that issued these tokens.
    tokenAuthority,
    createdAt: Date.now(),
  };
  await persist(session);
  // Deliberately does NOT set cookies: the callback returns a redirect and applies them
  // to that response via applySessionCookies.
  return session;
}

export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  const sid = jar.get(SESSION_COOKIE)?.value;
  if (!sid) return null;
  const session = await cacheGetJson<Session>(sessionKey(sid));
  if (!session) return null;
  /**
   * Impersonation expiry is enforced here, not in the associate routes, because this is
   * the one function every authenticated route goes through. Enforcing it at the read
   * makes the cap universal with zero route churn — a route added next year gets it free.
   */
  if (session.impersonation && Date.now() > session.impersonation.expiresAt) {
    await expireImpersonation(session);
    /**
     * Restore the session, then REFUSE the request that discovered the expiry.
     *
     * Returning the restored session here would run the current handler under the
     * associate's identity using a request the caller composed while acting as the buyer —
     * an "add to cart" click a second after the countdown ends would hit the associate's
     * own cart. Silently changing whose data a mutation touches is worse than an error, so
     * the caller gets a distinct code and reloads under one identity or the other.
     */
    const err = new Error('Your customer session expired. Reload to continue.') as Error & {
      statusCode?: number;
    };
    err.statusCode = 440;
    throw err;
  }
  return session;
}

/**
 * Drop an impersonation that has outlived its cap, restoring the associate's own identity.
 *
 * The local restore happens first and cannot fail; the Salesforce audit-field clear is
 * fired afterwards as best-effort. Deliberately does NOT rotate the session id: getSession
 * runs on read paths that have no business setting cookies, and the stale sid now maps to
 * the actor's own identity, which is the safe direction for it to be wrong in.
 */
async function expireImpersonation(session: Session): Promise<Session> {
  const state = session.impersonation!;
  const restored: Session = { ...session, ...state.actor, impersonation: undefined };
  await persist(restored, remainingTtlSeconds(restored));
  // The buyer token outlives the episode otherwise; it is the credential, not the session.
  void revokeToken(session.sfAccessToken).catch(() => {});
  logger.info('associate.impersonation', 'impersonation expired', {
    impersonationId: state.id,
    actorUserId: state.actor.user.id,
    targetUserId: state.target.userId,
    sid: session.sid,
  });
  void clearImpersonationAudit(state, restored);
  return restored;
}

/**
 * Best-effort clear of the Salesforce audit field after an expiry. Never throws: an
 * expired session must not be revivable by a failing Salesforce write, and the BFF audit
 * line above already records that the episode ended.
 */
async function clearImpersonationAudit(
  state: NonNullable<Session['impersonation']>,
  restored: Session,
): Promise<void> {
  try {
    const { getImpersonationAuditWriter } = await import('./impersonation-audit');
    await getImpersonationAuditWriter().clearImpersonating({
      contactId: state.target.contactId,
      actorToken: restored.sfAccessToken,
      instanceUrl: restored.sfInstanceUrl,
    });
  } catch (err) {
    logger.error('associate.impersonation', 'audit clear failed after expiry', {
      impersonationId: state.id,
      targetContactId: state.target.contactId,
      cause: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Persist an in-place mutation of an existing session.
 *
 * Deliberately narrow rather than a generic `updateSession`: it always writes against the
 * session's ORIGINAL absolute expiry and never touches cookies, which are the two
 * properties every in-place mutation in this codebase needs and the two that are easiest
 * to get wrong. Same guarantee refreshSessionTokens has always relied on.
 */
export async function saveSession(next: Session): Promise<Session> {
  await persist(next, remainingTtlSeconds(next));
  return next;
}

/**
 * Mint a new session id and CSRF token for an existing session, and re-issue both cookies.
 *
 * Called when the session's *effective identity* changes — impersonation start and end.
 * That is a privilege change rather than an escalation, so this is not strictly a fixation
 * defence; the invariant it buys is "one sid = exactly one effective identity", which is
 * what keeps the audit log unambiguous and, concretely, stops lib/idempotency.ts (scoped
 * on `${session.sid}`) from replaying a pre-impersonation cached result back to a caller.
 *
 * For handlers returning JSON only — it uses the request-scoped cookie jar.
 */
export async function rotateSessionIdentity(session: Session): Promise<Session> {
  const previousSid = session.sid;
  const rotated: Session = { ...session, sid: randomUUID(), csrf: randomUUID() };
  await persist(rotated, remainingTtlSeconds(rotated));
  await cacheDel(sessionKey(previousSid));
  await setSessionCookies(rotated);
  return rotated;
}

/** Throwing accessor for routes that require auth. */
export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) {
    const err = new Error('No active session') as Error & { statusCode?: number };
    err.statusCode = 401;
    throw err;
  }
  return session;
}

/**
 * Refresh the Salesforce tokens on an existing session, in place. Salesforce does not
 * reissue a refresh token on this grant, so the original is carried forward.
 *
 * Returns the updated session, or null when the session cannot be refreshed (dev sessions
 * and sessions with no refresh token) — callers should treat null as "re-login required".
 */
export async function refreshSessionTokens(session: Session): Promise<Session | null> {
  if (session.authMode !== 'sso' || !session.sfRefreshToken) return null;

  // Back to the host that issued it — see the note on Session.tokenAuthority.
  const tokens = await refreshTokens(session.sfRefreshToken, session.tokenAuthority ?? 'site');
  const updated: Session = {
    ...session,
    sfAccessToken: tokens.accessToken,
    // Salesforce does not reissue a refresh token on this grant, so carry the original.
    sfRefreshToken: tokens.refreshToken || session.sfRefreshToken,
    sfInstanceUrl: tokens.instanceUrl || session.sfInstanceUrl,
  };
  // Persist against the session's ORIGINAL absolute expiry. Re-persisting with a full TTL
  // would let a token-bearing Redis record outlive the browser cookie that authorises it.
  return saveSession(updated);
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const sid = jar.get(SESSION_COOKIE)?.value;
  if (sid) await cacheDel(sessionKey(sid));
  jar.delete(SESSION_COOKIE);
  jar.delete(CSRF_COOKIE);
}
