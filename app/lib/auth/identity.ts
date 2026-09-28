/**
 * Which human is which, on a session that may be impersonating.
 *
 * `Session.user` is the EFFECTIVE identity — the buyer, while impersonation is active.
 * That is what every commerce route wants (the cart belongs to the buyer), but it is the
 * wrong answer for attribution, and reading the wrong one fails silently. These accessors
 * exist so "who is performing this action" has an obvious, greppable answer.
 *
 * Framework-agnostic: pure functions over a Session, no next/* imports.
 */
import type { ActorSnapshot, Session, Persona } from '../types';

export interface ActorIdentity {
  userId: string;
  username: string;
  name: string;
  email: string;
}

export function isImpersonating(session: Session): boolean {
  return session.impersonation !== undefined;
}

/**
 * The human actually driving the request — the signed-in associate when impersonating,
 * otherwise the signed-in user. Use this for audit lines, and for any Salesforce write
 * that should be attributed to the real person (notably the impersonation audit field,
 * whose ContactHistory row is the only place Salesforce records the true actor).
 */
export function actorIdentity(session: Session): ActorIdentity {
  const actor = session.impersonation?.actor;
  const user = actor?.user ?? session.user;
  return {
    userId: user.id,
    username: (actor ? actor.username : session.username) ?? '',
    name: `${user.firstName} ${user.lastName}`.trim(),
    email: user.email,
  };
}

/** Who the request is being made *for*. Identical to the actor on a normal session. */
export function effectiveIdentity(session: Session): Persona['user'] {
  return session.user;
}

/**
 * The credentials that belong to the actor, as opposed to whatever token the session is
 * currently calling Salesforce with. While impersonating, `session.sfAccessToken` is the
 * buyer's; this returns the associate's own grant — which is what the Contact audit write
 * and the logout revoke must use.
 */
export function actorCredentials(session: Session): {
  accessToken: string;
  refreshToken: string;
  instanceUrl: string;
} {
  const actor = session.impersonation?.actor;
  return {
    accessToken: actor?.sfAccessToken ?? session.sfAccessToken,
    refreshToken: actor?.sfRefreshToken ?? session.sfRefreshToken,
    instanceUrl: actor?.sfInstanceUrl ?? session.sfInstanceUrl,
  };
}

/** Snapshot the fields impersonation swaps out, so ending it is a pure restore. */
export function snapshotActor(session: Session): ActorSnapshot {
  return {
    federationId: session.federationId,
    username: session.username,
    role: session.role,
    user: session.user,
    effectiveAccountId: session.effectiveAccountId,
    webstoreId: session.webstoreId,
    customerType: session.customerType,
    sfAccessToken: session.sfAccessToken,
    sfRefreshToken: session.sfRefreshToken,
    sfInstanceUrl: session.sfInstanceUrl,
  };
}