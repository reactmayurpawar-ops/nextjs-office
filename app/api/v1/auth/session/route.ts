
/** GET /api/v1/auth/session — summary of the current session, or 401 if none. */
import { handle } from '@/lib/route';
import { ok } from '@/lib/types';
import { requireSession } from '@/lib/auth/session';
import { projectSession } from '@/lib/auth/session-projection';

export async function GET() {
  return handle('auth.session', async () => {
    const session = await requireSession();
    // One shared projection, so this payload and the associate routes' can never diverge
    // — and so there is a single place to test that no token escapes.
    return ok(projectSession(session));
  });
}
