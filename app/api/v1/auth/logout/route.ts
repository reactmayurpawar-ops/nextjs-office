/**
 * POST /api/v1/auth/logout — ends all three sessions in play (plan §3.1, Option B cons).
 *
 * Three sessions exist after an Option B login: the BFF session (Redis + cookie), the
 * Experience Cloud site session, and the Azure B2C session. This route can only end the
 * first two directly, so it returns `logoutUrl` for the caller to navigate to — that
 * navigation drops the site session and cascades to B2C via the SAML config's single-logout
 * URL. Leaving the browser on this page would leave the user half logged out.
 *
 * Order matters: the BFF session is destroyed first so a failure in the (best-effort) token
 * revocation can never leave a live session behind.
 */
import { handle } from '@/lib/route';
import { ok } from '@/lib/types';
import { getSession, destroySession } from '@/lib/auth/session';
import { revokeToken, buildLogoutUrl } from '@/lib/auth/salesforce-oauth';
import { actorCredentials } from '@/lib/auth/identity';
import { logger } from '@/lib/logger';
import { getImpersonationAuditWriter } from '@/lib/auth/impersonation-audit';

export async function POST() {
  return handle('auth.logout', async ({ correlationId }) => {
    const session = await getSession();

    /**
     * Logging out mid-impersonation still has to clear the Salesforce marker, or the
     * buyer's Contact is left permanently flagged as being impersonated — which would
     * change downstream Apex behaviour for their next real login. Best-effort: never
     * block a logout on it.
     */
    if (session?.impersonation) {
      const state = session.impersonation;
      try {
        await getImpersonationAuditWriter().clearImpersonating({
          contactId: state.target.contactId,
          actorToken: state.actor.sfAccessToken,
          instanceUrl: state.actor.sfInstanceUrl,
          correlationId,
        });
      } catch (err) {
        logger.error('auth.logout', 'could not clear the impersonation marker', {
          correlationId,
          impersonationId: state.id,
          targetContactId: state.target.contactId,
          cause: err instanceof Error ? err.message : String(err),
        });
      }
      // The buyer's minted token dies with the session; revoke it so it cannot outlive it.
      if (session.sfAccessToken) await revokeToken(session.sfAccessToken, 'site');
    }

    await destroySession();

    // Revoke the REFRESH token: Salesforce revokes the whole grant (and its access tokens)
    // with it. Revoking only the access token would leave the refresh token able to mint
    // new ones after "logout". Fall back to the access token for non-refreshable sessions.
    //
    // Must be the ACTOR's grant. While impersonating, session.sfAccessToken belongs to the
    // buyer and sfRefreshToken is empty — revoking those would end the wrong thing and
    // leave the associate's own grant alive after they logged out.
    const actor = session ? actorCredentials(session) : null;
    const authority = session?.tokenAuthority ?? 'site';
    const tokenToRevoke = actor?.refreshToken || actor?.accessToken;
    // At the issuing host: a My Domain grant is not revocable at the community endpoint.
    const revoked = tokenToRevoke ? await revokeToken(tokenToRevoke, authority) : false;

    // Dev sessions have no upstream IdP session to end, so there is nowhere to send them.
    const logoutUrl = session?.authMode === 'sso' ? buildLogoutUrl(authority) : null;

    return ok({ loggedOut: true, revoked, logoutUrl });
  });
}
