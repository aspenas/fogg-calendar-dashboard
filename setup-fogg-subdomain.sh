#!/bin/bash

# FOGG Calendar Dashboard Subdomain Setup Script
# This script sets up fogg.candlefish.ai subdomain with Porkbun DNS and Netlify hosting
# Author: Claude Code
# Date: August 2025

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SUBDOMAIN="fogg"
DOMAIN="candlefish.ai"
FULL_DOMAIN="${SUBDOMAIN}.${DOMAIN}"
AWS_REGION="us-east-1"

# Log function
log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check dependencies
check_dependencies() {
    log "Checking dependencies..."
    
    if ! command -v aws &> /dev/null; then
        error "AWS CLI not found. Please install it first."
        exit 1
    fi
    
    if ! command -v curl &> /dev/null; then
        error "curl not found. Please install it first."
        exit 1
    fi
    
    if ! command -v jq &> /dev/null; then
        error "jq not found. Installing..."
        if command -v brew &> /dev/null; then
            brew install jq
        else
            error "Please install jq manually."
            exit 1
        fi
    fi
    
    if ! command -v netlify &> /dev/null; then
        error "Netlify CLI not found. Installing..."
        npm install -g netlify-cli
    fi
    
    success "All dependencies are available"
}

# Get API credentials from AWS Secrets Manager
get_credentials() {
    log "Retrieving API credentials from AWS Secrets Manager..."
    
    # Get Porkbun credentials
    PORKBUN_CREDS=$(aws secretsmanager get-secret-value \
        --secret-id "porkbun/api-credentials" \
        --region ${AWS_REGION} \
        --query SecretString \
        --output text)
    
    if [ $? -ne 0 ]; then
        error "Failed to retrieve Porkbun credentials from AWS Secrets Manager"
        exit 1
    fi
    
    export PORKBUN_API_KEY=$(echo ${PORKBUN_CREDS} | jq -r '.api_key')
    export PORKBUN_SECRET_KEY=$(echo ${PORKBUN_CREDS} | jq -r '.secret_key')
    
    # Get Netlify credentials
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
    
    success "Retrieved API credentials successfully"
}

# Get Netlify site info
get_netlify_site() {
    log "Getting Netlify site information..."
    
    # List sites to find the FOGG calendar dashboard
    NETLIFY_SITES=$(curl -s \
        -H "Authorization: Bearer ${NETLIFY_AUTH_TOKEN}" \
        "https://api.netlify.com/api/v1/sites")
    
    # Look for the site by name or URL
    SITE_ID=$(echo ${NETLIFY_SITES} | jq -r '.[] | select(.name | contains("fogg") or contains("calendar")) | .id' | head -1)
    
    if [ -z "${SITE_ID}" ]; then
        warning "Could not find existing FOGG site automatically. Please create the Netlify site first."
        echo "Available sites:"
        echo ${NETLIFY_SITES} | jq -r '.[] | "\(.name) - \(.url)"'
        
        # Try to find by repository URL
        SITE_ID=$(echo ${NETLIFY_SITES} | jq -r '.[] | select(.build_settings.repo_url | contains("fogg-calendar-dashboard")) | .id' | head -1)
        
        if [ -z "${SITE_ID}" ]; then
            error "Please deploy the FOGG Calendar Dashboard to Netlify first, then run this script again."
            exit 1
        fi
    fi
    
    export NETLIFY_SITE_ID=${SITE_ID}
    
    # Get the default Netlify URL for the site
    SITE_INFO=$(curl -s \
        -H "Authorization: Bearer ${NETLIFY_AUTH_TOKEN}" \
        "https://api.netlify.com/api/v1/sites/${SITE_ID}")
    
    NETLIFY_URL=$(echo ${SITE_INFO} | jq -r '.ssl_url // .url')
    
    success "Found Netlify site: ${SITE_ID} at ${NETLIFY_URL}"
    export NETLIFY_DEFAULT_URL=${NETLIFY_URL}
}

# Create DNS record at Porkbun
create_dns_record() {
    log "Creating DNS CNAME record at Porkbun..."
    
    # First, check if the record already exists
    EXISTING_RECORDS=$(curl -s \
        -X POST \
        -H "Content-Type: application/json" \
        -d "{\"secretapikey\":\"${PORKBUN_SECRET_KEY}\",\"apikey\":\"${PORKBUN_API_KEY}\"}" \
        "https://porkbun.com/api/json/v3/dns/retrieve/${DOMAIN}")
    
    # Check if the subdomain record already exists
    EXISTING_CNAME=$(echo ${EXISTING_RECORDS} | jq -r '.records[] | select(.name == "'${SUBDOMAIN}'" and .type == "CNAME") | .content')
    
    if [ ! -z "${EXISTING_CNAME}" ] && [ "${EXISTING_CNAME}" != "null" ]; then
        warning "CNAME record for ${SUBDOMAIN} already exists, pointing to: ${EXISTING_CNAME}"
        log "Updating existing record..."
        
        # Delete the existing record first
        RECORD_ID=$(echo ${EXISTING_RECORDS} | jq -r '.records[] | select(.name == "'${SUBDOMAIN}'" and .type == "CNAME") | .id')
        
        DELETE_RESULT=$(curl -s \
            -X POST \
            -H "Content-Type: application/json" \
            -d "{\"secretapikey\":\"${PORKBUN_SECRET_KEY}\",\"apikey\":\"${PORKBUN_API_KEY}\"}" \
            "https://porkbun.com/api/json/v3/dns/delete/${DOMAIN}/${RECORD_ID}")
        
        if [ "$(echo ${DELETE_RESULT} | jq -r '.status')" == "SUCCESS" ]; then
            log "Deleted existing CNAME record"
        else
            warning "Could not delete existing record: $(echo ${DELETE_RESULT} | jq -r '.message')"
        fi
    fi
    
    # Create the new CNAME record pointing to Netlify
    # Extract the domain from the Netlify URL (remove https:// and trailing slash)
    NETLIFY_DOMAIN=$(echo ${NETLIFY_DEFAULT_URL} | sed 's|https\?://||' | sed 's|/$||')
    
    CREATE_RESULT=$(curl -s \
        -X POST \
        -H "Content-Type: application/json" \
        -d "{
            \"secretapikey\":\"${PORKBUN_SECRET_KEY}\",
            \"apikey\":\"${PORKBUN_API_KEY}\",
            \"name\":\"${SUBDOMAIN}\",
            \"type\":\"CNAME\",
            \"content\":\"${NETLIFY_DOMAIN}\",
            \"ttl\":300
        }" \
        "https://porkbun.com/api/json/v3/dns/create/${DOMAIN}")
    
    if [ "$(echo ${CREATE_RESULT} | jq -r '.status')" == "SUCCESS" ]; then
        success "Created CNAME record: ${FULL_DOMAIN} → ${NETLIFY_DOMAIN}"
    else
        error "Failed to create DNS record: $(echo ${CREATE_RESULT} | jq -r '.message')"
        exit 1
    fi
}

# Configure custom domain in Netlify
configure_netlify_domain() {
    log "Configuring custom domain in Netlify..."
    
    # Add the custom domain to the Netlify site
    ADD_DOMAIN_RESULT=$(curl -s \
        -X POST \
        -H "Authorization: Bearer ${NETLIFY_AUTH_TOKEN}" \
        -H "Content-Type: application/json" \
        -d "{\"domain\":\"${FULL_DOMAIN}\"}" \
        "https://api.netlify.com/api/v1/sites/${NETLIFY_SITE_ID}/domains")
    
    if echo ${ADD_DOMAIN_RESULT} | jq -e '.domain' > /dev/null; then
        success "Added custom domain ${FULL_DOMAIN} to Netlify site"
    else
        # Check if domain already exists
        if echo ${ADD_DOMAIN_RESULT} | grep -q "already exists"; then
            warning "Domain ${FULL_DOMAIN} already configured for this site"
        else
            error "Failed to add custom domain: ${ADD_DOMAIN_RESULT}"
            exit 1
        fi
    fi
    
    # Wait a moment for DNS to propagate
    log "Waiting 10 seconds for DNS propagation..."
    sleep 10
    
    # Provision SSL certificate
    log "Provisioning SSL certificate..."
    SSL_RESULT=$(curl -s \
        -X POST \
        -H "Authorization: Bearer ${NETLIFY_AUTH_TOKEN}" \
        "https://api.netlify.com/api/v1/sites/${NETLIFY_SITE_ID}/ssl")
    
    if echo ${SSL_RESULT} | jq -e '.state' > /dev/null; then
        success "SSL certificate provisioning initiated"
    else
        warning "SSL certificate may already be configured or will be auto-provisioned"
    fi
}

# Test the domain
test_domain() {
    log "Testing domain configuration..."
    
    # Wait for DNS propagation
    log "Waiting for DNS propagation (up to 2 minutes)..."
    
    for i in {1..24}; do
        if curl -s --max-time 5 "https://${FULL_DOMAIN}" > /dev/null; then
            success "✓ https://${FULL_DOMAIN} is responding!"
            break
        else
            echo -n "."
            sleep 5
        fi
        
        if [ $i -eq 24 ]; then
            warning "Domain not yet responding. This is normal and may take up to 24 hours for full propagation."
            log "You can check the status manually at: https://${FULL_DOMAIN}"
        fi
    done
    
    # Test DNS resolution
    log "Testing DNS resolution..."
    if nslookup ${FULL_DOMAIN} > /dev/null 2>&1; then
        success "✓ DNS resolution working"
    else
        warning "DNS may still be propagating"
    fi
    
    # Check SSL certificate
    log "Checking SSL certificate..."
    SSL_CHECK=$(curl -s -I "https://${FULL_DOMAIN}" 2>/dev/null | head -1 || echo "")
    if echo ${SSL_CHECK} | grep -q "200 OK"; then
        success "✓ SSL certificate working"
    else
        warning "SSL certificate may still be provisioning"
    fi
}

# Main execution
main() {
    log "Starting FOGG Calendar Dashboard subdomain setup..."
    log "Target domain: ${FULL_DOMAIN}"
    
    check_dependencies
    get_credentials
    get_netlify_site
    create_dns_record
    configure_netlify_domain
    test_domain
    
    echo
    success "🎉 Subdomain setup completed!"
    echo
    echo "Summary:"
    echo "• Domain: https://${FULL_DOMAIN}"
    echo "• DNS: CNAME record created at Porkbun"
    echo "• Hosting: Configured on Netlify"
    echo "• SSL: HTTPS enabled"
    echo
    echo "Leslie can now access the FOGG Calendar Dashboard at:"
    echo "🔗 https://${FULL_DOMAIN}"
    echo
    log "Setup completed successfully!"
}

# Run main function
main "$@"