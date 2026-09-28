/**
 * Option B — OAuth 2.0 authorization code + PKCE against the **Source Experience site**.
 *
 * The BFF is an OAuth client of Salesforce, never of Azure B2C. Sending the browser to the
 * site's /services/oauth2/authorize makes Salesforce delegate login to B2C through the
 * site's existing SAML config (`Comfortsite_Pcdigires` in the pcdigires sandbox), so one
 * login yields BOTH a site session (renders Experience Cloud pages) and, via the code we
 * exchange here, a per-user Salesforce access + refresh token for the BFF. There is no
 * bridge code to own and no shared integration user — see migration plan §1.1 / Option B.
 *
 * Framework-agnostic on purpose: no next/* imports, so the standalone-service fallback
 * (plan §3) can lift this over unchanged.
 */
import { createHash, randomBytes } from 'node:crypto';
import { config, assertSfOAuthConfig } from '../config';
import { logger } from '../logger';
import { bodySnippet, describeResponse, diagnoseFetchFailure } from '../net-diagnostics';

/** Tokens as returned by the site token endpoint. Salesforce sends no `expires_in`. */
export interface SalesforceTokenSet {
  accessToken: string;
  refreshToken: string;
  /** my.salesforce.com origin for API calls — NOT the community origin. */
  instanceUrl: string;
  /** Identity URL for this user, from the token response `id` field. */
  idUrl: string;
}

/** The subset of the Salesforce identity resource the session needs. */
export interface SalesforceIdentity {
  userId: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
}

export class OAuthError extends Error {
  readonly statusCode: number;
  constructor(message: string, statusCode = 502) {
    super(message);
    this.name = 'OAuthError';
    this.statusCode = statusCode;
  }
}

function base64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** RFC 7636 S256 pair. The verifier stays server-side; only the challenge hits the wire. */
export function createPkcePair(): { verifier: string; challenge: string } {
  const verifier = base64url(randomBytes(32));
  const challenge = base64url(createHash('sha256').update(verifier).digest());
  return { verifier, challenge };
}

/** Opaque, single-use CSRF value for the authorization request. */
export function createStateToken(): string {
  return base64url(randomBytes(32));
}

/**
 * Which Salesforce authorization server a session belongs to.
 *
 *  - `site`     the Experience Cloud community host. Delegates to B2C via the site's SAML
 *               config, which appends `.b2b` — so this serves BUYERS.
 *  - `mydomain` the org's My Domain host, running ordinary employee SSO with no `.b2b`
 *               transform — so this serves internal ASSOCIATES, who cannot authenticate
 *               through the site host at all.
 *
 * Same Connected App and same redirect_uri either way; only the authorization server
 * differs. It has to be carried on the session because a token must be refreshed and
 * revoked at the host that issued it — crossing them yields an opaque invalid_grant.
 */
export type TokenAuthority = 'site' | 'mydomain';

export function authorityBaseUrl(authority: TokenAuthority): string {
  if (authority === 'mydomain') {
    if (!config.sfMyDomainUrl) {
      throw new OAuthError('SF_MYDOMAIN_URL is not set, so employee login is unavailable.', 500);
    }
    return config.sfMyDomainUrl;
  }
  return config.sfSiteBaseUrl;
}

const endpoint = (path: string, authority: TokenAuthority = 'site') =>
  `${authorityBaseUrl(authority)}/services/oauth2/${path}`;

/**
 * Where to send the browser to start login. Salesforce takes it from here: it sees no site
 * session, bounces to B2C, matches the returned assertion on FederationIdentifier (the
 * `.b2b` suffix is applied by the SAML config's DerivedUserID mapping, not by us), and
 * redirects back to `SF_CALLBACK_URL` with a code.
 */
export function buildAuthorizeUrl(
  state: string,
  codeChallenge: string,
  authority: TokenAuthority = 'site',
): string {
  assertSfOAuthConfig();
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: config.sfClientId,
    redirect_uri: config.sfCallbackUrl,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    scope: 'api refresh_token openid',
  });
  return `${endpoint('authorize', authority)}?${params.toString()}`;
}

/**
 * What Salesforce's own `error` code means for whoever has to fix it.
 *
 * These are the ones worth naming. `invalid_client` in particular is near-impossible to
 * guess at from the outside and is the single most common remote-setup failure, because two
 * Connected Apps in this org share the first 37 characters of their consumer key.
 */
const OAUTH_ERROR_HINTS: Record<string, string> = {
  invalid_client:
    'Salesforce accepted the client id but rejected the secret. SF_CLIENT_SECRET is wrong, ' +
    'truncated, or belongs to a different Connected App than SF_CLIENT_ID — check that both ' +
    'came from the same app.',
  invalid_client_id: 'SF_CLIENT_ID does not match any Connected App on this org.',
  invalid_grant:
    'The authorization code was rejected: already used, expired, or the PKCE verifier did not ' +
    'match. A stale login state store (Redis) will do this — retry a clean login first.',
  redirect_uri_mismatch:
    'SF_CALLBACK_URL does not exactly match a callback URL on the Connected App. It must match ' +
    'character for character, including scheme and port.',
  inactive_user: 'The Salesforce user is inactive.',
  inactive_org: 'The Salesforce org is inactive or the sandbox is refreshing.',
  invalid_app_access:
    'This user is not permitted to use the Connected App (admin-approved users only).',
};

async function postToken(
  body: URLSearchParams,
  ref: string,
  authority: TokenAuthority = 'site',
): Promise<SalesforceTokenSet> {
  const url = endpoint('token', authority);
  const started = Date.now();

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: body.toString(),
      // Never let a redirect silently turn a token call into an HTML login page.
      redirect: 'manual',
    });
  } catch (e) {
    // The request never completed, so Salesforce has no record of it at all. Classify it
    // here or it reaches the caller as the useless string "fetch failed".
    const { code, kind, hint } = diagnoseFetchFailure(e);
    logger.error(ref, `could not reach the token endpoint (${kind}/${code})`, {
      url,
      errorCode: code,
      kind,
      hint,
      elapsedMs: Date.now() - started,
      proxyEnv: proxyEnvSummary(),
    });
    throw new OAuthError(`Could not reach Salesforce (${code}): ${hint}`);
  }

  const shape = describeResponse(res);
  const text = await res.text();

  let json: Record<string, string>;
  try {
    json = JSON.parse(text) as Record<string, string>;
  } catch {
    // Not JSON means something other than the org answered. Cloudflare fronts this domain,
    // so log the fingerprint that tells the two apart rather than guessing in the message.
    const fromCloudflare = shape.cfRay !== '(none)' && !shape.contentType.includes('json');
    logger.error(ref, `token endpoint returned non-JSON (HTTP ${res.status})`, {
      url,
      ...shape,
      elapsedMs: Date.now() - started,
      bodySnippet: bodySnippet(text),
      hint: fromCloudflare
        ? 'A cf-ray header with a non-JSON body means Cloudflare answered instead of Salesforce — ' +
          'the request was challenged or blocked at the edge and never reached the org. Expect no ' +
          'matching row in Salesforce Login History. Common on shared corporate/VPN egress IPs.'
        : 'Check that SF_SITE_BASE_URL is the Experience Cloud community base URL, not the ' +
          'my.salesforce.com instance URL.',
    });
    throw new OAuthError(
      `Token endpoint returned non-JSON (HTTP ${res.status}).` +
        (fromCloudflare ? ' Cloudflare answered instead of Salesforce.' : ''),
    );
  }

  if (!res.ok || !json.access_token) {
    // error_description is Salesforce's own text; safe to log, not to return verbatim.
    logger.error(ref, `token endpoint error: ${json.error} - ${json.error_description}`, {
      url,
      ...shape,
      elapsedMs: Date.now() - started,
      hint: OAUTH_ERROR_HINTS[json.error ?? ''] ?? 'No specific guidance for this error code.',
    });
    throw new OAuthError(`Salesforce rejected the token request: ${json.error ?? res.status}`, 401);
  }

  logger.info(ref, 'token endpoint returned a token set', {
    elapsedMs: Date.now() - started,
    hasRefreshToken: Boolean(json.refresh_token),
    hasIdUrl: Boolean(json.id),
  });

  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? '',
    instanceUrl: json.instance_url ?? '',
    idUrl: json.id ?? '',
  };
}

/**
 * Proxy-related environment, for the log only.
 *
 * A proxy set for the shell but not for Node (or the reverse) is a standard cause of "works
 * in the browser, fails on the server", so record which are present. Values, not just names:
 * these are hostnames, and a proxy URL with credentials in it would be redacted by the
 * logger's own key-matching before it reaches the file.
 */
export function proxyEnvSummary(): Record<string, string> {
  const keys = [
    'HTTP_PROXY',
    'HTTPS_PROXY',
    'http_proxy',
    'https_proxy',
    'NO_PROXY',
    'no_proxy',
    'NODE_EXTRA_CA_CERTS',
    'NODE_TLS_REJECT_UNAUTHORIZED',
  ];
  /**
   * Host only, never the value. A proxy URL routinely carries `user:password@host`, and the
   * logger's secret-key regex does not match `HTTP_PROXY` — so logging these verbatim would
   * write corporate proxy credentials to disk. Which proxy is set, and its host, is all the
   * diagnostic ever needed.
   */
  return Object.fromEntries(
    keys.map((k) => {
      const raw = process.env[k];
      if (!raw) return [k, '(unset)'];
      try {
        return [k, new URL(raw).host];
      } catch {
        return [k, '(set)'];
      }
    }),
  );
}

/** Step 10-11 of the Option B sequence: trade the auth code for user-scoped SF tokens. */
export async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string,
  authority: TokenAuthority = 'site',
): Promise<SalesforceTokenSet> {
  assertSfOAuthConfig();
  return postToken(
    new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: config.sfClientId,
      client_secret: config.sfClientSecret,
      redirect_uri: config.sfCallbackUrl,
      code_verifier: codeVerifier,
    }),
    'auth.token-exchange',
    // Must match the host that issued the code, or Salesforce answers invalid_grant.
    authority,
  );
}

/**
 * Standard refresh. Salesforce does not reissue a refresh token here, so the caller must
 * carry the original one forward (see `refreshSessionTokens` in ./session).
 */
export async function refreshTokens(
  refreshToken: string,
  authority: TokenAuthority = 'site',
): Promise<SalesforceTokenSet> {
  assertSfOAuthConfig();
  return postToken(
    new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: config.sfClientId,
      client_secret: config.sfClientSecret,
    }),
    'auth.token-refresh',
    authority,
  );
}

/** Read the identity resource named by the token response's `id` URL. */
export async function fetchIdentity(tokens: SalesforceTokenSet): Promise<SalesforceIdentity> {
  if (!tokens.idUrl) throw new OAuthError('Token response carried no identity URL');

  // Note this call goes to the *instance* host, not the community host the token call used,
  // so it can fail on its own — a proxy allowlist covering one and not the other lands here.
  let res: Response;
  try {
    res = await fetch(tokens.idUrl, {
      headers: { Authorization: `Bearer ${tokens.accessToken}`, Accept: 'application/json' },
    });
  } catch (e) {
    const { code, kind, hint } = diagnoseFetchFailure(e);
    logger.error('auth.identity', `could not reach the identity endpoint (${kind}/${code})`, {
      // The id URL is per-user but carries no secret; the token rides in a header, not here.
      idUrl: tokens.idUrl,
      errorCode: code,
      kind,
      hint,
    });
    throw new OAuthError(`Could not reach the identity endpoint (${code}): ${hint}`);
  }

  if (!res.ok) {
    logger.error('auth.identity', `identity request failed (HTTP ${res.status})`, {
      idUrl: tokens.idUrl,
      ...describeResponse(res),
      bodySnippet: bodySnippet(await res.text()),
    });
    throw new OAuthError(`Identity request failed (HTTP ${res.status})`);
  }

  const id = (await res.json()) as {
    user_id?: string;
    username?: string;
    email?: string;
    first_name?: string;
    last_name?: string;
  };

  return {
    userId: id.user_id ?? '',
    username: id.username ?? '',
    email: id.email ?? '',
    firstName: id.first_name ?? '',
    lastName: id.last_name ?? '',
  };
}

/**
 * Best-effort token revocation. A failure here must not block logout — the BFF session is
 * already gone by the time we call this, and the site/B2C legs still need to run.
 */
export async function revokeToken(
  token: string,
  authority: TokenAuthority = 'site',
): Promise<boolean> {
  if (!token) return false;
  try {
    const res = await fetch(endpoint('revoke', authority), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token }).toString(),
    });
    return res.ok;
  } catch (e) {
    logger.error('auth.revoke', `token revocation failed: ${(e as Error).message}`);
    return false;
  }
}

/**
 * The URL that ends the remaining two sessions: hitting the site's logout drops the
 * Experience Cloud session, then follows the SAML config's single-logout URL to Azure B2C.
 * Verified end-to-end against the pcdigires sandbox — after this, B2C prompts for
 * credentials again, and the user is signed out of the other Trane sites too (today's
 * behavior for a B2C logout, and expected).
 *
 * Where the browser LANDS afterwards is not ours to choose. It comes from the org's
 * SamlSsoConfig (`Comfortsite_Pcdigires`): `logoutUrl` sends the user to the site home, and
 * `singleLogoutUrl` carries its own post_logout_redirect_uri for the B2C leg. Neither
 * `Network` nor `CustomSite` exposes a logout setting, and a `retUrl` on logout.jsp is
 * ignored — so do not add a "post logout redirect" option here. Changing the destination
 * means changing the SAML config, which is org-wide and affects every user of the site.
 */
export function buildLogoutUrl(authority: TokenAuthority = 'site'): string {
  /**
   * Log out at the host that logged you in. An employee authenticated through My Domain
   * still has a My Domain session after the BFF session is gone; sending them to the
   * community logout would clear a session they never had and leave their real one alive,
   * while the route reports success.
   */
  if (authority === 'mydomain') {
    return config.sfMyDomainUrl ? `${config.sfMyDomainUrl}/secur/logout.jsp` : '/';
  }
  if (!config.sfSiteBaseUrl) return '/';
  return `${config.sfSiteBaseUrl}/secur/logout.jsp`;
}
