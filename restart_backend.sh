#!/bin/bash
echo "=== FlipSlab Engine - Restart Backend ==="

# Install new dependency
echo "Installing feedparser..."
/opt/gradeprophet/backend/venv/bin/pip install feedparser

# Kill existing backend processes on port 8001
echo "Stopping backend..."
pkill -f "uvicorn server:app.*8001"
sleep 2

# Start backend
echo "Starting backend..."
cd /opt/gradeprophet/backend
nohup /opt/gradeprophet/backend/venv/bin/uvicorn server:app --host 127.0.0.1 --port 8001 --workers 2 > /tmp/gradeprophet.log 2>&1 &

sleep 3
echo "=== Done! Backend PID: $(pgrep -f 'uvicorn server:app.*8001') ==="
echo "Logs: tail -f /tmp/gradeprophet.log"
