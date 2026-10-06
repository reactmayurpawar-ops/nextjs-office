/**
 * MSW handler for EMB pricing/inventory (sentinel host `emb.mock`).
 * Returns the normalized shape, filtered to the SKUs the caller requested so the mock
 * behaves like a real bulk lookup. Search lives in ./emb-products.ts, which mocks EMB's
 * own wire format rather than ours.
 */
import { http, HttpResponse } from 'msw';
import { MOCK_EMB_BASE } from '../../lib/config';
import pricingInventory from '../fixtures/pricing-inventory.json';
import type { EmbProduct } from '../../lib/types';

const catalog = pricingInventory.products as Record<string, EmbProduct>;

export const embHandlers = [
  http.post(`${MOCK_EMB_BASE}/pricing-inventory`, async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as { skus?: string[] };
    const skus = body.skus ?? Object.keys(catalog);

    const products: Record<string, EmbProduct> = {};
    for (const sku of skus) {
      products[sku] = catalog[sku] ?? {
        available: false,
        quantity: 0,
        price: null,
        discontinued: null,
        backOrderable: false,
        message: 'Unknown item',
        locations: [],
      };
    }

    return HttpResponse.json({
      success: true,
      currencyCode: pricingInventory.currencyCode,
      products,
    });
  }),
];
