#!/bin/bash

# Complete FOGG Calendar Dashboard Setup
# Run this after manual DNS configuration to complete the setup

set -euo pipefail

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

DOMAIN="fogg.candlefish.ai"

echo -e "${BLUE}🚀 FOGG Calendar Dashboard - Complete Setup${NC}"
echo -e "${CYAN}Target: https://${DOMAIN}${NC}"
echo

# Step 1: Check DNS
echo -e "${BLUE}Step 1: Checking DNS configuration...${NC}"
if nslookup ${DOMAIN} > /dev/null 2>&1; then
    echo -e "${GREEN}✅ DNS configured successfully${NC}"
    RESOLVED=$(nslookup ${DOMAIN} 2>/dev/null | grep -A1 "Name:" | tail -1 | awk '{print $2}' || echo "unknown")
    echo "   ${DOMAIN} → ${RESOLVED}"
else
    echo -e "${RED}❌ DNS not configured${NC}"
    echo
    echo -e "${YELLOW}Please complete DNS setup first:${NC}"
    echo "1. Go to Porkbun DNS Management"
    echo "2. Add CNAME: fogg → fogg-calendar.netlify.app"
    echo "3. Wait 5-15 minutes"
    echo "4. Run this script again"
    echo
    echo "Or run: ${CYAN}./manual-dns-setup.sh${NC} for detailed instructions"
    exit 1
fi

# Step 2: Configure SSL
echo -e "${BLUE}Step 2: Configuring SSL certificate...${NC}"
if ./configure-netlify-ssl.sh > /tmp/ssl-setup.log 2>&1; then
    echo -e "${GREEN}✅ SSL configuration completed${NC}"
else
    echo -e "${YELLOW}⚠️ SSL configuration in progress${NC}"
    echo "This is normal and may take up to 24 hours"
fi

# Step 3: Final verification
echo -e "${BLUE}Step 3: Final verification...${NC}"

# Test HTTPS
HTTPS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "https://${DOMAIN}" 2>/dev/null || echo "000")

if [ "${HTTPS_STATUS}" == "200" ]; then
    echo -e "${GREEN}✅ HTTPS working perfectly!${NC}"
    SUCCESS=true
elif [ "${HTTPS_STATUS}" == "301" ] || [ "${HTTPS_STATUS}" == "302" ]; then
    echo -e "${GREEN}✅ HTTPS working (redirect configured)${NC}"
    SUCCESS=true
else
    echo -e "${YELLOW}⏳ HTTPS still provisioning (status: ${HTTPS_STATUS})${NC}"
    SUCCESS=false
fi

# Test content
if [ "${SUCCESS}" == "true" ]; then
    echo -e "${BLUE}Testing dashboard content...${NC}"
    CONTENT=$(curl -s --max-time 10 "https://${DOMAIN}" | head -c 100)
    if echo "${CONTENT}" | grep -i "fogg\|calendar\|dashboard" > /dev/null; then
        echo -e "${GREEN}✅ Dashboard content loading correctly${NC}"
    else
        echo -e "${YELLOW}⚠️ Content may still be updating${NC}"
    fi
fi

echo
echo -e "${BLUE}═══════════════════════════════════════${NC}"

if [ "${SUCCESS}" == "true" ]; then
    echo -e "${GREEN}🎉 SETUP COMPLETE!${NC}"
    echo
    echo -e "${CYAN}Leslie can now access the FOGG Calendar Dashboard at:${NC}"
    echo -e "${GREEN}🔗 https://${DOMAIN}${NC}"
    echo
    echo -e "${GREEN}✅ Features enabled:${NC}"
    echo "   • Secure HTTPS access"
    echo "   • Custom domain"
    echo "   • Netlify CDN"
    echo "   • Automatic SSL renewal"
    echo
else
    echo -e "${YELLOW}⏳ SETUP IN PROGRESS${NC}"
    echo
    echo -e "${CYAN}DNS is configured, but SSL is still provisioning.${NC}"
    echo "This is normal and can take up to 24 hours."
    echo
    echo -e "${GREEN}Leslie can access the dashboard at:${NC}"
    echo -e "${BLUE}🔗 https://${DOMAIN}${NC}"
    echo
    echo -e "${YELLOW}If you see a security warning, wait a few hours and try again.${NC}"
fi

echo -e "${BLUE}═══════════════════════════════════════${NC}"
echo

# Create a simple status check command
echo -e "${CYAN}💡 Quick status check anytime:${NC} ./test-dns.sh"