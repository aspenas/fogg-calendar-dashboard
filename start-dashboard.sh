#!/bin/bash

# FOGG Calendar Dashboard - Simple Startup Script
# Double-click this file to start the deployment dashboard

echo "✨ Starting FOGG Calendar Deployment Dashboard..."
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    echo "Visit: https://nodejs.org"
    read -p "Press Enter to exit..."
    exit 1
fi

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies (this only happens once)..."
    npm install
    echo ""
fi

# Start the dashboard
echo "🚀 Starting the dashboard..."
echo ""
echo "════════════════════════════════════════════════════════"
echo "  📱 Dashboard is starting at: http://localhost:3000"
echo "  "
echo "  Once it opens:"
echo "  1. Look for the big purple 'Deploy Now' button"
echo "  2. Click it to deploy your calendar"
echo "  3. Watch the progress on screen"
echo "  "
echo "  To stop: Press Ctrl+C in this window"
echo "════════════════════════════════════════════════════════"
echo ""

# Start both frontend and backend
npm run server &
SERVER_PID=$!

npm run dev &
CLIENT_PID=$!

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "Stopping dashboard..."
    kill $SERVER_PID 2>/dev/null
    kill $CLIENT_PID 2>/dev/null
    exit 0
}

trap cleanup EXIT INT TERM

# Wait for processes
wait $SERVER_PID $CLIENT_PID