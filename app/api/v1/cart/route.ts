/** GET /api/v1/cart — active cart summary (delegates to Apex CCEB2B_CartController). */
import { handle } from '@/lib/route';
import { requireSession } from '@/lib/auth/session';
import { withSalesforce } from '@/lib/auth/with-salesforce';
import { salesforce } from '@/lib/salesforce-client';

export async function GET() {
  return handle('cart', async ({ correlationId }) => {
    const session = await requireSession();
    // The fixture/Apex response is already a RestResponse envelope — pass it through.
    return withSalesforce(
      session,
      (token, instanceUrl) => salesforce.getCart(token, instanceUrl, correlationId),
      correlationId,
    );
  });
}
