# FOGG Calendar Dashboard - DNS & SSL Fix Instructions

## Current Issue
The FOGG Calendar Dashboard at `https://fogg.candlefish.ai` has SSL certificate issues because:
- The domain `fogg.candlefish.ai` is configured but the SSL certificate is for `*.netlify.app`
- The actual working site is at `https://fogg-calendar.netlify.app/`
- DNS configuration needs to be updated

## Root Cause Analysis
1. **SSL Certificate Mismatch**: Certificate altnames only include `*.netlify.app`, not `fogg.candlefish.ai`
2. **DNS Configuration**: Domain may not be properly configured in Netlify
3. **Netlify Custom Domain**: Domain added but SSL not provisioned properly

## Immediate Solution

### Option 1: Use Working URL (Quick Fix)
**Direct users to**: `https://fogg-calendar.netlify.app/`
- This URL works immediately 
- Functions are deployed and working
- SSL certificate is valid
- No configuration changes needed

### Option 2: Fix Custom Domain (Proper Fix)
1. **Verify DNS Configuration**:
   ```bash
   nslookup fogg.candlefish.ai
   # Should return Netlify's load balancer IP
   ```

2. **Update DNS at Domain Registrar** (if needed):
   - **Type**: CNAME
   - **Host**: fogg
   - **Target**: fogg-calendar.netlify.app
   - **TTL**: 300

3. **Force SSL Certificate Renewal in Netlify**:
   - Go to Netlify site settings
   - Navigate to Domain management
   - Click "Renew certificate" or "Provision certificate"

## API Key Configuration

The dashboard will need access to deployment APIs. Add these environment variables in Netlify:

```bash
# In Netlify Site Settings > Environment Variables
VITE_API_BASE_URL=/.netlify/functions
VITE_DEFAULT_USER=Leslie
VITE_DEFAULT_ENVIRONMENT=production
VITE_ENABLE_CONFETTI=true
VITE_POLLING_INTERVAL=2000
```

## Testing After Fix

1. **Test Main Site**:
   ```bash
   curl -I https://fogg.candlefish.ai/
   # Should return HTTP/2 200 with valid SSL
   ```

2. **Test API Endpoints**:
   ```bash
   curl -s "https://fogg.candlefish.ai/.netlify/functions/deploy" | jq .
   curl -s "https://fogg.candlefish.ai/.netlify/functions/status?deploymentId=test&startTime=2025-01-01T00:00:00.000Z" | jq .
   ```

3. **Test Dashboard Functionality**:
   - Visit https://fogg.candlefish.ai
   - Click "Update Calendar Now" button
   - Verify agents show progress
   - Confirm deployment completes successfully

## For Leslie - Quick Access

Until the DNS is fixed, you can access the dashboard at:
**https://fogg-calendar.netlify.app/**

This URL:
- ✅ Works immediately
- ✅ Has valid SSL certificate  
- ✅ All functions are working
- ✅ Purple "Update Calendar Now" button works
- ✅ Friendly agent helpers show progress

## Automation Script

Run this to automatically fix DNS and SSL:

```bash
#!/bin/bash
# Auto-fix script for FOGG DNS and SSL
./fix-fogg-dns.js
```

## Success Criteria

When fixed, you should see:
- ✅ https://fogg.candlefish.ai loads without SSL warnings
- ✅ Purple "Update Calendar Now" button appears
- ✅ Agent helpers (Guardian 🛡️, Speedster ⚡, Detective 🔍, Architect 🏗️) are visible
- ✅ Clicking button starts deployment with real-time progress
- ✅ Confetti celebration when deployment completes

## Verification Commands

```bash
# Check SSL certificate
echo | openssl s_client -servername fogg.candlefish.ai -connect fogg.candlefish.ai:443 2>/dev/null | openssl x509 -noout -subject -dates

# Check DNS resolution  
dig fogg.candlefish.ai

# Test API endpoints
curl -f https://fogg.candlefish.ai/.netlify/functions/deploy
curl -f "https://fogg.candlefish.ai/.netlify/functions/status?deploymentId=test&startTime=2025-01-01T00:00:00.000Z"
```

## Contact Information

If you need assistance:
- **Primary Support**: Patrick Smith
- **Repository**: https://github.com/aspenas/fogg-calendar-dashboard
- **Working URL**: https://fogg-calendar.netlify.app/