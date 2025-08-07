# FOGG Calendar Dashboard - Subdomain Setup Guide

## Overview
This guide sets up `fogg.candlefish.ai` for the FOGG Calendar Dashboard currently hosted on Netlify.

## Current Status
- ✅ **Netlify Site**: Already configured (`fogg-calendar` site ID: `6b61d203-0871-40e6-bf78-d58b5089b5a6`)
- ✅ **Custom Domain**: Already added to Netlify (`fogg.candlefish.ai`)
- ❌ **DNS Record**: Needs to be created at Porkbun
- ❌ **SSL Certificate**: Will be auto-provisioned once DNS is working

## Quick Setup (Manual)

### Step 1: DNS Configuration at Porkbun
Since the API is currently returning 403 errors, you'll need to manually create the DNS record:

1. Go to [Porkbun DNS Management](https://porkbun.com/account/domainsSpeedy)
2. Find `candlefish.ai` domain
3. Click "Manage"
4. Add a new DNS record:
   - **Type**: CNAME
   - **Host**: fogg
   - **Answer**: fogg-calendar.netlify.app
   - **TTL**: 300 (5 minutes)

### Step 2: Verify DNS Propagation
Wait 5-15 minutes, then test:
```bash
nslookup fogg.candlefish.ai
```

### Step 3: SSL Certificate
Once DNS is working, Netlify will automatically provision an SSL certificate. You can force it by running:
```bash
curl -X POST -H "Authorization: Bearer $NETLIFY_API_TOKEN" "https://api.netlify.com/api/v1/sites/6b61d203-0871-40e6-bf78-d58b5089b5a6/ssl"
```

## Automated Setup (Once API is Working)

If the Porkbun API starts working again, use our automated script:
```bash
./setup-fogg-subdomain.sh
```

## Troubleshooting

### DNS Not Resolving
- Check TTL settings (should be 300 seconds)
- Wait up to 24 hours for full propagation
- Use `dig fogg.candlefish.ai` to check DNS propagation

### SSL Certificate Issues
- DNS must be working first
- Netlify automatically provisions Let's Encrypt certificates
- Can take up to 24 hours after DNS is working

### Porkbun API 403 Errors
The current API credentials may need refreshing or there might be IP restrictions:
- Check if API access is enabled for your IP
- Verify API credentials in AWS Secrets Manager
- Consider using Porkbun web interface as fallback

## Final Test
Once everything is set up, test:
```bash
curl -I https://fogg.candlefish.ai
```

Should return `HTTP/2 200` with SSL certificate working.

## For Leslie
Once DNS is configured (either manually or via script), you can access the FOGG Calendar Dashboard at:
**https://fogg.candlefish.ai**

The dashboard should load with full HTTPS security.