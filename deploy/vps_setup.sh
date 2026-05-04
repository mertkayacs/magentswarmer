#!/usr/bin/env bash
# VPS setup script for magentswarmer on Ubuntu 22.04 / 24.04.
# Run as root or with sudo. Tested on Hetzner CX22 and similar.

set -euo pipefail

echo "==> Updating system"
apt-get update -qq && apt-get upgrade -y -qq

echo "==> Installing Python 3.11+"
apt-get install -y python3.11 python3.11-venv python3-pip git curl

echo "==> Cloning magentswarmer"
cd /opt
git clone https://github.com/yourusername/magentswarmer.git || true
cd magentswarmer

echo "==> Creating virtualenv"
python3.11 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

echo "==> Setting up environment file"
if [ ! -f .env ]; then
    cp .env.example .env
    echo "IMPORTANT: Edit /opt/magentswarmer/.env and add your API keys before starting."
fi

echo "==> Installing systemd service"
cp deploy/magentswarmer.service /etc/systemd/system/magentswarmer.service
systemctl daemon-reload
echo ""
echo "Done. Next steps:"
echo "  1. Edit /opt/magentswarmer/.env with your API keys"
echo "  2. Set SWARM_GOAL in the .env file"
echo "  3. systemctl enable --now magentswarmer"
echo "  4. journalctl -u magentswarmer -f  (to watch logs)"
