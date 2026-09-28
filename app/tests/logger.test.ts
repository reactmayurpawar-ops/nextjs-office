// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { logger } from '../lib/logger';
import { bodySnippet, describeResponse, diagnoseFetchFailure } from '../lib/net-diagnostics';

/**
 * The logger now writes to a file that developers attach to messages and paste into tickets,
 * so "what ends up on disk" is a contract, not an implementation detail.
 */
function capture(fn: () => void): Record<string, unknown> {
  const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
  const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  fn();
  const line = (spy.mock.calls[0]?.[0] ?? errSpy.mock.calls[0]?.[0]) as string;
  return JSON.parse(line) as Record<string, unknown>;
}

afterEach(() => vi.restoreAllMocks());

describe('redaction', () => {
  it('masks a secret-named value but keeps its length', () => {
    // The length is the diagnostic: it answers "missing, truncated, or the wrong app's?"
    const meta = capture(() => logger.info('t', 'm', { clientSecret: 'super-secret-value' }))
      .meta as Record<string, unknown>;
    expect(meta.clientSecret).toBe('[redacted:18 chars]');
  });

  it('masks strings nested under a secret-named key, whatever the leaf is called', () => {
    const meta = capture(() =>
      logger.info('t', 'm', { credentials: { value: 'abcdef', note: 'x' } }),
    ).meta as Record<string, { value: string; note: string }>;
    expect(meta.credentials.value).toBe('[redacted:6 chars]');
    expect(meta.credentials.note).toBe('[redacted:1 chars]');
  });

  it('still lets a deliberate non-string descriptor through', () => {
    // /api/v1/auth/doctor reports `clientSecret: { set, length }` on purpose — masking the
    // whole object would delete the one thing that check exists to report.
    const meta = capture(() => logger.info('t', 'm', { clientSecret: { set: true, length: 64 } }))
      .meta as Record<string, { set: boolean; length: number }>;
    expect(meta.clientSecret).toEqual({ set: true, length: 64 });
  });

  /**
   * The impersonation signing key is the most dangerous value this process holds — it can
   * mint a token for any pre-authorized user. It matched none of the original patterns:
   * `api[-_]?key` requires the `api` prefix, so `privateKey` sailed straight through.
   */
  it.each(['privateKey', 'sfJwtPrivateKeyBase64', 'pem', 'signingKey', 'frontdoorUrl'])(
    'masks %s',
    (key) => {
      const meta = capture(() => logger.info('t', 'm', { [key]: 'MIIEvQIBADANBgkq' }))
        .meta as Record<string, unknown>;
      expect(meta[key]).toBe('[redacted:16 chars]');
    },
  );

  it('reports an absent secret as empty rather than as a zero-length redaction', () => {
    const meta = capture(() => logger.info('t', 'm', { apiKey: '' })).meta as Record<
      string,
      unknown
    >;
    expect(meta.apiKey).toBe('(empty)');
  });

  it('scrubs a Salesforce session id that reached a message string', () => {
    const token = '00DOx00000PBUxK!AQEAQOYK_I8aIAVgf7SprXqde0gfVBT1_HqzTYSqR52g1z4q0Ldj';
    const out = capture(() => logger.error('t', `upstream said: ${token}`));
    expect(out.message).toBe('upstream said: [redacted-sf-token]');
  });

  it('truncates a runaway string instead of writing a whole HTML page to the log', () => {
    const meta = capture(() => logger.info('t', 'm', { body: 'x'.repeat(5000) })).meta as Record<
      string,
      string
    >;
    expect(meta.body).toHaveLength(2000 + '…[truncated]'.length);
  });

  it('leaves ordinary diagnostic meta alone', () => {
    const meta = capture(() =>
      logger.info('t', 'm', { status: 400, host: 'example.com', cfRay: 'abc-PDX' }),
    ).meta;
    expect(meta).toEqual({ status: 400, host: 'example.com', cfRay: 'abc-PDX' });
  });
});

describe('diagnoseFetchFailure', () => {
  const withCause = (code: string) => Object.assign(new Error('fetch failed'), { cause: { code } });

  it('identifies TLS interception, the failure a browser test cannot reproduce', () => {
    const d = diagnoseFetchFailure(withCause('UNABLE_TO_VERIFY_LEAF_SIGNATURE'));
    expect(d.kind).toBe('tls');
    expect(d.hint).toMatch(/NODE_EXTRA_CA_CERTS/);
    // Never suggest the cure that is worse than the disease.
    expect(d.hint).toMatch(/Do not use NODE_TLS_REJECT_UNAUTHORIZED=0/);
  });

  it('separates DNS, timeout and refusal', () => {
    expect(diagnoseFetchFailure(withCause('ENOTFOUND')).kind).toBe('dns');
    expect(diagnoseFetchFailure(withCause('UND_ERR_CONNECT_TIMEOUT')).kind).toBe('timeout');
    expect(diagnoseFetchFailure(withCause('ECONNREFUSED')).kind).toBe('refused');
  });

  it('degrades to unknown while still carrying the original message', () => {
    const d = diagnoseFetchFailure(new Error('something odd'));
    expect(d.kind).toBe('unknown');
    expect(d.hint).toMatch(/something odd/);
  });
});

describe('describeResponse', () => {
  it('surfaces cf-ray, which is how we tell Cloudflare apart from Salesforce', () => {
    const res = new Response('<html>blocked</html>', {
      status: 403,
      headers: { 'content-type': 'text/html', server: 'cloudflare', 'cf-ray': 'abc123-BOM' },
    });
    expect(describeResponse(res)).toMatchObject({
      status: 403,
      server: 'cloudflare',
      cfRay: 'abc123-BOM',
    });
  });

  it('reports missing headers rather than undefined', () => {
    expect(describeResponse(new Response('{}'))).toMatchObject({ cfRay: '(none)' });
  });
});

describe('bodySnippet', () => {
  it('collapses whitespace so an HTML page stays one readable line', () => {
    expect(bodySnippet('<html>\n  <body>\n    nope\n  </body>\n</html>')).toBe(
      '<html> <body> nope </body> </html>',
    );
  });

  it('caps the length', () => {
    expect(bodySnippet('y'.repeat(500))).toHaveLength(301);
  });
});
