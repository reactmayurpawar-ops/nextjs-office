/**
 * GET /api/v1/context — the server-managed user/contact/effective-account/webstore
 * context. Identity comes from the session (not the browser); permissions are enriched
 * from Salesforce. Replaces the implicit Experience Cloud context.
 */
import { handle } from '@/lib/route';
import { ok } from '@/lib/types';
import { requireSession } from '@/lib/auth/session';
import { resolveContext } from '@/lib/context';

export async function GET() {
  return handle('context', async ({ correlationId }) => {
    const session = await requireSession();
    return ok(await resolveContext(session, correlationId));
  });
}