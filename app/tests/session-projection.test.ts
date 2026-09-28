// @vitest-environment node
/**
 * Nothing secret may reach the browser.
 *
 * This walks the whole projected object rather than checking named fields, because the
 * risk is a field somebody adds later — `ActorSnapshot` carries the associate's access
 * AND refresh token, and it sits one spread away from the payload. A test that only
 * asserted the fields we thought of would pass right up until it mattered.
 */
import { describe, it, expect } from 'vitest';

process.env.MOCK_MODE = 'on';

import { projectSession } from '../lib/auth/session-projection';
import type { Session } from '../lib/types';

const SECRETISH = /token|secret|assertion|refresh|credential|password|private/i;
/** The same Salesforce session-id shape lib/logger.ts scrubs from messages. */
const SF_TOKEN = /00D[A-Za-z0-9]{12,18}![A-Za-z0-9._-]{20,}/;

function impersonatedSession(): Session {
  return {
    sid: 'sid-1',
    authMode: 'sso',
    federationId: '',
    username: 'buyer@example.com',
    role: 'cso',
    user: {
      id: '005BUYER',
      firstName: 'Dana',
      lastName: 'Reyes',
      email: 'dana@acme.example.com',
      companyName: 'Acme HVAC',
    },
    effectiveAccountId: '001ACME',
    webstoreId: '0ZESTORE',
    customerType: 'DIRECT',
    csrf: 'csrf-secret-value',
    sfAccessToken: '00Dxx0000001gPF!AQoAQPveryLongTokenValue1234567890',
    sfRefreshToken: '5Aep861refreshTokenValue',
    sfInstanceUrl: 'https://x.my.salesforce.com',
    createdAt: Date.now(),
    impersonation: {
      id: 'imp-1',
      target: {
        userId: '005BUYER',
        username: 'buyer@example.com',
        name: 'Dana Reyes',
        contactId: '003CONTACT',
        accountId: '001ACME',
        accountName: 'Acme HVAC',
        email: 'dana@acme.example.com',
        federationId: 'dana.b2b',
      },
      policy: 'allowlist',
      startedAt: 1_700_000_000_000,
      expiresAt: 1_700_000_900_000,
      tokenMintedAt: 1_700_000_000_000,
      actor: {
        federationId: 'irfzjs',
        username: 'sam@trane.example.com',
        role: 'csa',
        user: {
          id: '005ASSOC',
          firstName: 'Sam',
          lastName: 'Associate',
          email: 'sam@trane.example.com',
          companyName: 'Trane Supply',
        },
        effectiveAccountId: '',
        webstoreId: '0ZESTORE',
        customerType: 'ASSOCIATE',
        sfAccessToken: '00Dxx0000001gPF!AQoAQPassociateTokenValue0987654321',
        sfRefreshToken: '5Aep861associateRefreshValue',
        sfInstanceUrl: 'https://assoc.my.salesforce.com',
      },
    },
  };
}

function walk(value: unknown, path: string[], visit: (path: string[], value: unknown) => void) {
  visit(path, value);
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) walk(v, [...path, k], visit);
  }
}

describe('projectSession', () => {
  it('leaks no secret-looking key or Salesforce token, at any depth', () => {
    const projected = projectSession(impersonatedSession());

    walk(projected, [], (path, value) => {
      const key = path.at(-1);
      if (key) expect(key, `key at ${path.join('.')}`).not.toMatch(SECRETISH);
      if (typeof value === 'string') {
        expect(value, `value at ${path.join('.')}`).not.toMatch(SF_TOKEN);
      }
    });
  });

  it('shows the associate as the actor and the buyer as the subject', () => {
    const projected = projectSession(impersonatedSession());
    expect(projected.impersonation?.actor.name).toBe('Sam Associate');
    expect(projected.impersonation?.target.name).toBe('Dana Reyes');
    // `user` is the EFFECTIVE identity — the buyer — per the contract on Session.user.
    expect(projected.user.id).toBe('005BUYER');
  });

  it('reports null impersonation on an ordinary session', () => {
    const session = impersonatedSession();
    delete session.impersonation;
    expect(projectSession(session).impersonation).toBeNull();
  });
});
