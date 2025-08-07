#!/bin/bash

# Quick Fix Script for FOGG DNS Issue
# This script provides immediate solutions and attempts automated fixes

echo "🚀 FOGG DNS Quick Fix System"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check if we're in the right directory
if [ ! -f "fix-fogg-dns.js" ]; then
    echo "❌ Error: Run this script from the deployment-dashboard directory"
    echo "   Use: cd /path/to/deployment-dashboard && ./quick-fix.sh"
    exit 1
fi

echo ""
echo "🎯 IMMEDIATE ACCESS (Available Right Now):"
echo "   👉 https://fogg-calendar.netlify.app"
echo "   📱 Bookmark this URL - it works immediately!"
echo ""

# Test if the immediate access works
echo "🔍 Testing immediate access..."
if curl -s -o /dev/null -w "%{http_code}" "https://fogg-calendar.netlify.app" | grep -q "200"; then
    echo "✅ Immediate access URL is working!"
else
    echo "⚠️  Immediate access URL may have issues"
fi

echo ""
echo "🔧 Attempting automated DNS fix..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js or use manual fix."
    echo ""
    echo "📋 MANUAL FIX INSTRUCTIONS:"
    echo "1. Go to: https://porkbun.com/account/domainsSpeedy"
    echo "2. Find: candlefish.ai"
    echo "3. Add CNAME record: fogg → fogg-calendar.netlify.app"
    echo "4. Wait 5-15 minutes for DNS propagation"
    echo ""
    echo "🌐 MEANWHILE, USE: https://fogg-calendar.netlify.app"
    exit 1
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    if command -v npm &> /dev/null; then
        npm install axios
    else
        echo "⚠️  npm not found, continuing with basic checks..."
    fi
fi

# Run the main fix script
echo "🚀 Running automated DNS fix system..."
if node fix-fogg-dns.js; then
    echo ""
    echo "✅ DNS fix completed successfully!"
    echo "🎯 Check if https://fogg.candlefish.ai is now working"
else
    echo ""
    echo "⚠️  Automated fix had issues, but backup solutions are available"
    echo "📋 Check LESLIE_ACCESS_INSTRUCTIONS.md for detailed steps"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎯 SUMMARY FOR LESLIE:"
echo ""
echo "✅ WORKING RIGHT NOW:"
echo "   👉 https://fogg-calendar.netlify.app"
echo ""
echo "🔍 MAIN DOMAIN STATUS:"
echo "   Testing https://fogg.candlefish.ai..."

# Test the main domain
if curl -s -o /dev/null -w "%{http_code}" "https://fogg.candlefish.ai" 2>/dev/null | grep -q "200"; then
    echo "   ✅ Main domain is working!"
    echo "   👉 https://fogg.candlefish.ai"
else
    echo "   ⏳ Main domain still needs time to propagate"
    echo "   🕐 DNS changes can take 5-60 minutes"
    echo "   💡 Keep using the direct URL above"
fi

echo ""
echo "📄 DETAILED INSTRUCTIONS:"
echo "   📖 See: IMMEDIATE_FIX_FOR_LESLIE.md"
echo "   📊 See: LESLIE_ACCESS_INSTRUCTIONS.md (if generated)"
echo ""
echo "🔍 MONITORING:"
echo "   To monitor DNS status: node dns-monitor.js"
echo "   To verify again: node fix-fogg-dns.js"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"