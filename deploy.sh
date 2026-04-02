#!/bin/bash
# Deploy Pulse to Raspberry Pi
# Usage: ./deploy.sh [user@host]

TARGET=${1:-"jortega@192.168.0.233"}
REMOTE_DIR="/home/jortega/pulse"

echo "==> Deploying Pulse to $TARGET:$REMOTE_DIR"

# Create remote directory
ssh "$TARGET" "mkdir -p $REMOTE_DIR"

# Sync project (exclude node_modules, cache, data)
rsync -avz --progress \
  --exclude 'node_modules' \
  --exclude '.vite' \
  --exclude '__pycache__' \
  --exclude '*.pyc' \
  --exclude 'data/' \
  --exclude '.git' \
  . "$TARGET:$REMOTE_DIR/"

echo "==> Starting containers on Pi..."
ssh "$TARGET" "cd $REMOTE_DIR && docker compose pull --quiet 2>/dev/null; docker compose up -d --build"

echo ""
echo "✓ Pulse deployed!"
echo "  Backend:  http://192.168.0.233:3000"
echo "  Frontend: http://192.168.0.233:3001"
echo "  API Docs: http://192.168.0.233:3000/docs"
