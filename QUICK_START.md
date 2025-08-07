# 🚀 FOGG Calendar Dashboard - Quick Start

## 🎯 Goal: Get https://fogg.candlefish.ai working

### ⚡ 2-Minute Setup

1. **Add DNS Record** (manual - Porkbun API unavailable):
   ```
   Go to: https://porkbun.com/account/domainsSpeedy
   Find: candlefish.ai → Manage
   Add:  CNAME | fogg | fogg-calendar.netlify.app | 300
   Save
   ```

2. **Wait & Verify** (5-15 minutes):
   ```bash
   ./test-dns.sh
   ```

3. **Complete Setup**:
   ```bash
   ./complete-setup.sh
   ```

### 📋 Available Scripts

| Script | Purpose |
|--------|---------|
| `./test-dns.sh` | Quick status check |
| `./manual-dns-setup.sh` | Interactive setup guide |
| `./complete-setup.sh` | Final verification |
| `./configure-netlify-ssl.sh` | SSL configuration |

### ✅ Success Indicators
- `./test-dns.sh` shows all green checkmarks
- https://fogg.candlefish.ai loads the dashboard
- SSL certificate is valid

### 🎉 Result
Leslie accesses the FOGG Calendar Dashboard at:
**https://fogg.candlefish.ai**

---
*Total setup time: ~10 minutes (5 min manual + 5 min propagation)*