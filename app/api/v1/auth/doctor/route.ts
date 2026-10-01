/**
 * GET /api/v1/auth/doctor — non-production preflight for the Option B login.
 *
 * Reproduces the parts of the login that happen *on the server* without needing anyone to
 * actually sign in, because that is where a remote developer's setup fails: the browser leg
 * succeeds, Salesforce issues a code, and then the server-side token call never lands. When
 * that happens there is no Login History row on the org to look at, so the evidence has to
 * come from this side.
 *
 * Four checks, in the order a request hits them: config → DNS → TLS → the token endpoint.
 * Everything is written to the log file too, so "send me logs/dev.log" covers it.
 *
 * Reports no secret values anywhere — only whether each is set, how long it is, and the last
 * six characters of the consumer key, which is not a secret (it travels in the authorize URL)
 * and is the only way to tell this org's two near-identical Connected Apps apart.
 */
import { lookup } from 'node:dns/promises';
import * as nodeTls from 'node:tls';
import { connect, type PeerCertificate } from 'node:tls';
import { handle } from '@/lib/route';
import { fail, ok } from '@/lib/types';
import { config } from '@/lib/config';
import { logger } from '@/lib/logger';
import { proxyEnvSummary } from '@/lib/auth/salesforce-oauth';
import { bodySnippet, describeResponse, diagnoseFetchFailure } from '@/lib/net-diagnostics';
import { logFilePath } from '@/lib/log-file';

type Verdict = 'ok' | 'warn' | 'fail' | 'skipped';

interface Check {
  name: string;
  verdict: Verdict;
  detail: string;
  data?: Record<string, unknown>;
}

/** Set / not set / how long — never the value. */
function describeSecret(value: string | undefined) {
  return value ? { set: true, length: value.length } : { set: false, length: 0 };
}

function checkConfig(): Check {
  const missing = (
    [
      ['SF_SITE_BASE_URL', config.sfSiteBaseUrl],
      ['SF_CLIENT_ID', config.sfClientId],
      ['SF_CLIENT_SECRET', config.sfClientSecret],
      ['SF_CALLBACK_URL', config.sfCallbackUrl],
    ] as const
  )
    .filter(([, v]) => !v)
    .map(([k]) => k);

  const data = {
    siteBaseUrl: config.sfSiteBaseUrl || '(unset)',
    callbackUrl: config.sfCallbackUrl || '(unset)',
    // Identifies WHICH Connected App without exposing anything: this org has two whose
    // consumer keys share their first 37 characters, and mixing the key of one with the
    // secret of the other is the classic cause of a login that dies at the token call.
    clientIdTail: config.sfClientId ? `...${config.sfClientId.slice(-6)}` : '(unset)',
    clientIdLength: config.sfClientId?.length ?? 0,
    clientSecret: describeSecret(config.sfClientSecret),
  };

  if (missing.length) {
    return {
      name: 'config',
      verdict: 'fail',
      detail: `Missing from .env.local: ${missing.join(', ')}.`,
      data,
    };
  }
  if (!/^https?:\/\//.test(config.sfCallbackUrl)) {
    return {
      name: 'config',
      verdict: 'fail',
      detail: 'SF_CALLBACK_URL is not an absolute URL.',
      data,
    };
  }
  return {
    name: 'config',
    verdict: 'ok',
    detail:
      'All four OAuth settings are present. Compare clientIdTail against a known-good machine — ' +
      'if they differ you are pointed at a different Connected App.',
    data,
  };
}

async function checkDns(host: string): Promise<Check> {
  try {
    const addresses = await lookup(host, { all: true });
    return {
      name: 'dns',
      verdict: 'ok',
      detail: `${host} resolves.`,
      data: { host, addresses: addresses.map((a) => a.address) },
    };
  } catch (e) {
    const { code, hint } = diagnoseFetchFailure(e);
    return { name: 'dns', verdict: 'fail', detail: hint, data: { host, errorCode: code } };
  }
}

/** Distinguished-name fields are string[] when the certificate repeats an attribute. */
const firstDn = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/**
 * Which roots this process actually trusts.
 *
 * `npm run dev` goes through `scripts/next-with-system-ca.mjs`, which exports the OS trust
 * store and points NODE_EXTRA_CA_CERTS at it. Starting the app another way silently skips
 * that, and the symptom — a TLS failure the browser cannot reproduce — looks identical either
 * way. So report whether the extra roots are really loaded rather than assuming the launcher
 * was used.
 */
function caSummary() {
  // @types/node here predates Node 22.15's tls.getCACertificates, which the runtime does have.
  // Reached through a cast rather than pinned types so an older Node degrades to the message
  // below instead of crashing the whole report.
  const getCACertificates = (
    nodeTls as unknown as { getCACertificates?: (kind: string) => string[] }
  ).getCACertificates;

  try {
    if (!getCACertificates) throw new Error('unsupported');
    const bundled = getCACertificates('bundled').length;
    const system = getCACertificates('system').length;
    const extra = getCACertificates('extra').length;
    const active = getCACertificates('default').length;
    return {
      bundled,
      system,
      extra,
      active,
      // The launcher loads the OS roots as "extra", so a non-zero count is the proof that
      // this process was started through it and trusts what the browser trusts.
      systemStoreLoaded: extra > 0,
      extraCaFile: process.env.NODE_EXTRA_CA_CERTS ?? '(unset)',
    };
  } catch {
    // getCACertificates landed in Node 22.15 alongside the flag itself.
    return { unavailable: `Node ${process.versions.node} cannot report its trust store` };
  }
}

/**
 * Read the certificate's issuer *without* verifying it.
 *
 * Only reached once verification has already failed, and only to put a name in the report.
 * "Node refused the certificate" sends someone hunting; "issued by Zscaler Inc." is the
 * answer. Nothing is sent over this socket — it opens, reads the presented chain, and closes.
 */
function peekIssuer(host: string): Promise<string> {
  return new Promise((done) => {
    const settle = (v: string) => {
      s.destroy();
      done(v);
    };
    const s = connect(
      { host, port: 443, servername: host, timeout: 8_000, rejectUnauthorized: false },
      () => {
        const c = s.getPeerCertificate() as PeerCertificate;
        settle(firstDn(c?.issuer?.O) ?? firstDn(c?.issuer?.CN) ?? '(unknown)');
      },
    );
    s.on('error', () => settle('(unknown)'));
    s.on('timeout', () => settle('(unknown)'));
  });
}

/**
 * Open a raw TLS connection and report who signed the certificate.
 *
 * This is the decisive check for a managed laptop. If the issuer is a corporate CA rather
 * than a public one, traffic is being intercepted and re-signed: Chrome accepts it from the
 * Windows certificate store, Node never looks there, and every server-side call fails while
 * every browser call succeeds.
 *
 * Note the two outcomes are reached by different events. Node only runs the connect callback
 * when the chain verifies, so a rejected certificate arrives at `error` — which is why the
 * issuer has to be fetched separately there rather than read off this socket.
 */
function checkTls(host: string): Promise<Check> {
  return new Promise((resolveCheck) => {
    const socket = connect({ host, port: 443, servername: host, timeout: 10_000 }, () => {
      const cert = socket.getPeerCertificate() as PeerCertificate;
      const first = firstDn;
      const issuer = first(cert?.issuer?.O) ?? first(cert?.issuer?.CN) ?? '(unknown)';
      const authorized = socket.authorized;
      const reason = socket.authorizationError ? String(socket.authorizationError) : null;
      socket.end();

      const publicCa =
        /^(DigiCert|Sectigo|Let's Encrypt|GlobalSign|Amazon|Google Trust|Cloudflare|Entrust|GoDaddy|Baltimore|ISRG)/i.test(
          issuer,
        );
      resolveCheck({
        name: 'tls',
        verdict: authorized && publicCa ? 'ok' : 'warn',
        detail: authorized
          ? publicCa
            ? `Certificate chains to a public CA (${issuer}).`
            : `Certificate was issued by "${issuer}", which is not a public CA. Traffic to this ` +
              `host is being intercepted and re-signed. Node trusts it here only because that ` +
              `root is already in NODE_EXTRA_CA_CERTS or the Node bundle — if the app still ` +
              `fails, that is why.`
          : `Node refused the certificate: ${reason}. Export the corporate root CA as a .pem and ` +
            `set NODE_EXTRA_CA_CERTS to it before starting the app.`,
        data: {
          host,
          issuer,
          subjectCn: first(cert?.subject?.CN) ?? '(unknown)',
          validTo: cert?.valid_to ?? '(unknown)',
          nodeAuthorized: authorized,
          nodeRejectReason: reason ?? '(none)',
        },
      });
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolveCheck({
        name: 'tls',
        verdict: 'fail',
        detail: `Timed out opening a TLS connection to ${host}:443. Outbound HTTPS from Node is blocked on this network.`,
        data: { host },
      });
    });

    socket.on('error', async (e) => {
      const { code, kind, hint } = diagnoseFetchFailure(e);
      socket.destroy();
      // Name the signer when the failure was the chain itself; for a DNS or connect error
      // there is no certificate to look at and a second attempt would just repeat it.
      const issuer = kind === 'tls' ? await peekIssuer(host) : '(not reached)';
      resolveCheck({
        name: 'tls',
        verdict: 'fail',
        detail:
          kind === 'tls' && issuer !== '(unknown)' && issuer !== '(not reached)'
            ? `Node rejected the certificate for ${host}, which was issued by "${issuer}". ${hint}`
            : hint,
        data: { host, errorCode: code, issuer, nodeAuthorized: false },
      });
    });
  });
}

/**
 * Exercise the real token endpoint with a deliberately invalid authorization code.
 *
 * The point is what Salesforce complains about first. It validates the client credentials
 * before the code, so:
 *   invalid_grant   → the client id and secret are BOTH correct (only the fake code failed)
 *   invalid_client  → the secret is wrong or belongs to a different Connected App
 *   non-JSON + cf-ray → Cloudflare answered; the request never reached Salesforce
 *
 * That verifies a developer's secret without anyone having to read it or send it anywhere.
 */
async function checkTokenEndpoint(): Promise<Check> {
  const url = `${config.sfSiteBaseUrl}/services/oauth2/token`;
  const started = Date.now();

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        // Not a real code, and cannot become one — this probe can never mint a session.
        code: 'preflight-probe-not-a-real-code',
        client_id: config.sfClientId,
        client_secret: config.sfClientSecret,
        redirect_uri: config.sfCallbackUrl,
      }).toString(),
      redirect: 'manual',
    });
  } catch (e) {
    const { code, kind, hint } = diagnoseFetchFailure(e);
    return {
      name: 'token-endpoint',
      verdict: 'fail',
      detail: hint,
      data: { url, errorCode: code, kind, elapsedMs: Date.now() - started },
    };
  }

  const shape = describeResponse(res);
  const text = await res.text();
  const elapsedMs = Date.now() - started;

  let body: Record<string, string>;
  try {
    body = JSON.parse(text) as Record<string, string>;
  } catch {
    const fromCloudflare = shape.cfRay !== '(none)';
    return {
      name: 'token-endpoint',
      verdict: 'fail',
      detail: fromCloudflare
        ? 'Cloudflare answered instead of Salesforce — the request was blocked or challenged at ' +
          'the edge and never reached the org. This is why Login History shows the SSO login but ' +
          'no token exchange. Usually a shared corporate or VPN egress IP.'
        : 'The token endpoint returned something that is not JSON. Check that SF_SITE_BASE_URL is ' +
          'the Experience Cloud community base URL.',
      data: { url, ...shape, elapsedMs, bodySnippet: bodySnippet(text) },
    };
  }

  if (body.error === 'invalid_grant') {
    return {
      name: 'token-endpoint',
      verdict: 'ok',
      detail:
        'Salesforce rejected only the fake authorization code, which means it accepted the client ' +
        'id and secret. Credentials and connectivity are both good — a real login should work.',
      data: { url, ...shape, elapsedMs, salesforceError: body.error },
    };
  }

  return {
    name: 'token-endpoint',
    verdict: 'fail',
    detail:
      body.error === 'invalid_client'
        ? 'Salesforce rejected the client secret. SF_CLIENT_SECRET is wrong, truncated, or from a ' +
          'different Connected App than SF_CLIENT_ID.'
        : body.error === 'invalid_client_id'
          ? 'SF_CLIENT_ID does not match any Connected App on this org.'
          : `Salesforce returned "${body.error}": ${body.error_description ?? 'no description'}.`,
    data: {
      url,
      ...shape,
      elapsedMs,
      salesforceError: body.error ?? '(none)',
      salesforceErrorDescription: body.error_description ?? '(none)',
    },
  };
}

export async function GET() {
  return handle('auth.doctor', async ({ correlationId }) => {
    // Diagnostics describe the deployment to whoever can reach the URL. Fine on a laptop,
    // not on a deployed environment.
    if (config.isProd) {
      return fail('NOT_FOUND', 'Not found', 404);
    }

    const checks: Check[] = [checkConfig()];

    if (checks[0].verdict === 'fail') {
      checks.push(
        { name: 'dns', verdict: 'skipped', detail: 'Skipped: configuration is incomplete.' },
        { name: 'tls', verdict: 'skipped', detail: 'Skipped: configuration is incomplete.' },
        {
          name: 'token-endpoint',
          verdict: 'skipped',
          detail: 'Skipped: configuration is incomplete.',
        },
      );
    } else {
      const host = new URL(config.sfSiteBaseUrl).hostname;
      // Sequential, not parallel: each check only makes sense if the previous one passed,
      // and a serial report is far easier to read than four interleaved ones.
      checks.push(await checkDns(host));
      checks.push(await checkTls(host));
      checks.push(await checkTokenEndpoint());
    }

    const failed = checks.filter((c) => c.verdict === 'fail');
    const summary = failed.length
      ? `${failed.length} check(s) failed: ${failed.map((c) => c.name).join(', ')}.`
      : 'All checks passed. The server can reach Salesforce and its credentials are accepted.';

    for (const c of checks) {
      logger[c.verdict === 'fail' ? 'error' : 'info'](
        'auth.doctor',
        `${c.name}: ${c.verdict} — ${c.detail}`,
        { correlationId, ...c.data },
      );
    }

    return ok({
      summary,
      healthy: failed.length === 0,
      logFile: logFilePath() ?? '(file logging is off — set LOG_FILE to enable)',
      node: process.version,
      platform: `${process.platform} ${process.arch}`,
      certificateAuthorities: caSummary(),
      proxyEnv: proxyEnvSummary(),
      checks,
      correlationId,
    });
  });
}