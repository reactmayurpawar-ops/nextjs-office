 * MSW handlers for the two ERP pricing gateways (sentinel hosts `p21.mock` / `r12.mock`).
 *
 * Like the search mock, these speak the gateways' own wire format rather than our
 * normalized shape, so `lib/erp-pricing-adapter.ts` is exercised on the mocked path too.
 * That matters more here than anywhere else: the real request shapes are deeply nested,
 * numbers arrive as strings, booleans arrive as "Y"/"N", and P21 changes both its request
 * verb and its response key depending on how many items you ask for.
 *
 * The underlying data is reused from the normalized pricing fixture and projected back into
 * each gateway's format, so there is still only one source of truth for the numbers.
 */
import { http, HttpResponse } from 'msw';
import { MOCK_P21_BASE, MOCK_R12_BASE } from '../../lib/config';
import pricingInventory from '../fixtures/pricing-inventory.json';
import type { EmbProduct } from '../../lib/types';

const catalog = pricingInventory.products as Record<string, EmbProduct>;

interface ItemRequest {
  itemNumber?: string;
}

function requestedItems(body: unknown, path: string[]): string[] {
  let node: unknown = body;
  for (const segment of path) {
    node = (node as Record<string, unknown>)?.[segment];
  }
  return Array.isArray(node)
    ? (node as ItemRequest[]).map((i) => i?.itemNumber).filter((s): s is string => Boolean(s))
    : [];
}

export const pricingHandlers = [
  // P21 — parts. Price and availability in one call.
  http.post(
    `${MOCK_P21_BASE}/:stage/YEXT/catalog/parts/priceandavailability`,
    async ({ request }) => {
      const body = await request.json().catch(() => null);
      const items = requestedItems(body, ['onHand', 'data', 'items']);
      const detail =
        (
          (body as Record<string, never>)?.onHand as unknown as {
            control?: { requestType?: string };
          }
        )?.control?.requestType === 'DETAIL';

      const mapped = items
        .filter((sku) => catalog[sku])
        .map((sku) => {
          const product = catalog[sku];
          return {
            itemNumber: sku,
            // Numbers are strings on the wire — this is what the adapter has to coerce.
            qty: String(product.quantity ?? 0),
            unitPrice: product.price === null ? '' : String(product.price),
            discontinued: product.discontinued ? 'Y' : 'N',
            sellable: product.backOrderable ? 'Y' : 'N',
            identification: [{ application: 'P21' }],
            ...(detail
              ? {
                  quantityPrice: (product.locations ?? []).map((loc) => ({
                    orgCode: loc.orgCode,
                    rank: loc.rank,
                    qty: String(loc.qty),
                    unitPrice: product.price === null ? '' : String(product.price),
                    discontinued: 'N',
                  })),
                }
              : {}),
          };
        });

      return HttpResponse.json({
        body: {
          onHand: {
            control: {
              partnerCode: 'YEXT',
              status: [
                { application: 'P21', code: 'SUCCESS', message: 'Request Processed Successfully' },
              ],
            },
            // SUMMARY answers under `items`, DETAIL under `ItemDetail`.
            data: detail ? { ItemDetail: mapped } : { items: mapped },
          },
        },
      });
    },
  ),

  // R12 — equipment. Price and availability are separate endpoints.
  http.post(
    `${MOCK_R12_BASE}/:stage/YEXT/catalog/:account/equipmentPricing`,
    async ({ request }) => {
      const body = await request.json().catch(() => null);
      const items = requestedItems(body, ['priceRequest', 'data', 'items']);
      return HttpResponse.json({
        priceResponse: {
          data: {
            items: items
              .filter((sku) => catalog[sku])
              .map((sku) => ({
                itemNumber: sku,
                unitPrice: catalog[sku].price === null ? '' : String(catalog[sku].price),
                uom: 'EA',
                quantity: '1',
                currencyCode: 'USD',
              })),
          },
        },
      });
    },
  ),

  http.post(`${MOCK_R12_BASE}/:stage/YEXT/catalog/:account/onHand`, async ({ request }) => {
    const body = await request.json().catch(() => null);
    const items = requestedItems(body, ['onHand', 'data', 'items']);
    return HttpResponse.json({
      onHand: {
        data: {
          items: items
            .filter((sku) => catalog[sku])
            .map((sku) => ({
              itemNumber: sku,
              quantity: (catalog[sku].locations ?? []).map((loc) => ({
                orgCode: loc.orgCode,
                rank: loc.rank,
                qty: String(loc.qty),
              })),
            })),
        },
      },
    });
  }),
];