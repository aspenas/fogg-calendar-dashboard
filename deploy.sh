#!/bin/bash

# FOGG Calendar Deployment Dashboard - Production Deployment Script
# This script deploys the dashboard to production

set -e

echo "🚀 Starting FOGG Calendar Dashboard Deployment..."

# Configuration
DEPLOY_USER="deploy"
DEPLOY_HOST="deploy.foggcalendar.com"
DEPLOY_PATH="/var/www/fogg-dashboard"
BACKUP_PATH="/var/backups/fogg-dashboard"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Check if running from correct directory
if [ ! -f "package.json" ]; then
    print_error "Please run this script from the deployment-dashboard directory"
    exit 1
fi

# Step 1: Run tests
print_status "Running tests..."
npm test || {
    print_error "Tests failed. Deployment aborted."
    exit 1
}

# Step 2: Build the application
print_status "Building application..."
npm run build || {
    print_error "Build failed. Deployment aborted."
    exit 1
}

# Step 3: Create deployment package
print_status "Creating deployment package..."
tar -czf deploy-package.tar.gz \
    dist/ \
    server.js \
    package*.json \
    ecosystem.config.js \
    .env.example

# Step 4: Transfer to server
print_status "Transferring to production server..."
scp deploy-package.tar.gz ${DEPLOY_USER}@${DEPLOY_HOST}:${DEPLOY_PATH}/

# Step 5: Deploy on server
print_status "Deploying on server..."
ssh ${DEPLOY_USER}@${DEPLOY_HOST} << 'ENDSSH'
    cd /var/www/fogg-dashboard
    
    # Backup current deployment
    echo "Creating backup..."
    timestamp=$(date +%Y%m%d_%H%M%S)
    mkdir -p /var/backups/fogg-dashboard
    if [ -d "dist" ]; then
        tar -czf /var/backups/fogg-dashboard/backup_${timestamp}.tar.gz dist/ server.js
    fi
    
    # Extract new deployment
    echo "Extracting new deployment..."
    tar -xzf deploy-package.tar.gz
    
    # Install dependencies
    echo "Installing dependencies..."
    npm ci --only=production
    
    # Copy environment file if it doesn't exist
    if [ ! -f ".env" ]; then
        cp .env.example .env
        echo "⚠️  Please configure .env file with production settings"
    fi
    
    # Reload application with PM2
    echo "Reloading application..."
    pm2 reload ecosystem.config.js --env production
    
    # Clean up
    rm deploy-package.tar.gz
    
    echo "✅ Deployment complete!"
ENDSSH

# Step 6: Clean up local files
print_status "Cleaning up..."
rm deploy-package.tar.gz

# Step 7: Verify deployment
print_status "Verifying deployment..."
sleep 5
curl -f -s -o /dev/null -w "%{http_code}" https://deploy.foggcalendar.com/api/status || {
    print_error "Deployment verification failed. Please check the server."
    exit 1
}

print_status "🎉 Deployment successful! Dashboard is live at https://deploy.foggcalendar.com"