/**
 * POST /api/v1/auth/dev-login — mock-mode auth bypass. Mints a fake server session for a
 * developer persona and sets the session + CSRF cookies. Hard-gated: only when dev-login is
 * allowed (never in production unless ALLOW_DEV_LOGIN=true) AND the auth domain is mocked.
 * The real Option B login (GET /api/v1/auth/login → the Source site → Azure B2C) replaces
 * this when MOCK_MODE=off.
 */
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { handle } from '@/lib/route';
import { ok, fail } from '@/lib/types';
import { isDomainMocked, config } from '@/lib/config';
import { getPersona } from '@/lib/auth/personas';
import { createSession } from '@/lib/auth/session';
import { parseJson } from '@/lib/validation';

const DevLoginSchema = z.object({
  persona: z.enum(['cso', 'dso', 'csa']).optional(),
});

export async function POST(req: NextRequest) {
  return handle('auth.dev-login', async () => {
    if (!config.allowDevLogin || !isDomainMocked('auth')) {
      return fail('DEV_LOGIN_DISABLED', 'dev-login is not available in this environment', 403);
    }
    const body = await parseJson(req, DevLoginSchema);
    const persona = getPersona(body.persona ?? config.devPersona);
    const session = await createSession(persona);
    return ok({
      federationId: session.federationId,
      role: session.role,
      user: session.user,
      effectiveAccountId: session.effectiveAccountId,
      webstoreId: session.webstoreId,
      csrf: session.csrf,
    });
  });
}









