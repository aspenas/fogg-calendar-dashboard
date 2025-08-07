#!/bin/bash

# FOGG Calendar Dashboard - Netlify SSL Configuration Script
# This script configures SSL and tests the Netlify setup for fogg.candlefish.ai
# Run this AFTER DNS has been configured at Porkbun

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
FULL_DOMAIN="fogg.candlefish.ai"
NETLIFY_SITE_ID="6b61d203-0871-40e6-bf78-d58b5089b5a6"
AWS_REGION="us-east-1"

# Log functions
log() { echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1" >&2; }
success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }

# Get Netlify token from AWS Secrets Manager
get_netlify_token() {
    log "Retrieving Netlify API token from AWS Secrets Manager..."
    
    NETLIFY_CREDS=$(aws secretsmanager get-secret-value \
        --secret-id "netlify-api-token" \
        --region ${AWS_REGION} \
        --query SecretString \
        --output text)
    
    if [ $? -ne 0 ]; then
        error "Failed to retrieve Netlify credentials from AWS Secrets Manager"
        exit 1
    fi
    
    export NETLIFY_AUTH_TOKEN=$(echo ${NETLIFY_CREDS} | jq -r '.token')
    success "Retrieved Netlify API token"
}

# Check DNS configuration
check_dns() {
    log "Checking DNS configuration for ${FULL_DOMAIN}..."
    
    if nslookup ${FULL_DOMAIN} > /dev/null 2>&1; then
        success "✓ DNS resolution working for ${FULL_DOMAIN}"
        
        # Get the resolved address
        RESOLVED_ADDR=$(nslookup ${FULL_DOMAIN} 2>/dev/null | grep -A1 "Name:" | tail -1 | awk '{print $2}')
        log "Resolves to: ${RESOLVED_ADDR}"
        return 0
    else
        error "❌ DNS not yet configured for ${FULL_DOMAIN}"
        echo
        echo "Please configure DNS first:"
        echo "1. Go to Porkbun DNS management for candlefish.ai"
        echo "2. Add CNAME record: fogg → fogg-calendar.netlify.app"
        echo "3. Wait 5-15 minutes for propagation"
        echo "4. Run this script again"
        echo
        return 1
    fi
}

# Get site status from Netlify
get_site_status() {
    log "Getting Netlify site status..."
    
    SITE_INFO=$(curl -s \
        -H "Authorization: Bearer ${NETLIFY_AUTH_TOKEN}" \
        "https://api.netlify.com/api/v1/sites/${NETLIFY_SITE_ID}")
    
    if echo ${SITE_INFO} | jq -e '.name' > /dev/null; then
        SITE_NAME=$(echo ${SITE_INFO} | jq -r '.name')
        SITE_URL=$(echo ${SITE_INFO} | jq -r '.ssl_url // .url')
        SSL_STATUS=$(echo ${SITE_INFO} | jq -r '.ssl')
        
        success "Site found: ${SITE_NAME}"
        log "Current URL: ${SITE_URL}"
        log "SSL enabled: ${SSL_STATUS}"
        
        # Check custom domains
        CUSTOM_DOMAIN=$(echo ${SITE_INFO} | jq -r '.custom_domain')
        if [ "${CUSTOM_DOMAIN}" == "${FULL_DOMAIN}" ]; then
            success "✓ Custom domain configured: ${CUSTOM_DOMAIN}"
        else
            warning "Custom domain mismatch: expected ${FULL_DOMAIN}, got ${CUSTOM_DOMAIN}"
        fi
    else
        error "Failed to get site information"
        echo ${SITE_INFO}
        exit 1
    fi
}

# Provision SSL certificate
provision_ssl() {
    log "Checking SSL certificate status..."
    
    # First check if SSL is already working
    if curl -s --max-time 10 "https://${FULL_DOMAIN}" > /dev/null; then
        success "✓ SSL certificate already working!"
        return 0
    fi
    
    log "Attempting to provision SSL certificate..."
    
    SSL_RESULT=$(curl -s \
        -X POST \
        -H "Authorization: Bearer ${NETLIFY_AUTH_TOKEN}" \
        "https://api.netlify.com/api/v1/sites/${NETLIFY_SITE_ID}/ssl")
    
    if echo ${SSL_RESULT} | jq -e '.state' > /dev/null; then
        SSL_STATE=$(echo ${SSL_RESULT} | jq -r '.state')
        success "SSL provisioning initiated (state: ${SSL_STATE})"
        
        if [ "${SSL_STATE}" == "provisioning" ]; then
            log "SSL certificate is being provisioned. This may take a few minutes..."
        fi
    elif echo ${SSL_RESULT} | grep -q "already exists"; then
        success "SSL certificate already exists"
    elif echo ${SSL_RESULT} | grep -q "bad dns"; then
        warning "SSL provisioning failed due to DNS issues"
        log "DNS must be properly configured before SSL can be provisioned"
        return 1
    else
        warning "SSL provisioning response: ${SSL_RESULT}"
        log "This might be normal if SSL is already configured"
    fi
}

# Test the domain thoroughly
test_domain() {
    log "Testing domain configuration..."
    
    # Test HTTP first
    log "Testing HTTP access..."
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "http://${FULL_DOMAIN}" || echo "000")
    
    if [ "${HTTP_STATUS}" == "301" ] || [ "${HTTP_STATUS}" == "200" ]; then
        success "✓ HTTP access working (status: ${HTTP_STATUS})"
    else
        warning "HTTP access issue (status: ${HTTP_STATUS})"
    fi
    
    # Test HTTPS
    log "Testing HTTPS access..."
    HTTPS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "https://${FULL_DOMAIN}" || echo "000")
    
    if [ "${HTTPS_STATUS}" == "200" ]; then
        success "✓ HTTPS access working!"
        
        # Get SSL certificate info
        log "Checking SSL certificate details..."
        SSL_INFO=$(curl -s --max-time 10 "https://${FULL_DOMAIN}" -D - -o /dev/null | grep -i "HTTP\|server\|strict-transport" || true)
        if [ ! -z "${SSL_INFO}" ]; then
            echo "SSL Headers: ${SSL_INFO}"
        fi
        
    elif [ "${HTTPS_STATUS}" == "000" ]; then
        warning "HTTPS not yet available (connection timeout/refused)"
        log "This is normal if SSL certificate is still being provisioned"
    else
        warning "HTTPS access issue (status: ${HTTPS_STATUS})"
    fi
    
    # DNS propagation check
    log "Checking DNS propagation with dig..."
    if command -v dig &> /dev/null; then
        DIG_RESULT=$(dig ${FULL_DOMAIN} CNAME +short || echo "No CNAME found")
        log "DNS CNAME record: ${DIG_RESULT}"
    fi
}

# Wait for SSL provisioning
wait_for_ssl() {
    log "Waiting for SSL certificate to be ready (up to 5 minutes)..."
    
    for i in {1..30}; do
        if curl -s --max-time 5 "https://${FULL_DOMAIN}" > /dev/null; then
            success "✓ SSL certificate is ready!"
            return 0
        else
            echo -n "."
            sleep 10
        fi
    done
    
    warning "SSL certificate not ready yet. This can take up to 24 hours."
    log "You can check manually later at: https://${FULL_DOMAIN}"
}

# Main execution
main() {
    log "Starting FOGG Calendar Dashboard SSL configuration..."
    log "Target domain: ${FULL_DOMAIN}"
    echo
    
    get_netlify_token
    
    if ! check_dns; then
        exit 1
    fi
    
    get_site_status
    provision_ssl
    test_domain
    
    # If HTTPS isn't working yet, wait a bit
    HTTPS_CHECK=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "https://${FULL_DOMAIN}" || echo "000")
    if [ "${HTTPS_CHECK}" != "200" ]; then
        wait_for_ssl
    fi
    
    echo
    success "🎉 Configuration completed!"
    echo
    echo "Summary:"
    echo "• Domain: https://${FULL_DOMAIN}"
    echo "• Netlify Site: ${NETLIFY_SITE_ID}"
    echo "• SSL: Configured (may take up to 24 hours to fully propagate)"
    echo
    echo "Leslie can access the FOGG Calendar Dashboard at:"
    echo "🔗 https://${FULL_DOMAIN}"
    echo
    
    # Final test
    log "Performing final connectivity test..."
    if curl -s --max-time 10 "https://${FULL_DOMAIN}" > /dev/null; then
        success "✅ https://${FULL_DOMAIN} is fully operational!"
    else
        warning "⏳ https://${FULL_DOMAIN} may still be propagating. Check again in a few minutes."
    fi
}

# Run main function
main "$@"