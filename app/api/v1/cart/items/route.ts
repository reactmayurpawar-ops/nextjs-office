/**
 * POST /api/v1/cart/items — add an item (delegates to Apex CCEB2B_AddToCartAPI).
 * Validates input, enforces session-bound CSRF, supports idempotency keys, and injects the
 * authoritative effectiveAccountId / webstore / user from the session — browser-supplied
 * account/cart-ownership values are never trusted (migration plan §3.3).
 */
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { handle } from '@/lib/route';
import { requireSession } from '@/lib/auth/session';
import { withSalesforce } from '@/lib/auth/with-salesforce';
import { assertCsrf } from '@/lib/auth/csrf';
import { parseJson } from '@/lib/validation';
import { withIdempotency } from '@/lib/idempotency';
import { salesforce } from '@/lib/salesforce-client';

const AddItemSchema = z.object({
  lineitems: z
    .array(
      z.object({
        itemnumber: z.string().min(1),
        quantity: z.union([z.string(), z.number()]),
        locationId: z.string().min(1),
        price: z.union([z.string(), z.number()]).optional(),
      }),
    )
    .min(1)
    .max(100),
});

export async function POST(req: NextRequest) {
  return handle('cart.items', async ({ correlationId }) => {
    const session = await requireSession();
    assertCsrf(session, req);
    const body = await parseJson(req, AddItemSchema);

    const payload = {
      ...body,
      userid: session.user.id,
      effectiveAccountId: session.effectiveAccountId,
      storename: session.webstoreId,
    };

    return withIdempotency(req, `cart-add:${session.sid}`, () =>
      withSalesforce(
        session,
        (token, instanceUrl) => salesforce.addCartItem(token, instanceUrl, payload, correlationId),
        correlationId,
      ),
    );
  });
}
