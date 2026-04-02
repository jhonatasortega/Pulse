#!/bin/bash
# Deploy Pulse to a remote server
# Usage: ./deploy.sh user@host [remote_dir]

if [ -z "$1" ]; then
  echo "Usage: ./deploy.sh user@host [remote_dir]"
  echo "Example: ./deploy.sh pi@192.168.0.100 /home/pi/pulse"
  exit 1
fi

TARGET="$1"
REMOTE_DIR="${2:-"/opt/pulse"}"

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

echo "==> Starting containers..."
ssh "$TARGET" "cd $REMOTE_DIR && docker compose pull --quiet 2>/dev/null; docker compose up -d --build"

echo ""
echo "Pulse deployed to $TARGET"
echo "  Access: http://$(echo $TARGET | cut -d@ -f2):3000"
