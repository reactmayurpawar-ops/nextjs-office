// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { parseMockMode, findProdErpTargets, ConfigError } from '../lib/config';

describe('MOCK_MODE parsing (fail-closed)', () => {
  it('defaults to all-mocked in development when unset', () => {
    const m = parseMockMode(undefined, false);
    expect(m.all).toBe(true);
  });

  it('defaults to all-real in PRODUCTION when unset (fail-closed)', () => {
    const m = parseMockMode(undefined, true);
    expect(m.none).toBe(true);
    expect(m.all).toBe(false);
  });

  it('treats a comma list as the REAL domains, mocking the rest', () => {
    const m = parseMockMode('cart,checkout', false);
    expect(m.all).toBe(false);
    expect(m.none).toBe(false);
    expect(m.realDomains.has('cart')).toBe(true);
    expect(m.realDomains.has('checkout')).toBe(true);
    expect(m.realDomains.has('orders')).toBe(false);
  });

  it('parses explicit off', () => {
    expect(parseMockMode('off', false).none).toBe(true);
  });

  it('throws on an unknown domain rather than silently degrading', () => {
    expect(() => parseMockMode('not-a-domain', false)).toThrow(ConfigError);
  });
});

describe('production ERP guard', () => {
  it('flags a production base URL or stage by name', () => {
    expect(
      findProdErpTargets([
        ['P21_BASE_URL', 'https://kz3.execute-api.us-east-1.amazonaws.com'],
        ['P21_STAGE', 'Prod'],
        ['R12_STAGE', 'Test'],
      ]),
    ).toEqual(['P21_STAGE']);
  });

  it('ignores empty values so an unconfigured gateway is not an offender', () => {
    expect(findProdErpTargets([['R12_BASE_URL', '']])).toEqual([]);
  });

  it('matches case-insensitively, since stages are spelled Prod/prod/PROD', () => {
    expect(findProdErpTargets([['P21_STAGE', 'PRODUCTION']])).toEqual(['P21_STAGE']);
  });
});
