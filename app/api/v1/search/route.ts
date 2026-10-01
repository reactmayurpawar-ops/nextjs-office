import type { NextRequest } from 'next/server';
import { handle } from '@/lib/route';
import { ok } from '@/lib/types';
import { config } from '@/lib/config';
import { requireSession } from '@/lib/auth/session';
import { assertCsrf } from '@/lib/auth/csrf';
import { parseJson } from '@/lib/validation';
import { asSearchRequest, SearchRequestSchema } from '@/lib/catalog';
import { emb } from '@/lib/emb-client';

export async function POST(req: NextRequest) {
  return handle('search', async ({ correlationId }) => {
    const session = await requireSession();
    assertCsrf(session, req);
    const body = asSearchRequest(await parseJson(req, SearchRequestSchema));

    const result = await emb.search({
      request: body,
      context: {
        /**
         * Coveo mints a search token per identity and caches it, so this has to be stable
         * for a given user or every request pays a fresh mint. The federation id is the
         * durable one — the Salesforce user id is absent on dev-login sessions.
         */
        user: {
          id: session.federationId || session.user.id,
          email: session.user.email,
        },
        trackingId: config.embTrackingId,
        currency: config.embCurrency,
        language: config.embLanguage,
        country: config.embCountry,
      },
      correlationId,
    });

    /**
     * Results are returned unpriced, and the browser fetches pricing separately against
     * /api/v1/pricing-inventory.
     *
     * The two calls are strictly serial when done here — search cannot start pricing until it
     * knows the SKUs — so merging server-side made every listing wait for the slower of the
     * two upstreams before rendering anything. Measured, that was ~570 ms of search plus
     * ~1440 ms of P21 for a page whose text was ready after the first. The products carry
     * `price: null` until the second call lands.
     */
    return ok(result);
  });
}




