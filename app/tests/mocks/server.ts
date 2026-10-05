/**
 * MSW Node server for unit/component tests.
 *
 * Used in Vitest (Node environment). The browser service worker
 * (public/mockServiceWorker.js) is for browser-based dev/E2E — this file
 * is the server-side equivalent used purely during test runs.
 *
 * Usage in test files:
 *   import { server } from './mocks/server';
 *   beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
 *   afterEach(() => server.resetHandlers());   // clean up per-test overrides
 *   afterAll(() => server.close());
 */
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);
