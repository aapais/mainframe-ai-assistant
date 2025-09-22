#!/bin/bash

# Kill any existing processes on port 3000
fuser -k 3000/tcp 2>/dev/null || true

# Ensure backend is running
echo "Starting backend server..."
python3 scripts/real-db-server.py &
BACKEND_PID=$!

# Start Next.js with npx (will download if needed)
echo "Starting Next.js frontend..."
cd src/renderer
npx --yes next@14 dev --port 3000 &
FRONTEND_PID=$!

echo "Application starting..."
echo "Frontend: http://localhost:3000"
echo "Backend: http://localhost:8089"

# Keep script running
wait $FRONTEND_PID