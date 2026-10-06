/**
 * MSW handlers for the Salesforce Apex REST surface. Matches the `sf.mock` sentinel host
 * EXACTLY (not a wildcard) so real Salesforce calls on the same path are never intercepted
 * when a domain is switched to real (MOCK_MODE per-domain).
 */
import { http, HttpResponse } from 'msw';
import { MOCK_SF_BASE } from '../../lib/config';
import sfContext from '../fixtures/sf-context.json';
import cartSummary from '../fixtures/cart-summary.json';
import cartAdd from '../fixtures/cart-add.json';
import cmsFeaturedCategories from '../fixtures/cms-featured-categories.json';
import productDetails from '../fixtures/product-details.json';
import type { ProductContent } from '../../lib/catalog';

const productCatalog = productDetails as Record<string, ProductContent>;

export const sfHandlers = [
  http.get(`${MOCK_SF_BASE}/v1/context`, () => HttpResponse.json(sfContext)),
  http.get(`${MOCK_SF_BASE}/v1/cart`, () => HttpResponse.json(cartSummary)),
  http.post(`${MOCK_SF_BASE}/v1/cart/items`, () => HttpResponse.json(cartAdd)),
  http.get(`${MOCK_SF_BASE}/v1/products/:id`, ({ params }) => {
    const product = productCatalog[String(params.id)];
    if (!product) {
      return HttpResponse.json(
        {
          success: false,
          data: null,
          errorCode: 'PRODUCT_NOT_FOUND',
          errorMessage: 'Product not found',
          statusCode: 404,
        },
        { status: 404 },
      );
    }
    return HttpResponse.json({
      success: true,
      data: product,
      errorCode: null,
      errorMessage: null,
      statusCode: 200,
    });
  }),
  // Salesforce CMS managed-content collection (emulates B2B_ManagedContentController).
  http.get(`${MOCK_SF_BASE}/v1/cms/collections/:collectionKey`, () =>
    HttpResponse.json(cmsFeaturedCategories),
  ),
];