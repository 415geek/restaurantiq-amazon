# Uber Eats Integration Setup Guide

## 📋 Overview

The Uber Eats integration allows RestaurantIQ to:
- View real-time orders from Uber Eats
- Accept/reject orders
- Update store status (open/closed)
- Synchronize menu items
- Receive order notifications via webhooks

## ⚠️ Important Note

**Uber Eats does not have a public API for general developers.** You must apply for and receive approval from Uber to access their API.

## 🚀 Setup Steps

### Step 1: Apply for Developer Access

1. Visit https://developer.uber.com/docs/eats
2. Click "Apply for Access" or "Get Started"
3. Fill out the application form with:
   - Your restaurant business details
   - Use case description (order management, menu sync, etc.)
   - Technical requirements
4. Wait for approval (typically 1-2 weeks)

### Step 2: Create Uber Eats App

Once approved:

1. Go to Uber Developer Dashboard: https://developer.uber.com/dashboard
2. Click "Create App" or "New App"
3. Select "Uber Eats" as the platform
4. Configure your app:
   - **App Name**: RestaurantIQ Integration
   - **Description**: Order management and menu synchronization
   - **Redirect URI**: `https://your-domain.com/api/integrations/ubereats/callback`
     - For local development: `http://localhost:3000/api/integrations/ubereats/callback`

### Step 3: Configure OAuth Scopes

Request the following scopes in your Uber Eats app:

```
eats.store.read              # Read store information
eats.store.orders.read       # Read orders
eats.store.status.write      # Update store status (open/close)
eats.store.orders.write      # Accept/reject orders
eats.pos_provisioning        # Menu synchronization
```

### Step 4: Get Your Credentials

After creating the app, you'll receive:

1. **Client ID**: Your OAuth client identifier
2. **Client Secret**: Your OAuth client secret
3. **Asymmetric Key ID** (optional, for enhanced security)
4. **Private Key** (optional, for client assertion)

### Step 5: Configure Environment Variables

Add the following to your `.env.local` file:

```bash
# Uber Eats OAuth Configuration
UBEREATS_CLIENT_ID=your_client_id_here
UBEREATS_CLIENT_SECRET=your_client_secret_here

# Optional: For enhanced security with client assertion
UBEREATS_ASYMMETRIC_KEY_ID=your_key_id_here
UBEREATS_PRIVATE_KEY_PEM=-----BEGIN PRIVATE KEY-----
your_private_key_content_here
-----END PRIVATE KEY-----

# Environment (sandbox or production)
UBEREATS_ENVIRONMENT=sandbox

# OAuth URLs (usually don't need to change)
UBEREATS_OAUTH_AUTHORIZE_URL=https://sandbox-login.uber.com/oauth/v2/authorize
UBEREATS_OAUTH_TOKEN_URL=https://sandbox-login.uber.com/oauth/v2/token

# Scopes (usually don't need to change)
UBEREATS_AUTHORIZATION_CODE_SCOPES=eats.pos_provisioning
UBEREATS_CLIENT_CREDENTIALS_SCOPES=eats.store.read eats.store.orders.read eats.store.status.write
```

### Step 6: Restart Your Application

```bash
npm run dev
```

### Step 7: Complete OAuth Flow

1. Navigate to **Settings → Integrations** in RestaurantIQ
2. Find **Uber Eats** in the integration list
3. Click **"Authorize"** or **"授权接入"**
4. You'll be redirected to Uber's authorization page
5. Log in with your Uber Eats restaurant account
6. Review and approve the requested permissions
7. You'll be redirected back to RestaurantIQ
8. The connection status should show **"Connected"**

## 🔧 Alternative: Server Token Mode

If you have a server token from Uber (simpler but less secure):

```bash
UBEREATS_BEARER_TOKEN=your_server_token_here
UBEREATS_USE_SERVER_TOKEN=true
UBEREATS_STORE_IDS=store_id_1,store_id_2
```

This mode doesn't require OAuth but is less flexible and secure.

## 📊 Testing the Integration

### 1. Check Connection Status

Go to Settings → Integrations and verify Uber Eats shows "Connected"

### 2. Test Order Fetching

Navigate to the Delivery page to see real orders from Uber Eats

### 3. Test Menu Sync

Go to Menu Management to synchronize your menu with Uber Eats

### 4. Test Webhooks

Uber Eats will send webhook events to `/api/webhooks/ubereats` for:
- New orders
- Order status updates
- Store status changes

## 🐛 Troubleshooting

### Error: "Uber Eats token missing (not_configured)"

**Cause**: Credentials not configured in `.env.local`

**Solution**:
1. Verify `UBEREATS_CLIENT_ID` and `UBEREATS_CLIENT_SECRET` are set
2. Restart the development server
3. Check that values don't contain placeholder text like `xxxxxxxx`

### Error: "Uber token exchange failed"

**Cause**: Invalid credentials or scopes

**Solution**:
1. Verify client ID and secret are correct
2. Check that your app is approved for required scopes
3. Ensure redirect URI matches in Uber Dashboard
4. Check Uber Developer Dashboard for app status

### Error: "OAuth callback failed"

**Cause**: Redirect URI mismatch or state validation error

**Solution**:
1. Verify redirect URI in Uber Dashboard matches: `https://your-domain.com/api/integrations/ubereats/callback`
2. For local dev, use: `http://localhost:3000/api/integrations/ubereats/callback`
3. Clear browser cookies and try again

### Error: "No stores found"

**Cause**: No stores associated with your Uber Eats account

**Solution**:
1. Ensure you have active stores in your Uber Eats restaurant account
2. Check that your account has proper permissions
3. Contact Uber Eats support if needed

## 🔒 Security Best Practices

1. **Never commit `.env.local`** to git
2. **Use environment variables** for all credentials
3. **Rotate keys regularly** (every 90 days recommended)
4. **Use HTTPS** in production
5. **Implement webhook signature verification**
6. **Monitor API usage** for unusual activity
7. **Use client assertion** (asymmetric keys) for enhanced security

## 📈 Production Checklist

Before going to production:

- [ ] Switch from sandbox to production environment
- [ ] Update `UBEREATS_ENVIRONMENT=production`
- [ ] Update OAuth URLs to production endpoints
- [ ] Configure production redirect URI
- [ ] Set up webhook signature verification
- [ ] Implement proper error handling
- [ ] Set up monitoring and alerts
- [ ] Test all features in production environment
- [ ] Configure rate limiting
- [ ] Set up backup authentication method

## 📞 Support

- **Uber Eats Developer Docs**: https://developer.uber.com/docs/eats
- **Uber Developer Support**: https://developer.uber.com/support
- **Uber Eats Restaurant Support**: Contact through your restaurant portal

## 📝 Additional Resources

- [Uber Eats API Reference](https://developer.uber.com/docs/eats/api-reference)
- [OAuth 2.0 Guide](https://developer.uber.com/docs/eats/oauth-2-0)
- [Webhook Guide](https://developer.uber.com/docs/eats/webhooks)

## ✅ Success Criteria

You'll know the integration is working when:

1. ✅ Uber Eats shows "Connected" in Settings → Integrations
2. ✅ You can see real orders in the Delivery page
3. ✅ Menu synchronization works
4. ✅ You can accept/reject orders
5. ✅ Store status updates work
6. ✅ Webhooks are receiving events

## 🎉 Next Steps

Once connected:

1. Configure your store settings
2. Synchronize your menu
3. Set up order notifications
4. Configure automated order acceptance rules
5. Monitor performance metrics

---

**Note**: This integration requires approval from Uber Eats. The OAuth infrastructure is fully implemented in RestaurantIQ - you just need to obtain the official credentials to activate it.