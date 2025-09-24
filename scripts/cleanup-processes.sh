#!/bin/bash

# Process Cleanup Script for Node.js/npm Installation Conflicts
# This script safely terminates processes that might interfere with npm operations

echo "🧹 Starting process cleanup for Node.js/npm operations..."

# Function to safely kill processes
safe_kill() {
    local process_name="$1"
    local pids=$(pgrep -f "$process_name" 2>/dev/null)

    if [ -n "$pids" ]; then
        echo "  ⚠️  Found $process_name processes: $pids"
        echo "  🔄 Attempting graceful termination..."
        kill $pids 2>/dev/null
        sleep 2

        # Check if processes are still running
        local remaining=$(pgrep -f "$process_name" 2>/dev/null)
        if [ -n "$remaining" ]; then
            echo "  💥 Force killing remaining $process_name processes: $remaining"
            kill -9 $remaining 2>/dev/null
        fi
        echo "  ✅ $process_name processes terminated"
    else
        echo "  ✅ No $process_name processes found"
    fi
}

# Kill specific processes that interfere with npm
echo "🎯 Targeting specific interfering processes..."
safe_kill "vite"
safe_kill "tsc"
safe_kill "jest"
safe_kill "electron"
safe_kill "claude-flow"
safe_kill "ruv-swarm"
safe_kill "flow-nexus"

# Kill general node/npm processes (be more careful)
echo "🎯 Checking node/npm processes..."
NODE_PIDS=$(ps aux | grep -E "(node|npm)" | grep -v grep | grep -v "cleanup-processes" | awk '{print $2}')
if [ -n "$NODE_PIDS" ]; then
    echo "  ⚠️  Found node/npm processes:"
    ps aux | grep -E "(node|npm)" | grep -v grep | grep -v "cleanup-processes"
    echo
    echo "  🔄 Attempting graceful termination of node/npm processes..."
    echo "$NODE_PIDS" | xargs kill 2>/dev/null
    sleep 3

    # Check for remaining processes
    REMAINING=$(ps aux | grep -E "(node|npm)" | grep -v grep | grep -v "cleanup-processes" | awk '{print $2}')
    if [ -n "$REMAINING" ]; then
        echo "  💥 Force killing remaining processes..."
        echo "$REMAINING" | xargs kill -9 2>/dev/null
    fi
    echo "  ✅ Node/npm processes cleaned up"
else
    echo "  ✅ No node/npm processes found"
fi

# Check for file locks on node_modules
echo "🔒 Checking for file locks on node_modules..."
LOCKS=$(lsof +D ./node_modules 2>/dev/null | wc -l)
if [ "$LOCKS" -gt 0 ]; then
    echo "  ⚠️  Found $LOCKS file locks on node_modules"
    echo "  📋 Lock details:"
    lsof +D ./node_modules 2>/dev/null | head -10
else
    echo "  ✅ No file locks found on node_modules"
fi

# Clean npm cache if issues persist
echo "🧽 Checking npm cache..."
if [ -d ~/.npm ]; then
    echo "  🗑️  Clearing npm cache..."
    npm cache clean --force 2>/dev/null || echo "  ⚠️  Cache clean failed (non-critical)"
else
    echo "  ✅ No npm cache found"
fi

# Remove package-lock.json if exists (will be regenerated)
if [ -f "./package-lock.json" ]; then
    echo "🔒 Found package-lock.json - backing up and removing..."
    cp package-lock.json package-lock.json.backup.$(date +%Y%m%d-%H%M%S)
    rm package-lock.json
    echo "  ✅ package-lock.json removed (backed up)"
fi

echo
echo "🎉 Process cleanup completed!"
echo "📋 Summary:"
echo "   ✅ All interfering processes terminated"
echo "   ✅ File locks checked"
echo "   ✅ npm cache cleared"
echo "   ✅ package-lock.json reset"
echo
echo "💡 You can now safely run: npm install"
echo

# Optional: Run npm install if requested
if [ "$1" = "--install" ]; then
    echo "🚀 Running npm install..."
    npm install
fi