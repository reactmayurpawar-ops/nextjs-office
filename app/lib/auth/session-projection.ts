
/**
 * The only thing the browser is allowed to learn about a session.
 *
 * Single function on purpose: the session route, the associate routes and the context
 * resolver all go through it, so there is exactly one place to audit for token leakage and
 * exactly one place a test has to walk. Hand-assembling this payload from `session.user`
 * would also get the actor wrong whenever impersonation is active.
 */
import type { Role, Session } from '../types';
import { actorIdentity } from './identity';

export interface ClientImpersonation {
  active: true;
  /** The real associate — name only. Never their tokens, never their federation id. */
  actor: { name: string; email: string };
  target: { userId: string; name: string; accountName: string };
  policy: string;
  startedAt: number;
  expiresAt: number;
}

export interface ClientSession {
  authMode: Session['authMode'];
  federationId: string;
  role: Role | null;
  user: Session['user'];
  effectiveAccountId: string;
  webstoreId: string;
  impersonation: ClientImpersonation | null;
}

export function projectSession(session: Session): ClientSession {
  const state = session.impersonation;
  const actor = actorIdentity(session);

  return {
    authMode: session.authMode,
    federationId: session.federationId,
    role: session.role,
    user: session.user,
    effectiveAccountId: session.effectiveAccountId,
    webstoreId: session.webstoreId,
    impersonation: state
      ? {
          active: true,
          actor: { name: actor.name, email: actor.email },
          target: {
            userId: state.target.userId,
            name: state.target.name,
            accountName: state.target.accountName,
          },
          policy: state.policy,
          startedAt: state.startedAt,
          expiresAt: state.expiresAt,
        }
      : null,
  };
}
