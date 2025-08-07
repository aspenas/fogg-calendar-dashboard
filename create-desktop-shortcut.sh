#!/bin/bash

# Creates a desktop shortcut for Leslie to easily start the dashboard

echo "🎆 Creating desktop shortcut for FOGG Calendar Dashboard..."

# Get the desktop path
DESKTOP="$HOME/Desktop"
DASHBOARD_DIR="$(pwd)"

# Create an AppleScript application (for Mac)
if [[ "$OSTYPE" == "darwin"* ]]; then
    # Create AppleScript content
    cat > /tmp/fogg-dashboard.applescript << 'EOF'
tell application "Terminal"
    activate
    do script "cd '$DASHBOARD_DIR' && ./start-dashboard.sh"
end tell
EOF

    # Compile to .app
    osacompile -o "$DESKTOP/FOGG Calendar Dashboard.app" /tmp/fogg-dashboard.applescript
    
    # Clean up
    rm /tmp/fogg-dashboard.applescript
    
    echo "✅ Desktop shortcut created!"
    echo "📁 Look for 'FOGG Calendar Dashboard' on your desktop"
    echo "🕹️ Double-click it anytime to start the dashboard!"
    
# Create .desktop file for Linux
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    cat > "$DESKTOP/fogg-dashboard.desktop" << EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=FOGG Calendar Dashboard
Comment=Deploy FOGG Calendar with one click
Exec=gnome-terminal -- bash -c "cd $DASHBOARD_DIR && ./start-dashboard.sh; read"
Icon=$DASHBOARD_DIR/icon.png
Terminal=false
Categories=Application;
EOF

    chmod +x "$DESKTOP/fogg-dashboard.desktop"
    
    echo "✅ Desktop shortcut created!"
    echo "📁 Look for 'FOGG Calendar Dashboard' on your desktop"
    echo "🕹️ Double-click it anytime to start the dashboard!"
fi

echo ""
echo "🎉 All done! Leslie can now:"
echo "   1. Double-click the desktop shortcut"
echo "   2. Wait for browser to open"
echo "   3. Click the big 'Deploy Now' button"
echo ""
echo "No technical knowledge needed! 🚀"