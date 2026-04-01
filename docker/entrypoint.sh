#!/bin/bash
set -e

# ─── ANSI colors ──────────────────────────────────────────────────────────────
RESET='\033[0m'
BOLD='\033[1m'
DIM='\033[2m'
CYAN='\033[36m'
INDIGO='\033[94m'
GREEN='\033[92m'
YELLOW='\033[93m'
RED='\033[91m'
WHITE='\033[97m'
GRAY='\033[90m'

# ─── Banner ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${INDIGO}${BOLD}"
echo "   ██████╗ ██╗   ██╗██╗     ███████╗███████╗"
echo "   ██╔══██╗██║   ██║██║     ██╔════╝██╔════╝"
echo "   ██████╔╝██║   ██║██║     ███████╗█████╗  "
echo "   ██╔═══╝ ██║   ██║██║     ╚════██║██╔══╝  "
echo "   ██║     ╚██████╔╝███████╗███████║███████╗"
echo "   ╚═╝      ╚═════╝ ╚══════╝╚══════╝╚══════╝"
echo -e "${RESET}"
echo -e "   ${GRAY}Self-hosted container management platform${RESET}"
echo -e "   ${DIM}Version 1.0.0  ·  FastAPI + React${RESET}"
echo ""
echo -e "   ${GRAY}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo ""

# ─── Config summary ───────────────────────────────────────────────────────────
echo -e "   ${CYAN}⚙  Configuration${RESET}"

DATA_DIR="${PULSE_DATA_DIR:-/app/data}"
echo -e "   ${GRAY}├─${RESET} Data directory  ${WHITE}${DATA_DIR}${RESET}"

if [ -n "${PULSE_API_KEY}" ]; then
  echo -e "   ${GRAY}├─${RESET} Auth             ${GREEN}enabled (env var)${RESET}"
elif [ -f "${DATA_DIR}/auth.json" ]; then
  echo -e "   ${GRAY}├─${RESET} Auth             ${GREEN}enabled (saved key)${RESET}"
else
  echo -e "   ${GRAY}├─${RESET} Auth             ${YELLOW}disabled — open access${RESET}"
fi

echo -e "   ${GRAY}└─${RESET} Port             ${WHITE}3000${RESET}"
echo ""

# ─── Data directory ───────────────────────────────────────────────────────────
echo -e "   ${CYAN}📁 Preparing data directory...${RESET}"
mkdir -p "${DATA_DIR}/apps" "${DATA_DIR}/configs"
echo -e "   ${GRAY}└─${RESET} ${GREEN}✓ Ready${RESET}"
echo ""

# ─── Docker socket check ──────────────────────────────────────────────────────
echo -e "   ${CYAN}🐳 Checking Docker socket...${RESET}"
if [ -S /var/run/docker.sock ]; then
  echo -e "   ${GRAY}└─${RESET} ${GREEN}✓ /var/run/docker.sock found${RESET}"
else
  echo -e "   ${GRAY}└─${RESET} ${RED}✗ Docker socket not found — container operations will fail${RESET}"
fi
echo ""

# ─── Ready ────────────────────────────────────────────────────────────────────
echo -e "   ${GREEN}${BOLD}✓ Pulse is starting on http://0.0.0.0:3000${RESET}"
echo ""
echo -e "   ${GRAY}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo ""

# ─── Launch ───────────────────────────────────────────────────────────────────
exec uvicorn main:app --host 0.0.0.0 --port 3000 --log-level info
