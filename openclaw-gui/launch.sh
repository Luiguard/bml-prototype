#!/bin/bash
# OpenClaw Launcher — Start gateway + open GUI
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

# Ensure gateway is running
systemctl --user start openclaw-gateway.service 2>/dev/null

# Wait for gateway
for i in {1..10}; do
    curl -s http://127.0.0.1:18789/ > /dev/null 2>&1 && break
    sleep 1
done

# Launch GUI
python3 /home/benjamin/projects/openclaw-gui/gui.py &
