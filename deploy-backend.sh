#!/bin/bash

# Deploy script for backend to server 193.178.170.153
# Run this on the server

set -e

DEPLOY_DIR="/opt/tg-automation"
SESSIONS_DIR="/opt/tg-sessions"

echo "🚀 Deploying TG Automation Backend..."

# Create directories
mkdir -p $DEPLOY_DIR
mkdir -p $SESSIONS_DIR

# Copy backend files
cp -r backend/* $DEPLOY_DIR/

# Copy sessions
cp *.session $SESSIONS_DIR/ 2>/dev/null || echo "No session files to copy"

cd $DEPLOY_DIR

# Install Node.js dependencies
echo "📦 Installing Node.js dependencies..."
npm install

# Install Python dependencies
echo "🐍 Installing Python dependencies..."
pip3 install -r python/requirements.txt

# Create data directory
mkdir -p data

# Build TypeScript
echo "🔨 Building TypeScript..."
npm run build

# Setup PM2
echo "⚙️ Setting up PM2..."
pm2 delete tg-automation 2>/dev/null || true
pm2 start dist/index.js --name tg-automation --env production
pm2 save

echo "✅ Backend deployed successfully!"
echo "📡 API available at: http://193.178.170.153:3001"
echo "🔌 WebSocket at: ws://193.178.170.153:3001/ws"
