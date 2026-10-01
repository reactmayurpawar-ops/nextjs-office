/**
 * POST   /api/v1/associate/impersonate  — start acting as a customer
 * DELETE /api/v1/associate/impersonate  — stop
 *
 * The session is swapped server-side, in place. The browser's cookie is reissued (the sid
 * rotates so "one sid = one effective identity" holds) but it never sees a token, and the
 * user never re-logs in.
 *
 * proxy.ts matches /api/:path* so both verbs already get the origin allowlist and the
 * double-submit CSRF check — DELETE is not in its SAFE_METHODS. These paths must NOT be
 * added to its CSRF_EXEMPT set.
 */
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { handle } from '@/lib/route';
import { ok, fail } from '@/lib/types';
import { requireSession } from '@/lib/auth/session';
import { assertCsrf } from '@/lib/auth/csrf';
import { parseJson } from '@/lib/validation';
import { SF_ID } from '@/lib/auth/salesforce-query';
import { ImpersonationError, startImpersonation, endImpersonation } from '@/lib/auth/impersonation';
import { ImpersonationMintError } from '@/lib/auth/jwt-bearer';
import { projectSession } from '@/lib/auth/session-projection';

const StartSchema = z.object({
  /**
   * Keyed on the User, not the Contact as the legacy Apex was. The JWT `sub` is a
   * Username, which hangs off User; going via Contact adds a hop and is ambiguous when a
   * Contact has more than one User.
   */
  targetUserId: z.string().regex(SF_ID, 'Not a Salesforce id'),
  /** Business justification, carried into the audit line. */
  reason: z.string().trim().max(200).optional(),
});

export async function POST(req: NextRequest) {
  return handle('associate.impersonate', async ({ correlationId }) => {
    const session = await requireSession();
    assertCsrf(session, req);
    const body = await parseJson(req, StartSchema);

    try {
      const next = await startImpersonation({
        session,
        targetUserId: body.targetUserId,
        reason: body.reason,
        correlationId,
      });
      // The csrf token is echoed because it just rotated: the client needs it before it
      // can read the refreshed cookie without racing its own next request.
      return ok({ ...projectSession(next), csrf: next.csrf });
    } catch (err) {
      // handle() derives one error code per route from the ref, so the distinct codes the
      // UI branches on have to be returned rather than thrown.
      // Mint failures carry their own codes — TARGET_NOT_PREAUTHORIZED is a 403 the caller
      // can act on, a key/audience mismatch is a 502 they cannot. Collapsing both into the
      // route's generic code would throw that distinction away.
      if (err instanceof ImpersonationError || err instanceof ImpersonationMintError) {
        return fail(err.errorCode, err.message, err.statusCode);
      }
      throw err;
    }
  });
}

export async function DELETE(req: NextRequest) {
  return handle('associate.impersonate', async ({ correlationId }) => {
    const session = await requireSession();
    assertCsrf(session, req);

    const result = await endImpersonation({ session, correlationId });
    return ok({
      ...projectSession(result.session),
      ended: result.ended,
      /** False means the Salesforce marker is stale; the session ended regardless. */
      auditCleared: result.auditCleared,
      csrf: result.session.csrf,
    });
  });
}



