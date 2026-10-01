/**
 * GET /api/v1/cms/featured-categories — homepage "Featured Categories" grid data.
 *
 * Emulates the Salesforce CMS path: fetches the managed-content collection via the
 * Salesforce client (intercepted by MSW in mock mode) and normalizes it with the same
 * filter/map/sort/slice the supply-site LWC uses. Public content — no session required.
 */
import { handle } from '@/lib/route';
import { ok } from '@/lib/types';
import { salesforce } from '@/lib/salesforce-client';
import { normalizeFeaturedCategories } from '@/lib/cms';

const COLLECTION_KEY = 'Featured_Categories';

export async function GET() {
  return handle('cms.featured-categories', async ({ correlationId }) => {
    const collection = await salesforce.getManagedContentCollection(COLLECTION_KEY, correlationId);
    return ok(normalizeFeaturedCategories(collection));
  });
}
