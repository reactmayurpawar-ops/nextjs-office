/**
 * GET /api/v1/associate/targets?q=&limit= — customers this associate may act as.
 *
 * Returns ineligible matches too, each with its reason. Showing *why* a customer cannot be
 * selected is what makes the picker supportable — the alternative is a silently short list
 * and a support ticket asking why someone is missing.
 */
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { handle } from '@/lib/route';
import { ok, fail } from '@/lib/types';
import { requireSession } from '@/lib/auth/session';
import {
  getAssociateDirectory,
  INELIGIBLE_MESSAGES,
  SCOPE_POLICY_ID,
} from '@/lib/auth/associate-directory';

const QuerySchema = z.object({
  // Minimum 3 characters: no "list every buyer in the org" by sending an empty term.
  q: z.string().trim().min(3).max(80),
  limit: z.coerce.number().int().min(1).max(25).default(10),
});

export async function GET(req: NextRequest) {
  return handle('associate.targets', async ({ correlationId }) => {
    const session = await requireSession();

    // An impersonated session must not be able to pivot to a third identity.
    if (session.impersonation) {
      return fail(
        'ALREADY_IMPERSONATING',
        'End the current customer session before choosing another.',
        409,
      );
    }

    const parsed = QuerySchema.safeParse({
      q: req.nextUrl.searchParams.get('q') ?? '',
      limit: req.nextUrl.searchParams.get('limit') ?? undefined,
    });
    if (!parsed.success) {
      return fail('INVALID_QUERY', 'Enter at least 3 characters to search.', 400);
    }

    const directory = getAssociateDirectory();
    if (!(await directory.canImpersonate(session, correlationId))) {
      return fail(
        'NOT_AN_ASSOCIATE',
        'You do not have permission to act on behalf of customers.',
        403,
      );
    }

    const found = await directory.search(session, parsed.data.q, parsed.data.limit, correlationId);

    // Scope is part of eligibility, so the picker can never offer a customer that the
    // start route would then refuse.
    const targets = found.map((t) => ({
      ...t,
      reason: t.eligible ? undefined : INELIGIBLE_MESSAGES[t.ineligibleReason!],
    }));

    return ok({
      policy: SCOPE_POLICY_ID,
      targets: targets.map((t) => ({
        userId: t.userId,
        name: t.name,
        username: t.username,
        accountName: t.accountName,
        eligible: t.eligible,
        reason: t.reason,
      })),
    });
  });
}