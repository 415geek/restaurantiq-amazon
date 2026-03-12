import { readFile } from 'node:fs/promises';
import { createSign, randomUUID } from 'node:crypto';
import { Buffer } from 'node:buffer';

type ClientAssertionConfig = {
  clientId: string;
  keyId: string;
  audience: string;
  privateKeyPem: string;
};

export class UberEatsClientAssertionError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

function toBase64Url(input: string | Buffer) {
  const raw = Buffer.isBuffer(input) ? input : Buffer.from(input, 'utf8');
  return raw
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function decodeEscapedPem(raw: string) {
  return raw.includes('\\n') ? raw.replace(/\\n/g, '\n') : raw;
}

async function resolvePrivateKeyPem() {
  const direct = process.env.UBEREATS_PRIVATE_KEY_PEM;
  if (direct?.trim()) return decodeEscapedPem(direct.trim());

  const base64 = process.env.UBEREATS_PRIVATE_KEY_BASE64;
  if (base64?.trim()) {
    return Buffer.from(base64.trim(), 'base64').toString('utf8');
  }

  const keyPath = process.env.UBEREATS_PRIVATE_KEY_PATH;
  if (keyPath?.trim()) {
    return await readFile(keyPath.trim(), 'utf8');
  }

  return null;
}

export async function resolveUberClientAssertionConfig(): Promise<ClientAssertionConfig | null> {
  const clientId = process.env.UBEREATS_CLIENT_ID?.trim() ?? '';
  const keyId = process.env.UBEREATS_ASYMMETRIC_KEY_ID?.trim() ?? '';
  const audience = process.env.UBEREATS_CLIENT_ASSERTION_AUDIENCE?.trim() || 'auth.uber.com';
  const privateKeyPem = await resolvePrivateKeyPem();

  if (!clientId || !keyId || !privateKeyPem) return null;
  return { clientId, keyId, audience, privateKeyPem };
}

export async function buildUberClientAssertion() {
  const cfg = await resolveUberClientAssertionConfig();
  if (!cfg) {
    throw new UberEatsClientAssertionError(
      'missing_assertion_config',
      'UBEREATS_CLIENT_ID / UBEREATS_ASYMMETRIC_KEY_ID / private key is missing'
    );
  }

  const now = Math.floor(Date.now() / 1000);
  const exp = now + 300;
  const payload = {
    iss: cfg.clientId,
    sub: cfg.clientId,
    aud: cfg.audience,
    jti: randomUUID(),
    iat: now,
    exp,
  };
  const header = {
    alg: 'RS256',
    typ: 'JWT',
    kid: cfg.keyId,
  };

  const encodedHeader = toBase64Url(JSON.stringify(header));
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signer = createSign('RSA-SHA256');
  signer.update(signingInput);
  signer.end();
  const signatureBase64 = signer.sign(cfg.privateKeyPem, 'base64');
  const encodedSignature = signatureBase64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');

  return {
    assertion: `${signingInput}.${encodedSignature}`,
    exp,
    keyId: cfg.keyId,
  };
}

export async function buildUberTokenRequestBody(params: {
  grantType: 'authorization_code' | 'client_credentials' | 'refresh_token';
  code?: string;
  redirectUri?: string;
  refreshToken?: string;
  scope?: string;
}) {
  const body = new URLSearchParams();
  const clientId = process.env.UBEREATS_CLIENT_ID?.trim() ?? '';
  const clientSecret = process.env.UBEREATS_CLIENT_SECRET?.trim() ?? '';
  const forceClientAssertion = process.env.UBEREATS_OAUTH_USE_CLIENT_ASSERTION !== 'false';

  if (!clientId) {
    throw new UberEatsClientAssertionError('missing_client_id', 'UBEREATS_CLIENT_ID is missing');
  }

  body.set('grant_type', params.grantType);
  body.set('client_id', clientId);

  if (params.scope) body.set('scope', params.scope);
  if (params.redirectUri) body.set('redirect_uri', params.redirectUri);
  if (params.code) body.set('code', params.code);
  if (params.refreshToken) body.set('refresh_token', params.refreshToken);

  if (forceClientAssertion) {
    const { assertion } = await buildUberClientAssertion();
    body.set('client_assertion', assertion);
    body.set(
      'client_assertion_type',
      'urn:ietf:params:oauth:client-assertion-type:jwt-bearer'
    );
    return body;
  }

  if (!clientSecret) {
    throw new UberEatsClientAssertionError(
      'missing_client_secret',
      'UBEREATS_CLIENT_SECRET is missing and UBEREATS_OAUTH_USE_CLIENT_ASSERTION=false'
    );
  }

  body.set('client_secret', clientSecret);
  return body;
}
