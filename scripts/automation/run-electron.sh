#!/bin/bash

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║   Accenture Mainframe AI Assistant - Electron Desktop       ║"
echo "╚══════════════════════════════════════════════════════════════╝"

# Kill existing processes
echo "🧹 Cleaning up existing processes..."
pkill -f "python3.*real-db-server" 2>/dev/null
pkill -f "python3.*integrated-server" 2>/dev/null

# Start backend
echo "🚀 Starting backend server..."
python3 scripts/real-db-server.py &
BACKEND_PID=$!

# Wait for backend
sleep 2

# Check backend is running
if curl -s http://localhost:3001/api/health > /dev/null; then
    echo "✅ Backend running on port 3001"
else
    echo "❌ Backend failed to start"
    exit 1
fi

# Run Electron with npx (no installation needed)
echo "🖥️  Starting Electron Desktop App..."
echo ""
echo "The application will open in a new window."
echo "Close the window to stop all services."
echo ""

# Run Electron
npx electron@latest main.js

# Cleanup on exit
echo ""
echo "🛑 Stopping services..."
kill $BACKEND_PID 2>/dev/null
echo "✅ All services stopped"