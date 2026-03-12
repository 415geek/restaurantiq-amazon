# Nova Act Integration Setup Guide

## 📋 Overview

Nova Act is a live browser simulation service that enables RestaurantIQ to:
- Scrape delivery platform menus (Uber Eats, DoorDash, Grubhub, etc.)
- Monitor competitor pricing in real-time
- Track promotional campaigns across platforms
- Analyze market trends and pricing strategies
- Simulate human browsing behavior for data collection

## ⚠️ Current Status

**Status**: ⚠️ Not Configured (Using Fallback)

The message "Nova Act live browser simulation is not configured. Showing fallback market scan." indicates that:
- Nova Act is not enabled
- The system is using mock/fallback data for market scans
- Real-time competitor data is not being collected

## 🚀 Setup Steps

### Step 1: Obtain Nova Act Credentials

1. Contact Nova Act to get access to their browser simulation API
2. You'll receive:
   - **API Endpoint**: The URL for Nova Act API
   - **API Key**: Your authentication key
   - **Documentation**: API usage guidelines

### Step 2: Configure Environment Variables

Add the following to your `.env.local` file:

```bash
# Nova Act - Live Browser Simulation
NOVA_ACT_ENABLED=true
NOVA_ACT_ENDPOINT=https://your-nova-act-endpoint.com/api/v1/scan
NOVA_ACT_API_KEY=your_nova_act_api_key_here
```

### Step 3: Restart the Application

```bash
npm run dev
```

### Step 4: Verify Configuration

After restarting, the warning message should disappear and real market scans should work.

## 🔧 Configuration Options

| Variable | Required | Description | Default |
|----------|----------|-------------|---------|
| `NOVA_ACT_ENABLED` | Yes | Enable/disable Nova Act integration | `false` |
| `NOVA_ACT_ENDPOINT` | Yes | Nova Act API endpoint URL | (empty) |
| `NOVA_ACT_API_KEY` | Yes | Nova Act API authentication key | (empty) |

## 📊 How Nova Act Works

### Market Scan Flow

```
User Request → Nova Act Adapter → Nova Act API
                                    ↓
                            Browser Simulation
                                    ↓
                            Scrape Delivery Platforms
                                    ↓
                            Extract Menu & Pricing Data
                                    ↓
                            Return to RestaurantIQ
                                    ↓
                            Analysis & Recommendations
```

### Data Collected

When enabled, Nova Act collects:

1. **Menu Items**
   - Platform (Uber Eats, DoorDash, Grubhub, etc.)
   - Item name and category
   - Price and currency
   - Availability status

2. **Campaign Signals**
   - Promotional offers
   - Discount campaigns
   - Status (active, scheduled)

3. **Competitor Analysis**
   - Pricing comparison
   - Menu variety
   - Promotion strategies

## 🎯 Use Cases

### 1. Competitive Pricing Analysis
- Monitor competitor menu prices in real-time
- Identify pricing opportunities
- Adjust your pricing strategy

### 2. Menu Optimization
- See what competitors are offering
- Identify popular menu categories
- Optimize your menu for competitiveness

### 3. Campaign Tracking
- Monitor competitor promotions
- Identify promotional trends
- Plan your own campaigns strategically

### 4. Market Intelligence
- Understand local market dynamics
- Track delivery platform trends
- Make data-driven decisions

## 🐛 Troubleshooting

### Error: "Nova Act live browser simulation is not configured"

**Cause**: Nova Act is not enabled or credentials are missing

**Solution**:
1. Set `NOVA_ACT_ENABLED=true` in `.env.local`
2. Add `NOVA_ACT_ENDPOINT` with your API endpoint
3. Add `NOVA_ACT_API_KEY` with your API key
4. Restart the development server

### Error: "Nova Act market scan failed"

**Cause**: API endpoint is unreachable or invalid credentials

**Solution**:
1. Verify `NOVA_ACT_ENDPOINT` is correct
2. Check `NOVA_ACT_API_KEY` is valid
3. Ensure Nova Act service is operational
4. Check network connectivity

### Error: "Nova Act returned empty payload"

**Cause**: Nova Act API returned no data

**Solution**:
1. Verify the business name and city are correct
2. Check if the business exists on delivery platforms
3. Contact Nova Act support if issue persists

## 🔒 Security Best Practices

1. **Never commit `.env.local`** to git
2. **Use environment variables** for all credentials
3. **Rotate API keys regularly** (every 90 days recommended)
4. **Monitor API usage** for unusual activity
5. **Use HTTPS** for all API calls
6. **Implement rate limiting** to prevent abuse

## 📈 Fallback Behavior

When Nova Act is not configured, the system uses fallback data:

### Fallback Menu Items
- Mock menu items based on business name
- Simulated pricing data
- Platform-specific examples

### Fallback Campaigns
- Sample promotional campaigns
- Mock campaign details
- Simulated status information

**Note**: Fallback data is for demonstration only and does not reflect real market conditions.

## 📝 API Request Format

When enabled, Nova Act receives requests in this format:

```json
{
  "businessName": "Restaurant Name",
  "city": "San Francisco",
  "objective": "fetch_delivery_menu_pricing_and_campaign_signals"
}
```

## 📤 API Response Format

Nova Act should return data in this format:

```json
{
  "menuItems": [
    {
      "platform": "Uber Eats",
      "name": "Signature Combo",
      "category": "Combo",
      "price": 18.9,
      "currency": "USD"
    }
  ],
  "campaigns": [
    {
      "platform": "Uber Eats",
      "title": "Rainy-day delivery offer",
      "detail": "10% off orders above $28",
      "status": "active"
    }
  ]
}
```

## 🎉 Success Criteria

You'll know Nova Act is working when:

1. ✅ Warning message disappears
2. ✅ Real menu data appears in market scans
3. ✅ Competitor pricing is accurate
4. ✅ Campaign data is current
5. ✅ No fallback warnings in logs

## 📞 Support

For Nova Act integration issues:
- Contact Nova Act support for API-related questions
- Check Nova Act documentation for API usage
- Review logs for detailed error messages

## 🔄 Current Status

- **Configuration**: ⚠️ Not configured
- **Mode**: Fallback (mock data)
- **Real Data**: Not available
- **Action Required**: Obtain Nova Act credentials and configure

## 📚 Related Documentation

- **Integration Status**: `docs/INTEGRATION_STATUS.md`
- **Environment Variables**: `.env.example`
- **Adapter Code**: `lib/server/adapters/nova-act-market-scan.ts`

---

**Note**: Nova Act is an optional integration. The app will continue to function with fallback data, but real-time market intelligence requires Nova Act credentials.