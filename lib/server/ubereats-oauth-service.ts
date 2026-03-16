type OAuthResult = {
  success: boolean;
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  error?: string;
};

type OAuthState = 'start' | 'callback' | 'error';

interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  authUrl: string;
  tokenUrl: string;
  scopes: string[];
}

// Default Uber Eats scopes for delivery management (eats.store required for pos_data / store endpoints)
const DEFAULT_SCOPES = [
  'eats.store',
  'eats.store.read',
  'eats.store.orders.read',
  'eats.store.status.write',
  'eats.store.orders.write',
  'eats.pos_provisioning',
  'eats.store.settings',
];

class UberEatsOAuthService {
  private config: OAuthConfig;

  constructor() {
    this.config = {
      clientId: process.env.UBEREATS_CLIENT_ID || '',
      clientSecret: process.env.UBEREATS_CLIENT_SECRET || '',
      redirectUri: process.env.NEXT_PUBLIC_APP_URL + '/api/ubereats/auth/callback',
      authUrl: process.env.UBEREATS_OAUTH_AUTHORIZE_URL || 'https://auth.uber.com/oauth/v2/authorize',
      tokenUrl: process.env.UBEREATS_OAUTH_TOKEN_URL || 'https://auth.uber.com/oauth/v2/token',
      scopes: DEFAULT_SCOPES,
    };
  }

  /**
   * 生成OAuth授权URL
   * 用户点击"连接Uber Eats"时调用此方法
   */
  generateAuthUrl(storeId?: string, redirectUrl?: string): string {
    const state = this.generateState(storeId, redirectUrl || '/delivery');

    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: 'code',
      state: state,
      scope: this.config.scopes.join(' '),
    });

    const authUrl = `${this.config.authUrl}?${params.toString()}`;
    return authUrl;
  }

  /**
   * 生成安全的state参数
   * 用于CSRF防护和回调状态追踪
   */
  private generateState(storeId?: string, redirectUrl?: string): string {
    const stateData = {
      storeId,
      redirect: redirectUrl || '/delivery',
      timestamp: Date.now(),
      nonce: this.generateNonce(),
    };
    return Buffer.from(JSON.stringify(stateData)).toString('base64');
  }

  /**
   * 生成随机nonce用于安全验证
   */
  private generateNonce(): string {
    return Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * 处理OAuth回调
   * Uber授权后重定向回此端点
   */
  async handleCallback(code: string, state: string): Promise<OAuthResult> {
    try {
      const params = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: this.config.redirectUri,
        client_id: this.config.clientId,
      });

      const tokenResponse = await fetch(this.config.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64')}`,
        },
        body: params.toString(),
        cache: 'no-store',
      });

      const tokenData = await this.parseTokenResponse(tokenResponse);
      if (!tokenData) {
        throw new Error('Failed to parse token response');
      }

      return {
        success: true,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresIn: tokenData.expires_in,
      };
    } catch (error) {
      console.error('[Uber Eats OAuth] Error exchanging authorization code:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * 解析Uber OAuth token响应
   */
  private async parseTokenResponse(response: Response): Promise<{
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  } | null> {
    const text = await response.text();
    try {
      const data = JSON.parse(text);

      return {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_in: data.expires_in,
      };
    } catch (error) {
      console.error('[Uber Eats OAuth] Error parsing token response:', error);

      // Try text/x-www-form-urlencoded format
      try {
        const params = new URLSearchParams(text);
        return {
          access_token: params.get('access_token') || undefined,
          refresh_token: params.get('refresh_token') || undefined,
          expires_in: params.get('expires_in') ? parseInt(params.get('expires_in') || '') : undefined,
        };
      } catch {
        return null;
      }
    }
  }

  /**
   * 获取OAuth配置状态（用于调试）
   */
  getConfigStatus(): { configured: boolean; issues: string[] } {
    const issues: string[] = [];

    if (!this.config.clientId) {
      issues.push('UBEREATS_CLIENT_ID not configured');
    }
    if (!this.config.clientSecret) {
      issues.push('UBEREATS_CLIENT_SECRET not configured');
    }
    if (!this.config.redirectUri) {
      issues.push('NEXT_PUBLIC_APP_URL not configured for redirect URI');
    }
    if (!this.config.authUrl) {
      issues.push('UBEREATS_OAUTH_AUTHORIZE_URL not configured');
    }
    if (!this.config.tokenUrl) {
      issues.push('UBEREATS_OAUTH_TOKEN_URL not configured');
    }

    return {
      configured: issues.length === 0,
      issues,
    };
  }
}

// Export singleton instance
export const uberEatsOAuthService = new UberEatsOAuthService();
