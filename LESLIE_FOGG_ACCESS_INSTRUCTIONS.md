# FOGG Calendar Dashboard - Access Instructions for Leslie

## 🎯 Final Goal
You'll be able to access the FOGG Calendar Dashboard at: **https://fogg.candlefish.ai**

## 📋 Current Status
- ✅ **Netlify Hosting**: Ready and configured
- ✅ **Custom Domain**: Added to Netlify
- ❌ **DNS Record**: Needs manual configuration (1 step remaining)
- ⏳ **SSL Certificate**: Will auto-activate once DNS is working

## 🚀 Quick Setup (5 minutes)

### Step 1: Configure DNS Record
1. Go to **[Porkbun DNS Management](https://porkbun.com/account/domainsSpeedy)**
2. Find **candlefish.ai** and click **"Manage"**
3. Click **"Add Record"**
4. Configure exactly as shown:
   ```
   Type:   CNAME
   Host:   fogg
   Answer: fogg-calendar.netlify.app
   TTL:    300
   ```
5. Click **"Save"**

### Step 2: Wait and Test (5-15 minutes)
- DNS propagation takes 5-15 minutes
- Test by visiting: **https://fogg.candlefish.ai**
- SSL certificate will activate automatically

## 🔧 Automated Testing Available

We've created scripts to help verify everything is working:

```bash
# Test DNS status
./test-dns.sh

# Get step-by-step instructions  
./manual-dns-setup.sh

# Configure SSL once DNS is working
./configure-netlify-ssl.sh
```

## ❓ Troubleshooting

### "Site can't be reached"
- **Cause**: DNS record not yet configured or still propagating
- **Solution**: Complete Step 1 above, wait 15 minutes, try again

### "Not secure" warning
- **Cause**: SSL certificate still provisioning (normal for first 24 hours)
- **Solution**: Wait or run `./configure-netlify-ssl.sh`

### Need help?
- Check: `FOGG_SUBDOMAIN_SETUP.md` for detailed technical info
- Run: `./test-dns.sh` to see current status

## 🎉 Once Complete
After DNS is configured, you'll have:
- ✅ **Secure access**: https://fogg.candlefish.ai
- ✅ **Fast loading**: Netlify CDN
- ✅ **SSL certificate**: Automatic HTTPS
- ✅ **Custom domain**: Professional URL

The FOGG Calendar Dashboard will be fully accessible at your custom domain!