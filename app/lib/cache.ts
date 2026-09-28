
/**
 * Redis access. Uses a real Redis (ioredis) only when a REDIS_URL is set AND we are
 * not fully mocked; otherwise falls back to an in-process ioredis-mock so local dev
 * needs zero external services (see docs/HEADLESS_LOCAL_DEV_SETUP.md §9).
 *
 * Node runtime only — do not import from edge code (proxy.ts).
 */
import IORedis from 'ioredis';
import RedisMock from 'ioredis-mock';
import { config } from './config';
import { logger } from './logger';

type RedisLike = Pick<IORedis, 'get' | 'set' | 'del' | 'expire' | 'getdel'>;

/**
 * Pinned to globalThis, not a module-level `let`.
 *
 * In dev, route handlers are compiled into separate module graphs, so a module-scoped
 * singleton is re-created per route — which gives each route its own ioredis-mock and its
 * own data. That silently breaks anything written by one request and read by another: the
 * OAuth login/callback pair is exactly that shape, and it fails as a bogus "invalid_state"
 * rather than as an obvious cache miss. globalThis is shared across those graphs.
 */
const globalCache = globalThis as typeof globalThis & { __bffCache?: RedisLike };

export function getCache(): RedisLike {
  if (globalCache.__bffCache) return globalCache.__bffCache;
  if (config.redisUrl && !config.mock.all) {
    logger.info('cache', 'using real Redis', { url: config.redisUrl });
    globalCache.__bffCache = new IORedis(config.redisUrl);
  } else {
    logger.info('cache', 'using in-memory ioredis-mock (single process only)');
    globalCache.__bffCache = new RedisMock() as unknown as RedisLike;
  }
  return globalCache.__bffCache;
}

/** Store JSON with a TTL (seconds). */
export async function cacheSetJson(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  await getCache().set(key, JSON.stringify(value), 'EX', ttlSeconds);
}

export async function cacheGetJson<T>(key: string): Promise<T | null> {
  const raw = await getCache().get(key);
  return raw ? (JSON.parse(raw) as T) : null;
}

export async function cacheDel(key: string): Promise<void> {
  await getCache().del(key);
}

/**
 * Atomic read-and-delete (Redis GETDEL, 6.2+). Used for single-use values such as the OAuth
 * login state, where a separate GET then DEL would let two concurrent callbacks both read
 * the value before either deletion lands.
 */
export async function cacheGetDelJson<T>(key: string): Promise<T | null> {
  const raw = await getCache().getdel(key);
  return raw ? (JSON.parse(raw) as T) : null;
}
