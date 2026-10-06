/**
 * MSW handler for EMB's `POST /products` (sentinel host `emb.mock`).
 *
 * This mock speaks EMB's *wire* format — Coveo-shaped, from a fixture captured verbatim
 * off the live dev service — rather than our own SearchResponse. That is the whole point:
 * it means `lib/emb-search-adapter.ts` runs on the mocked path too, so the mapping is
 * exercised by every test, by `MOCK_MODE=on` dev, and by e2e. A mock that spoke our
 * contract would leave the most error-prone module in the stack completely uncovered.
 *
 * The filtering below is a small search engine rather than a canned response, because the
 * behaviours worth testing are behaviours over a result set: facet narrowing, pagination
 * arithmetic, and empty states.
 */
import { http, HttpResponse } from 'msw';
import { MOCK_EMB_BASE } from '../../lib/config';
import fixture from '../fixtures/emb-products.json';
import productDetails from '../fixtures/emb-product-details.json';

type Product = Record<string, unknown>;
type FacetValue = {
  value: string;
  numberOfResults?: number;
  state?: string;
  children?: FacetValue[];
};
type Facet = {
  facetId: string;
  field?: string;
  type?: string;
  displayName?: string;
  values: FacetValue[];
};

const PRODUCTS = fixture.products as Product[];
const DETAILS = productDetails as Record<string, unknown>;
const FACETS = fixture.facets as Facet[];

interface RequestedFacet {
  facetId: string;
  values?: Array<{ value?: string; state?: string }>;
}

function text(product: Product): string {
  const extra = (product.additionalFields ?? {}) as Record<string, unknown>;
  return [
    product.ec_name,
    product.ec_description,
    product.ec_product_id,
    extra.ec_ts_tt_end_user_description__c,
  ]
    .filter((v): v is string => typeof v === 'string')
    .join(' ')
    .toLowerCase();
}

/**
 * `@uri` is the match-all the adapter sends for a blank query (Coveo field-existence
 * syntax); anything else is an AND over terms.
 */
function matchesQuery(product: Product, q: string): boolean {
  if (!q || q.startsWith('@')) return true;
  const haystack = text(product);
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => haystack.includes(term));
}

/** Mirrors the adapter: a category id is the full pipe path of the deepest breadcrumb. */
function categoryPaths(product: Product): string[] {
  return Array.isArray(product.ec_category)
    ? (product.ec_category as unknown[]).filter((p): p is string => typeof p === 'string')
    : [];
}

function fieldValue(product: Product, facetId: string): string[] {
  if (facetId === 'ec_category') return categoryPaths(product);
  const extra = (product.additionalFields ?? {}) as Record<string, unknown>;
  const raw = extra[facetId] ?? product[facetId];
  if (Array.isArray(raw)) return raw.filter((v): v is string => typeof v === 'string');
  return typeof raw === 'string' ? [raw] : [];
}

function matchesFacets(product: Product, requested: RequestedFacet[]): boolean {
  return requested.every((facet) => {
    const selected = (facet.values ?? [])
      .filter((v) => v.state === 'selected')
      .map((v) => v.value)
      .filter((v): v is string => Boolean(v));
    if (!selected.length) return true;
    const actual = fieldValue(product, facet.facetId);
    // A category selection matches the branch it names and everything beneath it.
    if (facet.facetId === 'ec_category') {
      return selected.some((sel) => actual.some((a) => a === sel || a.startsWith(`${sel}|`)));
    }
    return selected.some((sel) => actual.includes(sel));
  });
}

export const embProductsHandlers = [
  /**
   * Detail, captured verbatim from the live service. Unknown SKUs 404 rather than being
   * synthesized: the PDP's not-found path is worth exercising, and search and detail are now
   * served by the same upstream, so a SKU on the PLP will be present here for real.
   */
  http.get(`${MOCK_EMB_BASE}/getProduct`, ({ request }) => {
    const id = new URL(request.url).searchParams.get('productId') ?? '';
    const product = DETAILS[id];
    if (!product) {
      return HttpResponse.json(
        { error: { code: 'not_found', message: `Product not found: ${id}` } },
        { status: 404 },
      );
    }
    return HttpResponse.json(product);
  }),

  http.post(`${MOCK_EMB_BASE}/products`, async ({ request }) => {
    const body = (await request.json().catch(() => null)) as {
      q?: string;
      options?: { page?: { current?: number; perPage?: number }; facets?: RequestedFacet[] };
    } | null;
    if (!body) return HttpResponse.json({ message: 'Invalid search request' }, { status: 400 });

    const requested = body.options?.facets ?? [];
    const current = body.options?.page?.current ?? 0;
    const perPage = body.options?.page?.perPage ?? 10;

    const matched = PRODUCTS.filter(
      (p) => matchesQuery(p, body.q ?? '') && matchesFacets(p, requested),
    );
    const start = current * perPage;
    const page = matched.slice(start, start + perPage);

    /**
     * Counts are recomputed over the *matched* set, which is what Coveo does — selecting a
     * facet narrows the options offered by the others. The retired mock counted over the
     * pre-filter set, so this is a real behaviour change, not a mock simplification.
     */
    const facets = FACETS.map((facet) => ({
      ...facet,
      values: facet.values
        .map((value) => ({
          ...value,
          numberOfResults: matched.filter((p) =>
            facet.facetId === 'ec_category'
              ? fieldValue(p, facet.facetId).some(
                  (a) => a === value.value || a.startsWith(`${value.value}|`),
                )
              : fieldValue(p, facet.facetId).includes(value.value),
          ).length,
          state: requested
            .find((r) => r.facetId === facet.facetId)
            ?.values?.some((v) => v.value === value.value && v.state === 'selected')
            ? 'selected'
            : 'idle',
        }))
        .filter((value) => value.numberOfResults > 0 || value.state === 'selected'),
    }));

    return HttpResponse.json({
      responseId: 'mock-response-id',
      products: page,
      facets,
      pagination: {
        page: current,
        perPage,
        totalEntries: matched.length,
        totalPages: Math.ceil(matched.length / perPage),
        totalProducts: matched.length,
        totalSpotlightContent: 0,
      },
      sort: {
        appliedSort: { sortCriteria: 'relevance' },
        availableSorts: [{ sortCriteria: 'relevance' }],
      },
    });
  }),
];