#!/bin/bash

# Simple DNS test script for fogg.candlefish.ai

DOMAIN="fogg.candlefish.ai"
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}Testing DNS for ${DOMAIN}...${NC}"
echo

# Test nslookup
echo -n "DNS Resolution: "
if nslookup ${DOMAIN} > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Working${NC}"
    RESOLVED=$(nslookup ${DOMAIN} 2>/dev/null | grep -A1 "Name:" | tail -1 | awk '{print $2}' || echo "unknown")
    echo "   Resolves to: ${RESOLVED}"
else
    echo -e "${RED}❌ Not working${NC}"
    echo "   DNS record not found"
fi

# Test dig if available
if command -v dig &> /dev/null; then
    echo -n "CNAME Record: "
    CNAME=$(dig ${DOMAIN} CNAME +short 2>/dev/null || echo "")
    if [ ! -z "${CNAME}" ]; then
        echo -e "${GREEN}${CNAME}${NC}"
    else
        echo -e "${RED}Not found${NC}"
    fi
fi

echo

# Test HTTP/HTTPS
echo -n "HTTP Access: "
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "http://${DOMAIN}" 2>/dev/null || echo "000")
if [ "${HTTP_STATUS}" == "200" ] || [ "${HTTP_STATUS}" == "301" ] || [ "${HTTP_STATUS}" == "302" ]; then
    echo -e "${GREEN}✅ Working (${HTTP_STATUS})${NC}"
else
    echo -e "${RED}❌ Not working (${HTTP_STATUS})${NC}"
fi

echo -n "HTTPS Access: "
HTTPS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "https://${DOMAIN}" 2>/dev/null || echo "000")
if [ "${HTTPS_STATUS}" == "200" ]; then
    echo -e "${GREEN}✅ Working (${HTTPS_STATUS})${NC}"
else
    echo -e "${RED}❌ Not working (${HTTPS_STATUS})${NC}"
fi

echo

if [ "${HTTPS_STATUS}" == "200" ]; then
    echo -e "${GREEN}🎉 fogg.candlefish.ai is fully operational!${NC}"
    echo -e "Leslie can access it at: ${BLUE}https://${DOMAIN}${NC}"
else
    echo -e "${RED}⚠️  Configuration needed${NC}"
    echo "Run: ./manual-dns-setup.sh for instructions"
fi