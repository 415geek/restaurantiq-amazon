# Uber Eats Integration Troubleshooting

## Error: "Uber Eats token missing (none). Missing: source: none. Reconnect integration or configure UBEREATS_BEARER_TOKEN."

### Understanding the Error

This error means the system cannot obtain an access token for Uber Eats. The token resolution process tries three methods in order:

1. **OAuth Connection Token** - From a previous OAuth authorization flow
2. **Environment Bearer Token** - From `UBEREATS_BEARER_TOKEN` environment variable
3. **Client Credentials Exchange** - Using `UBEREATS_CLIENT_ID` and `UBEREATS_CLIENT_SECRET`

If all three methods fail, you'll see this error.

## Common Causes and Solutions

### 1. App Not Approved for Production

**Symptoms:**
- Error: `invalid_client` or `unauthorized_client`
- Token exchange fails with HTTP 401 or 403

**Solution:**
1. Check your Uber Eats app status in the Developer Dashboard
2. Ensure your app is approved for **production** use
3. If you're using production credentials, your app must be production-approved
4. For testing, use sandbox credentials and set `UBEREATS_ENVIRONMENT=sandbox`

### 2. Incorrect Credentials

**Symptoms:**
- Error: `invalid_client` or `invalid_grant`
- Token exchange fails with HTTP 401

**Solution:**
1. Verify `UBEREATS_CLIENT_ID` is correct
2. Verify `UBEREATS_CLIENT_SECRET` is correct
3. Check for extra spaces or special characters
4. Regenerate credentials if needed in Uber Developer Dashboard

### 3. Missing or Incorrect Scopes

**Symptoms:**
- Error: `invalid_scope`
- Token exchange succeeds but API calls fail

**Solution:**
1. Ensure your app is approved for required scopes:
   - `eats.store.read`
   - `eats.store.orders.read`
   - `eats.store.status.write`
   - `eats.store.orders.write`
   - `eats.pos_provisioning`
2. Check scopes in Uber Developer Dashboard
3. Contact Uber support if scopes are missing

### 4. Wrong Environment

**Symptoms:**
- Token exchange fails with unexpected errors
- Sandbox credentials used with production endpoints (or vice versa)

**Solution:**
1. Check `UBEREATS_ENVIRONMENT` setting:
   - `sandbox` for testing
   - `production` for live use
2. Ensure OAuth URLs match environment:
   - Sandbox: `https://sandbox-login.uber.com/oauth/v2/token`
   - Production: `https://auth.uber.com/oauth/v2/token`
3. Use matching credentials for the environment

### 5. Client Assertion Configuration Issue

**Symptoms:**
- Error: `missing_assertion_config` or `invalid_client_assertion`
- Token exchange fails when `UBEREATS_OAUTH_USE_CLIENT_ASSERTION=true`

**Solution:**
1. If using client assertion, ensure:
   - `UBEREATS_ASYMMETRIC_KEY_ID` is set
   - Private key is configured (PEM, BASE64, or file path)
   - Key is valid and not expired
2. If not using client assertion, set:
   ```bash
   UBEREATS_OAUTH_USE_CLIENT_ASSERTION=false
   ```
3. Use `UBEREATS_CLIENT_SECRET` instead

## Debugging Steps

### Step 1: Check Environment Variables

Verify all required variables are set in `.env.local`:

```bash
UBEREATS_CLIENT_ID=O56MPzlKklJWokmS7wr7zuRnGn4Wc6z4
UBEREATS_CLIENT_SECRET=b0pr-KqpZwddN9BYQi0JljaYXr5M7jO2jvlwjDYY
UBEREATS_ENVIRONMENT=production
UBEREATS_OAUTH_USE_CLIENT_ASSERTION=false
UBEREATS_CLIENT_CREDENTIALS_SCOPES=eats.store.read eats.store.orders.read eats.store.status.write
```

### Step 2: Check Server Logs

Look for detailed logs in the server console:

```
[Uber Eats Token] Attempting client credentials exchange
[Uber Eats Token] Token URL: https://auth.uber.com/oauth/v2/token
[Uber Eats Token] Scope: eats.store.read eats.store.orders.read eats.store.status.write
[Uber Eats Token] Client ID: O56MPzlK...
[Uber Eats Token] Request body prepared
[Uber Eats Token] Response status: 401
[Uber Eats Token] Response data: {"error": "invalid_client", "error_description": "..."}
```

### Step 3: Test Token Exchange Manually

Use curl to test the token exchange:

```bash
curl -X POST https://auth.uber.com/oauth/v2/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "client_secret=YOUR_CLIENT_SECRET" \
  -d "grant_type=client_credentials" \
  -d "scope=eats.store.read eats.store.orders.read eats.store.status.write"
```

Expected response:
```json
{
  "access_token": "your_access_token_here",
  "token_type": "Bearer",
  "expires_in": 3600,
  "scope": "eats.store.read eats.store.orders.read eats.store.status.write"
}
```

### Step 4: Verify App Status

1. Go to https://developer.uber.com/dashboard
2. Select your Uber Eats app
3. Check:
   - App status (should be "Active" or "Approved")
   - Environment (Sandbox vs Production)
   - Approved scopes
   - Redirect URIs

### Step 5: Check OAuth Flow

If you're using OAuth (not client credentials):

1. Navigate to Settings → Integrations
2. Click "Authorize" for Uber Eats
3. Complete the OAuth flow
4. Check for errors in the callback

## Quick Fixes

### Fix 1: Use Client Secret (Recommended)

Ensure these settings in `.env.local`:

```bash
UBEREATS_OAUTH_USE_CLIENT_ASSERTION=false
UBEREATS_CLIENT_ID=O56MPzlKklJWokmS7wr7zuRnGn4Wc6z4
UBEREATS_CLIENT_SECRET=b0pr-KqpZwddN9BYQi0JljaYXr5M7jO2jvlwjDYY
```

### Fix 2: Switch to Sandbox (For Testing)

If your app is not production-approved:

```bash
UBEREATS_ENVIRONMENT=sandbox
UBEREATS_OAUTH_TOKEN_URL=https://sandbox-login.uber.com/oauth/v2/authorize
UBEREATS_OAUTH_TOKEN_URL=https://sandbox-login.uber.com/oauth/v2/token
```

### Fix 3: Use Bearer Token (Alternative)

If you have a server token:

```bash
UBEREATS_BEARER_TOKEN=your_server_token_here
UBEREATS_USE_SERVER_TOKEN=true
```

## Common Error Messages

| Error | Cause | Solution |
|-------|-------|----------|
| `invalid_client` | Wrong client ID/secret or app not approved | Verify credentials and app status |
| `unauthorized_client` | App not approved for production | Use sandbox or get production approval |
| `invalid_scope` | Missing or incorrect scopes | Check approved scopes in dashboard |
| `invalid_grant` | Invalid authorization code | Complete OAuth flow again |
| `missing_assertion_config` | Client assertion not configured | Set `UBEREATS_OAUTH_USE_CLIENT_ASSERTION=false` |
| `server_error` | Uber API issue | Try again later or check Uber status |

## Getting Help

If you're still having issues:

1. **Check Uber Developer Dashboard**: https://developer.uber.com/dashboard
2. **Review Uber Eats Documentation**: https://developer.uber.com/docs/eats
3. **Contact Uber Support**: https://developer.uber.com/support
4. **Check Server Logs**: Look for detailed error messages
5. **Verify Environment**: Ensure all variables are correctly set

## Next Steps

Once the token issue is resolved:

1. ✅ Verify connection status in Settings → Integrations
2. ✅ Test order fetching in Delivery page
3. ✅ Test menu synchronization
4. ✅ Configure webhook notifications

---

**Note**: The most common cause is that the app is not approved for production use. If you're just testing, switch to sandbox environment.