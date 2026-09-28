// @vitest-environment node
/**
 * Option B login-flow guards. These cover the parts that are security-relevant and cheap to
 * get subtly wrong: the PKCE derivation, the open-redirect filter on `returnTo`, and the
 * single-use property of the OAuth `state`.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createHash } from 'node:crypto';

// config is imported transitively; pin the env so these never depend on .env.local.
process.env.MOCK_MODE = 'on';

import { createPkcePair, createStateToken } from '../lib/auth/salesforce-oauth';
import { safeReturnTo as rawSafeReturnTo } from '../app/api/v1/auth/login/route';

const ORIGIN = 'http://localhost:3000';
const safeReturnTo = (raw: string | null) => rawSafeReturnTo(raw, ORIGIN);

function base64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

describe('PKCE', () => {
  it('derives the challenge as base64url(SHA-256(verifier))', () => {
    const { verifier, challenge } = createPkcePair();
    expect(challenge).toBe(base64url(createHash('sha256').update(verifier).digest()));
  });

  it('emits URL-safe values with no base64 padding', () => {
    const { verifier, challenge } = createPkcePair();
    for (const v of [verifier, challenge]) {
      expect(v).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });

  it('meets the RFC 7636 verifier length range (43-128 chars)', () => {
    const { verifier } = createPkcePair();
    expect(verifier.length).toBeGreaterThanOrEqual(43);
    expect(verifier.length).toBeLessThanOrEqual(128);
  });

  it('never repeats a verifier or a state token', () => {
    const verifiers = new Set(Array.from({ length: 50 }, () => createPkcePair().verifier));
    const states = new Set(Array.from({ length: 50 }, () => createStateToken()));
    expect(verifiers.size).toBe(50);
    expect(states.size).toBe(50);
  });
});

describe('safeReturnTo (open-redirect guard)', () => {
  it('keeps ordinary relative paths', () => {
    expect(safeReturnTo('/product/ABC-123')).toBe('/product/ABC-123');
    expect(safeReturnTo('/search?q=coil&page=2')).toBe('/search?q=coil&page=2');
  });

  it('falls back to / when absent', () => {
    expect(safeReturnTo(null)).toBe('/');
    expect(safeReturnTo('')).toBe('/');
  });

  it.each([
    ['absolute http', 'http://evil.example/steal'],
    ['absolute https', 'https://evil.example/steal'],
    ['protocol-relative', '//evil.example/steal'],
    ['backslash-normalised', '/\\evil.example'],
    ['javascript scheme', 'javascript:alert(1)'],
  ])('rejects %s', (_label, input) => {
    expect(safeReturnTo(input)).toBe('/');
  });
});

describe('login state is single-use', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('returns the state once, then never again', async () => {
    const { storeLoginState, consumeLoginState } = await import('../lib/auth/session');
    const state = createStateToken();

    await storeLoginState(state, {
      codeVerifier: 'verifier-abc',
      returnTo: '/product/X',
      authority: 'site',
      createdAt: Date.now(),
    });

    const first = await consumeLoginState(state);
    expect(first?.codeVerifier).toBe('verifier-abc');
    expect(first?.returnTo).toBe('/product/X');

    // A replayed callback must find nothing.
    expect(await consumeLoginState(state)).toBeNull();
  });

  it('returns null for a state that was never issued', async () => {
    const { consumeLoginState } = await import('../lib/auth/session');
    expect(await consumeLoginState('never-issued')).toBeNull();
  });

  it('lets exactly one of two concurrent callbacks win the same state', async () => {
    const { storeLoginState, consumeLoginState } = await import('../lib/auth/session');
    const state = createStateToken();
    await storeLoginState(state, {
      codeVerifier: 'v',
      returnTo: '/',
      authority: 'site',
      createdAt: Date.now(),
    });

    // Non-atomic GET-then-DEL would let both of these read the value.
    const results = await Promise.all([consumeLoginState(state), consumeLoginState(state)]);

    expect(results.filter(Boolean)).toHaveLength(1);
  });
});
