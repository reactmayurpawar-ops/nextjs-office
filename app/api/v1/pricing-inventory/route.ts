/**
 * POST /api/v1/pricing-inventory — bulk pricing + inventory from the ERP gateways.
 * Body: { skus: string[], locationId? }. Validated and CSRF-protected; each upstream call
 * has its own timeout, retry and circuit breaker.
 *
 * A bare SKU list has no ordering source, so both gateways are asked and each answers for
 * the items it recognises. Callers that already know the source — the listing and detail
 * pages, which fetch pricing from the browser after the catalogue call — pass `sources` so
 * each SKU only reaches the gateway that owns it.
 */
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { handle } from '@/lib/route';
import { ok } from '@/lib/types';
import { requireSession } from '@/lib/auth/session';
import { assertCsrf } from '@/lib/auth/csrf';
import { parseJson } from '@/lib/validation';
import { pricing, resolveErpIdentity } from '@/lib/erp-pricing';

const PricingSchema = z.object({
  skus: z.array(z.string().min(1)).min(1).max(200),
  locationId: z.string().optional(),
  /** Optional per-SKU routing hint, so a caller that knows the owner can skip the other. */
  sources: z.record(z.string(), z.array(z.enum(['P21', 'R12']))).optional(),
});

export async function POST(req: NextRequest) {
  return handle('pricing-inventory', async ({ correlationId }) => {
    const session = await requireSession();
    assertCsrf(session, req);
    const body = await parseJson(req, PricingSchema);

    /**
     * With no routing hint every SKU goes to both gateways, which is the only correct thing
     * to do with a bare list — each answers for what it recognises. When the caller does know
     * the owner, honour it: asking R12 for a part is a wasted round trip against a real ERP.
     */
    const { sources } = body;
    const owns = (sku: string, gateway: 'P21' | 'R12') =>
      !sources || !sources[sku] ? true : sources[sku].includes(gateway);

    const result = await pricing.forSkus(
      body.skus.filter((sku) => owns(sku, 'P21')),
      body.skus.filter((sku) => owns(sku, 'R12')),
      resolveErpIdentity(session),
      correlationId,
    );
    return ok(result);
  });
}