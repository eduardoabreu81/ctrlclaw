#!/bin/bash
# Bootstrap script for CtrlClaw local setup
# Note: This is a manual helper. A fully guided install flow is planned but not yet available.

set -e

echo "=========================================="
echo "CtrlClaw Local Bootstrap"
echo "=========================================="
echo ""
echo "WARNING: Default credentials (if any) must be changed after first login."
echo "This setup is for local development only."
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "ERROR: Node.js is not installed. Please install Node.js first."
    exit 1
fi

echo "[1/4] Node.js found: $(node --version)"

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "ERROR: package.json not found. Please run this script from the project root."
    exit 1
fi

echo "[2/4] Project root verified"

# Install dependencies
if [ ! -d "node_modules" ]; then
    echo "[3/4] Installing dependencies..."
    npm install
else
    echo "[3/4] Dependencies already installed (skipped)"
fi

# Create .env if not exists
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        echo "[4/4] Creating .env from .env.example..."
        cp .env.example .env
        echo "      Please review and update .env with your configuration."
    else
        echo "[4/4] No .env.example found. You may need to configure environment variables manually."
    fi
else
    echo "[4/4] .env already exists (skipped)"
fi

echo ""
echo "=========================================="
echo "Bootstrap complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "  1. Review your .env configuration"
echo "  2. Start the WebSocket server:"
echo "     node scripts/start-ws-server.js"
echo "  3. In another terminal, start the web app:"
echo "     npm start"
echo ""
echo "IMPORTANT: If your setup uses default credentials, change them immediately after first login."
echo ""
