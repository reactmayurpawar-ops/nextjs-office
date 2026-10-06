/**
 * The single shared MSW handler array. Imported by both mocks/server.ts (BFF + tests)
 * and mocks/browser.ts (frontend / Storybook) so every consumer shares one mock
 * definition — fix a mock once, everything benefits.
 */
import { sfHandlers } from './handlers/sf';
import { embHandlers } from './handlers/emb';
import { embProductsHandlers } from './handlers/emb-products';
import { pricingHandlers } from './handlers/pricing';

export const handlers = [...sfHandlers, ...embHandlers, ...embProductsHandlers, ...pricingHandlers];
