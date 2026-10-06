 * MSW Node server — intercepts OUTBOUND calls the BFF clients make to the sf.mock /
 * emb.mock sentinel hosts. Started from instrumentation.ts at server boot when any
 * domain is mocked, and reused directly by Vitest.
 *
 * HMR-safe: the instance is pinned to globalThis. Next.js hot-rebuilds re-evaluate this
 * module, and a second `setupServer(...)` would construct a NEW interceptor that detaches
 * the one `instrumentation.register()` already started — leaving sf.mock/emb.mock calls
 * unintercepted (→ "fetch failed" → circuit breaker opens) until a full server restart.
 * Reusing the singleton keeps interception alive across rebuilds.
 */
import { setupServer } from 'msw/node';
import { handlers } from './index';

type MswServer = ReturnType<typeof setupServer>;

const globalForMsw = globalThis as typeof globalThis & {
  __onMswServer?: MswServer;
};

export const server: MswServer = globalForMsw.__onMswServer ?? setupServer(...handlers);
globalForMsw.__onMswServer = server;

/**
 * Re-assert interception. A Next.js hot-rebuild resets the global fetch and detaches the
 * interceptor; close() drops the stale patch and listen() re-applies it to the current
 * global. Cheap and idempotent — safe to call before each upstream request in dev.
 */
export function ensureMockServerListening(): void {
  server.close();
  server.listen({ onUnhandledRequest: 'bypass' });
}