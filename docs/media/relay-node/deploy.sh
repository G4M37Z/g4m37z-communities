#!/bin/bash
# G4M37Z Relay Node — one-shot provisioner for a fresh Ubuntu 22.04/24.04 VM
# (tested path: Oracle Cloud Always-Free Ampere A1, arm64).
# Run as root ON the VM:  bash deploy.sh
set -euo pipefail

echo "[1/5] system + docker"
apt-get update -qq
apt-get install -y -qq curl ca-certificates jq ufw >/dev/null
command -v docker >/dev/null || curl -fsSL https://get.docker.com | sh
docker compose version >/dev/null 2>&1 || apt-get install -y -qq docker-compose-plugin >/dev/null

echo "[2/5] secrets"
if [ ! -f .env ]; then
  echo "TURN_SECRET=$(openssl rand -hex 32)" > .env
  echo "  generated .env -> TURN_SECRET (copy this exact value into the G4M37Z"
  echo "  Vercel env as TURN_SECRET later — both sides must match!)"
else
  echo "  .env exists, keeping it"
fi

echo "[3/5] firewall (ufw)"
ufw --force reset >/dev/null
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 3478/tcp
ufw allow 3478/udp
ufw allow 5349/tcp
ufw allow 49152:65535/udp
ufw --force enable

echo "[4/5] external-ip rewrite (Oracle VMs sit behind 1:1 NAT)"
PUB_IP=$(curl -fsSL https://checkip.amazonaws.com)
PRIV_IP=$(hostname -I | awk '{print $1}')
if grep -q '__PUBLIC_IP__' turnserver.conf; then
  sed -i "s/__PUBLIC_IP__/$PUB_IP/; s/__PRIVATE_IP__/$PRIV_IP/" turnserver.conf
fi
echo "  external-ip=$PUB_IP/$PRIV_IP"

echo "[5/5] inject secret + start relay"
# shellcheck disable=SC1091
. ./.env
if grep -q '${TURN_SECRET}' turnserver.conf; then
  sed -i "s/\${TURN_SECRET}/$TURN_SECRET/" turnserver.conf
fi
docker compose up -d
sleep 3
docker compose ps
echo
echo "Verify from ANY machine (not this one):"
echo "  turnutils_uclient -T -u <expiry>:test -w test -p 3478 $PUB_IP"
echo " or check listening ports:  ss -lun | grep 3478"
echo
echo "== relay node is live — next: Vercel env TURN_SECRET + endpoint =="
echo "== deploy.sh done =============================================="
