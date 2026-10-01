/**
 * GET /api/v1/products/{id} — product detail.
 *
 * Content comes from EMB rather than from Salesforce directly. EMB assembles the document
 * from five parallel SOQL queries with its own credentials, so this is one hop instead of
 * several per-user Salesforce calls on a page view — and it keeps the PDP consistent with
 * the PLP, which is already served from the same service.
 *
 * Pricing is not fetched here. It comes from the ERP gateways, which cannot be asked until
 * this call has returned the SKU and its ordering source, so doing it inline made the two
 * upstreams strictly serial: ~980 ms of EMB followed by ~1440 ms of P21, with the page
 * showing nothing for the sum of both even though its text was ready after the first. The
 * browser now fetches pricing separately against /api/v1/pricing-inventory and fills it in.
 */
import type { NextRequest } from 'next/server';
import { handle } from '@/lib/route';
import { fail, ok } from '@/lib/types';
import { requireSession } from '@/lib/auth/session';
import { emb } from '@/lib/emb-client';
import { parseProductId, unpricedDetail } from '@/lib/catalog';

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  return handle('products.id', async ({ correlationId }) => {
    await requireSession();
    const id = parseProductId((await context.params).id);

    const content = await emb.getProduct(id, correlationId);
    if (!content) {
      return fail('PRODUCT_NOT_FOUND', 'Product not found', 404);
    }

    return ok(unpricedDetail(content));
  });
}
