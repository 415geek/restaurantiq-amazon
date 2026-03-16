/**
 * UberEats Direct API Client
 * https://developer.uber.com/docs/eats/api/v2/get-orders
 */

export interface UberEatsConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scope?: string[];
}

export interface UberEatsOrder {
  id: string;
  display_id: string;
  store: {
    id: string;
    name: string;
  };
  eater: {
    first_name: string;
    phone?: string;
  };
  cart: {
    items: Array<{
      title: string;
      quantity: number;
      price: {
        unit_price: { amount: number; currency_code: string };
        total_price: { amount: number; currency_code: string };
      };
      special_instructions?: string;
    }>;
  };
  payment: {
    charges: {
      total: { amount: number; currency_code: string };
      sub_total: { amount: number; currency_code: string };
      tax: { amount: number; currency_code: string };
    };
  };
  placed_at: string;
  estimated_ready_for_pickup_at?: string;
  current_state: 'CREATED' | 'ACCEPTED' | 'DENIED' | 'FINISHED' | 'CANCELLED';
  type: 'PICK_UP' | 'DINE_IN' | 'DELIVERY_BY_UBER' | 'DELIVERY_BY_RESTAURANT';
}

export interface UberEatsTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

export class UberEatsClient {
  private config: UberEatsConfig;
  private accessToken?: string;
  private tokenExpiry?: Date;

  constructor(config: UberEatsConfig) {
    this.config = {
      ...config,
      scope: config.scope || ['eats.store', 'eats.order', 'eats.store.orders.read'],
    };
  }

  /**
   * Generate OAuth authorization URL
   */
  getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      scope: this.config.scope!.join(' '),
      state,
    });
    return `https://login.uber.com/oauth/v2/authorize?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code: string): Promise<UberEatsTokenResponse> {
    const response = await fetch('https://login.uber.com/oauth/v2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        grant_type: 'authorization_code',
        redirect_uri: this.config.redirectUri,
        code,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`UberEats token exchange failed: ${error}`);
    }

    const tokens = (await response.json()) as UberEatsTokenResponse;
    this.accessToken = tokens.access_token;
    this.tokenExpiry = new Date(Date.now() + tokens.expires_in * 1000);

    return tokens;
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(refreshToken: string): Promise<UberEatsTokenResponse> {
    const response = await fetch('https://login.uber.com/oauth/v2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to refresh UberEats token');
    }

    const tokens = (await response.json()) as UberEatsTokenResponse;
    this.accessToken = tokens.access_token;
    this.tokenExpiry = new Date(Date.now() + tokens.expires_in * 1000);

    return tokens;
  }

  /**
   * Set access token directly (for stored tokens)
   */
  setAccessToken(token: string, expiresAt?: Date): void {
    this.accessToken = token;
    this.tokenExpiry = expiresAt;
  }

  /**
   * Get list of stores
   */
  async getStores(): Promise<Array<{ store_id: string; name: string; address: string }>> {
    const response = await this.makeRequest('/v1/eats/stores');
    return (response as { stores?: Array<{ store_id: string; name: string; address: string }> }).stores || [];
  }

  /**
   * Get orders for a store
   */
  async getOrders(storeId: string, status?: string): Promise<UberEatsOrder[]> {
    const params = new URLSearchParams();
    if (status) params.set('status', status);

    const response = await this.makeRequest(
      `/v2/eats/orders?store_id=${storeId}&${params.toString()}`
    );
    return (response as { orders?: UberEatsOrder[] }).orders || [];
  }

  /**
   * Get single order details
   */
  async getOrder(orderId: string): Promise<UberEatsOrder> {
    return this.makeRequest(`/v2/eats/order/${orderId}`);
  }

  /**
   * Accept an order
   */
  async acceptOrder(orderId: string, readyTime?: number): Promise<void> {
    await this.makeRequest(`/v2/eats/order/${orderId}/accept`, {
      method: 'POST',
      body: JSON.stringify({
        reason: 'accepted',
        ready_for_pickup_time: readyTime || 20, // minutes
      }),
    });
  }

  /**
   * Deny an order
   */
  async denyOrder(orderId: string, reason: string): Promise<void> {
    await this.makeRequest(`/v2/eats/order/${orderId}/deny`, {
      method: 'POST',
      body: JSON.stringify({
        reason: {
          explanation: reason,
          code: 'STORE_CLOSED', // or other valid codes
        },
      }),
    });
  }

  /**
   * Mark order ready for pickup
   */
  async markOrderReady(orderId: string): Promise<void> {
    await this.makeRequest(`/v2/eats/order/${orderId}/ready`, {
      method: 'POST',
    });
  }

  private async makeRequest(path: string, options: RequestInit = {}): Promise<any> {
    if (!this.accessToken) {
      throw new Error('UberEats client not authenticated');
    }

    const response = await fetch(`https://api.uber.com${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        ...(options.headers ?? {}),
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`UberEats API error: ${response.status} - ${error}`);
    }

    return response.json();
  }
}

// Singleton instance
let ubereatsClient: UberEatsClient | null = null;

export function getUberEatsClient(): UberEatsClient {
  if (!ubereatsClient) {
    const clientId = process.env.UBEREATS_CLIENT_ID;
    const clientSecret = process.env.UBEREATS_CLIENT_SECRET;
    const redirectUri =
      process.env.UBEREATS_REDIRECT_URI ||
      `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/ubereats/callback`;

    if (!clientId || !clientSecret) {
      throw new Error('UberEats credentials not configured');
    }

    ubereatsClient = new UberEatsClient({
      clientId,
      clientSecret,
      redirectUri,
    });
  }
  return ubereatsClient;
}

export function isUberEatsConfigured(): boolean {
  return Boolean(process.env.UBEREATS_CLIENT_ID && process.env.UBEREATS_CLIENT_SECRET);
}

