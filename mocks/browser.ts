/**
 * MSW browser worker — available for component/Storybook work that calls endpoints not
 * yet implemented in the BFF. For the normal app the React UI calls same-origin /api/v1
 * routes which run for real and hit the MSW *Node* server (see mocks/server.ts), so this
 * worker is inert against implemented routes (onUnhandledRequest: 'bypass').
 *
 * Requires public/mockServiceWorker.js (generated via `npx msw init public/`).
 */
import { setupWorker } from 'msw/browser';
import { handlers } from './index';

export const worker = setupWorker(...handlers);