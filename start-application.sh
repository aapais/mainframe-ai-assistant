#!/bin/bash

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║      Accenture Mainframe AI Assistant - Standalone          ║"
echo "║                   Version 2.0.0                             ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Kill any existing processes on our ports
echo "🧹 Cleaning up existing processes..."
lsof -ti:3001 | xargs -r kill -9 2>/dev/null
lsof -ti:8082 | xargs -r kill -9 2>/dev/null

# Start backend API
echo "🚀 Starting Backend API Server..."
python3 scripts/real-db-server.py &
BACKEND_PID=$!

# Wait for backend to be ready
echo "⏳ Waiting for backend to be ready..."
sleep 2

# Test backend
if curl -s http://localhost:3001/api/health > /dev/null; then
    echo "✅ Backend API is running on port 3001"
else
    echo "❌ Backend failed to start"
    exit 1
fi

# Start frontend server
echo "🌐 Starting Frontend Server..."
python3 scripts/integrated-server.py &
FRONTEND_PID=$!

# Wait for frontend
sleep 2

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                   APPLICATION READY!                         ║"
echo "║                                                              ║"
echo "║   Frontend: http://localhost:8082                           ║"
echo "║   Backend:  http://localhost:3001/api/health                ║"
echo "║                                                              ║"
echo "║   Press Ctrl+C to stop all services                         ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Stopping services..."
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    echo "✅ All services stopped"
    exit 0
}

# Set trap for cleanup
trap cleanup INT TERM

# Keep script running
while true; do
    sleep 1
done