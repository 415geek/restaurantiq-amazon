import { buildUberTokenRequestBody } from '@/lib/server/ubereats-client-assertion';
import {
  getUberEatsConnectionState,
  upsertUberEatsConnectionState,
} from '@/lib/server/ubereats-oauth-store';

export type UberResolvedTokenSource =
  | 'oauth_connection'
  | 'env_bearer_token'
  | 'client_credentials'
  | 'none';

export type UberResolvedToken = {
  token: string;
  source: UberResolvedTokenSource;
  warning?: string;
  setupGuide?: string;
  errorDetails?: string;
};

function sanitizeToken(raw?: string | null) {
  if (!raw) return '';
  const token = raw.trim();
  if (!token) return '';
  if (token.toLowerCase() === 'none') return '';
  if (token.includes('<ACCESS_TOKEN>')) return '';
  return token;
}

function resolveTokenEndpoint() {
  if (process.env.UBEREATS_OAUTH_TOKEN_URL?.trim()) {
    return process.env.UBEREATS_OAUTH_TOKEN_URL.trim();
  }
  const env = (process.env.UBEREATS_ENVIRONMENT || process.env.UBEREATS_ENV || 'sandbox')
    .toLowerCase()
    .trim();
  return env === 'production'
    ? 'https://auth.uber.com/oauth/v2/token'
    : 'https://sandbox-login.uber.com/oauth/v2/token';
}

function resolveClientCredentialsScope() {
  return (
    process.env.UBEREATS_CLIENT_CREDENTIALS_SCOPES ||
    process.env.UBEREATS_OAUTH_SCOPES ||
    'eats.store.read eats.store.orders.read eats.store.status.write'
  );
}

function tokenIsFresh(expiresAt?: number) {
  if (!expiresAt) return true;
  return expiresAt - Date.now() > 60 * 1000;
}

async function exchangeClientCredentialsToken(userKey: string): Promise<UberResolvedToken> {
  const clientId = process.env.UBEREATS_CLIENT_ID?.trim();
  const clientSecret = process.env.UBEREATS_CLIENT_SECRET?.trim();
  const asymmetricKeyId = process.env.UBEREATS_ASYMMETRIC_KEY_ID?.trim();
  const privateKey = process.env.UBEREATS_PRIVATE_KEY_PEM?.trim() ||
                     process.env.UBEREATS_PRIVATE_KEY_BASE64?.trim() ||
                     process.env.UBEREATS_PRIVATE_KEY_PATH?.trim();

  if (!clientId) {
    return {
      token: '',
      source: 'none',
      warning: 'Uber Eats not configured',
      setupGuide: 'To enable Uber Eats integration, apply for developer access at https://developer.uber.com/docs/eats and configure credentials in .env.local',
      errorDetails: 'UBEREATS_CLIENT_ID is missing',
    };
  }

  if (!clientSecret && !asymmetricKeyId && !privateKey) {
    return {
      token: '',
      source: 'none',
      warning: 'Uber Eats credentials incomplete',
      setupGuide: 'Configure either UBEREATS_CLIENT_SECRET or UBEREATS_ASYMMETRIC_KEY_ID + private key in .env.local',
      errorDetails: 'Neither UBEREATS_CLIENT_SECRET nor asymmetric key configuration found',
    };
  }

  try {
    const tokenUrl = resolveTokenEndpoint();
    const scope = resolveClientCredentialsScope();
    
    console.log('[Uber Eats Token] Attempting client credentials exchange');
    console.log('[Uber Eats Token] Token URL:', tokenUrl);
    console.log('[Uber Eats Token] Scope:', scope);
    console.log('[Uber Eats Token] Client ID:', clientId.substring(0, 8) + '...');
    
    const body = await buildUberTokenRequestBody({
      grantType: 'client_credentials',
      scope: scope,
    });
    
    console.log('[Uber Eats Token] Request body prepared');
    
    const tokenRes = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      cache: 'no-store',
    });
    
    console.log('[Uber Eats Token] Response status:', tokenRes.status);
    
    const tokenData = await tokenRes.json().catch(() => ({}));
    console.log('[Uber Eats Token] Response data:', JSON.stringify(tokenData, null, 2));
    
    const accessToken = sanitizeToken(
      typeof tokenData.access_token === 'string' ? tokenData.access_token : ''
    );
    
    if (!tokenRes.ok || !accessToken) {
      const details =
        (tokenData as { error_description?: string; error?: string }).error_description ||
        (tokenData as { error?: string }).error ||
        `HTTP ${tokenRes.status}`;
      
      console.error('[Uber Eats Token] Token exchange failed:', details);
      
      return {
        token: '',
        source: 'none',
        warning: `Uber token exchange failed (${details})`,
        setupGuide: 'Check your Uber Eats credentials in .env.local and ensure your app is approved for the required scopes. If using production, ensure your app is approved for production use.',
        errorDetails: details,
      };
    }

    const expiresIn =
      typeof tokenData.expires_in === 'number' && Number.isFinite(tokenData.expires_in)
        ? tokenData.expires_in
        : 3600;
    
    console.log('[Uber Eats Token] Token obtained successfully, expires in:', expiresIn, 'seconds');
    
    upsertUberEatsConnectionState(userKey, {
      mode: 'server_token',
      accessToken,
      refreshToken: undefined,
      accessTokenExpiresAt: Date.now() + expiresIn * 1000,
      stores: getUberEatsConnectionState(userKey)?.stores || [],
      asymmetricKeyId: process.env.UBEREATS_ASYMMETRIC_KEY_ID,
    });
    
    return {
      token: accessToken,
      source: 'client_credentials',
    };
  } catch (error) {
    console.error('[Uber Eats Token] Exception during token exchange:', error);
    return {
      token: '',
      source: 'none',
      warning: error instanceof Error ? error.message : 'token_exchange_unknown_error',
      setupGuide: 'Ensure your Uber Eats credentials are correctly configured in .env.local and your app is approved for production use',
      errorDetails: error instanceof Error ? error.stack : String(error),
    };
  }
}

export async function resolveUberEatsAccessToken(userKey: string): Promise<UberResolvedToken> {
  const connection = getUberEatsConnectionState(userKey);
  const oauthToken = sanitizeToken(connection?.accessToken);
  if (oauthToken && tokenIsFresh(connection?.accessTokenExpiresAt)) {
    console.log('[Uber Eats Token] Using existing OAuth token');
    return { token: oauthToken, source: 'oauth_connection' };
  }

  const envToken = sanitizeToken(process.env.UBEREATS_BEARER_TOKEN);
  if (envToken) {
    console.log('[Uber Eats Token] Using environment bearer token');
    return { token: envToken, source: 'env_bearer_token' };
  }

  console.log('[Uber Eats Token] Attempting client credentials exchange');
  return exchangeClientCredentialsToken(userKey);
}