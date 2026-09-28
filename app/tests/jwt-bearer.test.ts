// @vitest-environment node
/**
 * The assertion claims, and the error mapping.
 *
 * Two of these assertions exist because the obvious guess is wrong: `sub` is the target's
 * Username, not their FederationIdentifier (every other identity path in this codebase
 * uses the federation id), and `aud` is the Experience site URL, not login.salesforce.com
 * (which is what Salesforce's general JWT-bearer docs say). Getting either wrong produces
 * an opaque `invalid_grant` that is very hard to read backwards.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { generateKeyPairSync, createVerify } from 'node:crypto';

const SITE = 'https://pcdigires.comfortsite.com';
let publicKey: string;

beforeAll(() => {
  const pair = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  publicKey = pair.publicKey;

  process.env.MOCK_MODE = 'off';
  process.env.SF_SITE_BASE_URL = SITE;
  process.env.SF_JWT_CLIENT_ID = 'consumer-key-123';
  process.env.SF_JWT_PRIVATE_KEY_BASE64 = Buffer.from(pair.privateKey).toString('base64');
  process.env.SF_NETWORK_ID = '0DB4w000000TPPzGAO';
});

function decode(part: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
}

describe('buildAssertion', () => {
  it('signs an RS256 JWT whose signature verifies against the public key', async () => {
    const { buildAssertion } = await import('../lib/auth/jwt-bearer');
    const jwt = buildAssertion('buyer@example.com');
    const [header, payload, signature] = jwt.split('.');

    expect(decode(header)).toEqual({ alg: 'RS256', typ: 'JWT' });

    const verifier = createVerify('RSA-SHA256');
    verifier.update(`${header}.${payload}`);
    verifier.end();
    expect(verifier.verify(publicKey, Buffer.from(signature, 'base64url'))).toBe(true);
  });

  it('uses the Username as `sub`, NOT the federation id', async () => {
    const { buildAssertion } = await import('../lib/auth/jwt-bearer');
    const claims = decode(buildAssertion('riddhi.debnath@contractor.example.com').split('.')[1]);
    expect(claims.sub).toBe('riddhi.debnath@contractor.example.com');
    expect(String(claims.sub)).not.toMatch(/\.b2b$/);
  });

  it('uses the Experience site URL as `aud`, not login.salesforce.com', async () => {
    const { buildAssertion } = await import('../lib/auth/jwt-bearer');
    const claims = decode(buildAssertion('buyer@example.com').split('.')[1]);
    expect(claims.aud).toBe(SITE);
    expect(claims.aud).not.toBe('https://login.salesforce.com');
  });

  it('keeps the lifetime inside the 5 minute cap Salesforce enforces', async () => {
    const { buildAssertion } = await import('../lib/auth/jwt-bearer');
    const claims = decode(buildAssertion('buyer@example.com').split('.')[1]);
    expect(Number(claims.exp) - Number(claims.iat)).toBeLessThanOrEqual(300);
    expect(Number(claims.exp) - Number(claims.iat)).toBeGreaterThan(0);
  });

  it('gives every assertion a unique jti so Salesforce can detect replay', async () => {
    const { buildAssertion } = await import('../lib/auth/jwt-bearer');
    const a = decode(buildAssertion('buyer@example.com').split('.')[1]);
    const b = decode(buildAssertion('buyer@example.com').split('.')[1]);
    expect(a.jti).not.toBe(b.jti);
  });

  it('issues the assertion from the impersonation app, not the login app', async () => {
    const { buildAssertion } = await import('../lib/auth/jwt-bearer');
    const claims = decode(buildAssertion('buyer@example.com').split('.')[1]);
    expect(claims.iss).toBe('consumer-key-123');
  });
});

describe('mint error classification', () => {
  /**
   * Salesforce answers `invalid_grant` for nearly everything, so the split between "this
   * target / this org's config" (403, the caller can act) and "our config" (502, they
   * can't) is carried entirely by the description text.
   */
  const cases: Array<[string, string, number]> = [
    ["user hasn't approved this consumer", 'TARGET_NOT_PREAUTHORIZED', 403],
    ['invalid signature', 'IMPERSONATION_KEY_MISMATCH', 502],
    ['invalid audience', 'IMPERSONATION_AUDIENCE', 502],
    ['user is inactive', 'TARGET_NOT_ELIGIBLE', 403],
    ['issued in the future', 'IMPERSONATION_ASSERTION', 502],
    ['something nobody has seen before', 'IMPERSONATION_MINT_FAILED', 502],
  ];

  it.each(cases)('maps %j to %s (%i)', async (description, errorCode, statusCode) => {
    const mod = await import('../lib/auth/jwt-bearer');
    // classifyMintError is internal; exercise it through a stubbed token response.
    const globalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ error: 'invalid_grant', error_description: description }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      })) as typeof fetch;

    try {
      await mod.getUserTokenMinter().mintFor('buyer@example.com');
      throw new Error('expected the mint to fail');
    } catch (err) {
      const e = err as { errorCode?: string; statusCode?: number };
      expect(e.errorCode).toBe(errorCode);
      expect(e.statusCode).toBe(statusCode);
    } finally {
      globalThis.fetch = globalFetch;
    }
  });
});
