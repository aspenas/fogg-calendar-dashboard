#!/bin/bash

# Manual DNS Setup Instructions for FOGG Calendar Dashboard
# This script provides step-by-step instructions for manual DNS configuration

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

clear
echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║              FOGG Calendar Dashboard DNS Setup                 ║${NC}"
echo -e "${BLUE}║                    Manual Configuration                        ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo

echo -e "${CYAN}🎯 Goal: Configure fogg.candlefish.ai to point to Netlify${NC}"
echo -e "${CYAN}📋 Target: https://fogg.candlefish.ai${NC}"
echo

echo -e "${YELLOW}📝 STEP-BY-STEP INSTRUCTIONS:${NC}"
echo

echo -e "${GREEN}1. Open Porkbun DNS Management:${NC}"
echo "   🌐 Go to: https://porkbun.com/account/domainsSpeedy"
echo "   🔍 Find: candlefish.ai"
echo "   🔧 Click: 'Manage' button"
echo

echo -e "${GREEN}2. Add DNS Record:${NC}"
echo "   📌 Click: 'Add Record' or '+' button"
echo "   📝 Configure:"
echo "      • Type: CNAME"
echo "      • Host: fogg"
echo "      • Answer: fogg-calendar.netlify.app"
echo "      • TTL: 300 (5 minutes)"
echo "   💾 Click: 'Save' or 'Add Record'"
echo

echo -e "${GREEN}3. Wait for DNS Propagation:${NC}"
echo "   ⏰ Wait: 5-15 minutes (sometimes up to 24 hours)"
echo "   🔍 Test: Run 'nslookup fogg.candlefish.ai'"
echo

echo -e "${GREEN}4. Verify Configuration:${NC}"
echo "   🧪 Test DNS: ./test-dns.sh"
echo "   🔒 Setup SSL: ./configure-netlify-ssl.sh"
echo

echo -e "${YELLOW}⚠️  IMPORTANT NOTES:${NC}"
echo "   • The DNS record must point to: ${CYAN}fogg-calendar.netlify.app${NC}"
echo "   • Do NOT include 'https://' in the Answer field"
echo "   • TTL of 300 seconds allows for quick changes"
echo "   • SSL certificate will be auto-provisioned once DNS works"
echo

echo -e "${BLUE}🔧 QUICK REFERENCE:${NC}"
echo "┌─────────────────────────────────────────────────────────────┐"
echo "│ DNS Record Configuration                                    │"
echo "├─────────────────────────────────────────────────────────────┤"
echo "│ Type:   CNAME                                              │"
echo "│ Host:   fogg                                               │"
echo "│ Answer: fogg-calendar.netlify.app                          │"
echo "│ TTL:    300                                                │"
echo "└─────────────────────────────────────────────────────────────┘"
echo

echo -e "${GREEN}🚀 AUTOMATION AVAILABLE:${NC}"
echo "Once DNS is configured, run:"
echo "   ${CYAN}./configure-netlify-ssl.sh${NC}  # Configure SSL and test"
echo

read -p "Press Enter to continue and test current DNS status..."
echo

# Test current DNS status
echo -e "${BLUE}🔍 Testing current DNS status...${NC}"
echo

if nslookup fogg.candlefish.ai > /dev/null 2>&1; then
    echo -e "${GREEN}✅ DNS already configured!${NC}"
    echo "   fogg.candlefish.ai resolves successfully"
    
    # Get resolved address
    RESOLVED=$(nslookup fogg.candlefish.ai 2>/dev/null | grep -A1 "Name:" | tail -1 | awk '{print $2}' || echo "unknown")
    echo "   Resolves to: ${RESOLVED}"
    
    echo
    echo -e "${GREEN}🎉 Ready to configure SSL!${NC}"
    echo "Run: ${CYAN}./configure-netlify-ssl.sh${NC}"
    
else
    echo -e "${YELLOW}⏳ DNS not yet configured${NC}"
    echo "   fogg.candlefish.ai does not resolve"
    echo
    echo -e "${RED}Action required:${NC} Please follow the manual steps above"
    echo "Then run this script again to test"
fi

echo
echo -e "${CYAN}Need help? Check: FOGG_SUBDOMAIN_SETUP.md${NC}"