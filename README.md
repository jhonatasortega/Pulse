<div align="center">

<img src="frontend/public/logo.svg" alt="Pulse Logo" width="80" height="80" />

# Pulse

**Self-hosted Docker container manager — built for Raspberry Pi and ARM servers**

[![Python](https://img.shields.io/badge/Python-3.12-3776AB?style=flat-square&logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![Docker](https://img.shields.io/badge/Docker-ready-2496ED?style=flat-square&logo=docker&logoColor=white)](https://docker.com)
[![License](https://img.shields.io/badge/License-CC%20BY--NC%204.0-lightgrey?style=flat-square)](https://creativecommons.org/licenses/by-nc/4.0/)

A beautiful, lightweight alternative to Portainer and CasaOS — with a macOS-inspired windowed interface, wallpaper support, integrated terminal, multi-store App Store and multi-user access control.

![Dashboard](docs/screenshots/dashboard.png)

</div>

---

## Screenshots

<table>
<tr>
<td width="50%">

**Containers**

![Containers](docs/screenshots/containers.png)

</td>
<td width="50%">

**App Store**

![App Store](docs/screenshots/appstore.png)

</td>
</tr>
<tr>
<td width="50%">

**Storage**

![Storage](docs/screenshots/storage.png)

</td>
<td width="50%">

**File Browser**

![Files](docs/screenshots/files.png)

</td>
</tr>
<tr>
<td width="50%">

**Terminal**

![Terminal](docs/screenshots/terminal.png)

</td>
<td width="50%">

**Aparência**

![Appearance](docs/screenshots/appearance.png)

</td>
</tr>
</table>

---

## Features

### Interface
- **Windowed UI** — pages open as draggable, resizable floating windows (macOS-style)
- **Bottom dock** — glassmorphism icon dock, centered, hover tooltips
- **Custom wallpapers** — photo presets, gradient themes, custom URL or upload from PC; persisted server-side per user
- **Display name** — personalized greeting (`Bom dia, João!`); saved to server, works in incognito
- **Server-side preferences** — wallpaper and display name stored per user, loaded on login across any device or browser session

### Containers
- **Dashboard** — live tiles with official icons, status indicators, one-click start/stop/restart
- **Fixed storage tile** — always-visible quick access to disk overview from the dashboard
- **Container side drawer** — click any container to open a panel with:
  - **Logs** — last 200 lines + live stream toggle
  - **Config** — edit env vars, restart policy, volumes and ports
  - **Terminal** — `docker exec` shell directly inside the container
  - **Local Domain** — generate `.local` domain entry and apply it directly to the Pi's `/etc/hosts`
- **DNS wizard** — step-by-step guide to install and configure `dnsmasq` on the Pi so `.local` names resolve on all network devices automatically
- **Grouped view** — Docker Compose stacks shown as expandable groups
- **Navigate from dashboard** — click the arrow on a tile to go straight to that group

### App Store
- **519+ apps** across 6 stores (expandable)
- **Multi-store** — enable/disable stores, add custom zip store URLs
- **Edit before install** — full docker-compose editor before deploying
- **Official icons** — app icons preserved from store metadata
- **Clean container names** — `pulse_tailscale` not `pulse_cp0204-play-arm-tailscale`

| Store | Type |
|-------|------|
| TMC Store | Local templates (Nginx, Traefik, Portainer…) |
| Play Store (x86) | Community zip store |
| Play Store (ARM) | Community zip store |
| Home Automation | Home Assistant ecosystem |
| Big Bear Store | Curated self-hosted apps |
| Pentest Tools | Security & network tools |

### Storage & Files
- **Disk overview modal** — click the storage tile on the dashboard to see disk usage at a glance
- **Full file browser** — browse, upload, download, rename, delete, copy, move files
- **Cross-disk copy/move** — clipboard persists when switching between disks
- **Host filesystem access** — browse the Pi's root filesystem (`/host`) and external drives (`/mnt/*`)
- **Docker volumes** — browse volume data directly
- **Inline errors** — no browser `alert()` popups; errors shown inline

### System
- **Real-time metrics** — CPU, RAM, temperature, disk (WebSocket live)
- **System info** — Docker version, host arch, image list, network list
- **Terminal** — integrated PTY bash shell inside the Pulse container
- **Docker exec** — shell terminal inside any running container

### Security & Users
- **Multi-user RBAC** — admin and viewer roles
- **Admin** — full access: create, modify, delete containers, apps, users
- **Viewer** — read-only: see containers, logs, metrics, files
- **Change password** — any user can change their own password
- **Logout** — session management from the Users page

| Auth mode | How to enable |
|-----------|--------------|
| Multi-user | First access creates admin account |
| API Key | Set `PULSE_API_KEY` env var |
| No auth | Leave `PULSE_API_KEY` empty (dev only) |

---

## Quick Start

```bash
git clone https://github.com/jhonatasortega/Pulse.git
cd Pulse
docker compose up -d --build
```

Open `http://<your-server-ip>:3000` — on first access you'll create your admin account.

---

## Deploy to Raspberry Pi

```bash
# Usage: ./deploy.sh user@host [remote_dir]
./deploy.sh pi@192.168.0.100
./deploy.sh pi@192.168.0.100 /home/pi/pulse
```

---

## Configuration

### docker-compose.yml

```yaml
services:
  pulse-backend:
    build: .
    image: pulse-backend:1.0.0
    container_name: pulse_backend
    pid: host                    # required for DNS wizard (nsenter)
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data
      - /var/run/docker.sock:/var/run/docker.sock
      - /:/host:rshared          # Pi root filesystem (file browser + DNS)
      - /mnt:/mnt:rshared
      - /media:/media:rshared
      - /home:/home:rshared
      - /var/lib/docker/volumes:/var/lib/docker/volumes:rshared
    environment:
      - PULSE_API_KEY=${PULSE_API_KEY:-}
    restart: unless-stopped
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PULSE_API_KEY` | *(empty)* | Single-user API key. Leave empty to use multi-user login |
| `PULSE_DATA_DIR` | `/app/data` | Data directory for users, app state, configs |

---

## Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.12, FastAPI, Uvicorn |
| Frontend | React 18, Vite, Tailwind CSS |
| Terminal | xterm.js + PTY (`subprocess` + `pty.openpty`) |
| Docker API | docker-py (singleton client) |
| Auth | SHA-256 + salt, session/localStorage |
| Serving | FastAPI StaticFiles (SPA fallback) |

---

## Project Structure

```
Pulse/
├── core/                     # FastAPI backend
│   ├── main.py               # Entry point, auth endpoints, lifespan
│   ├── api/
│   │   ├── auth.py           # Auth dependency (HTTP + WebSocket)
│   │   └── routes/           # containers, groups, apps, terminal, users, stores, dns, files…
│   └── services/             # docker_service, app_service, store_service, user_service, file_service…
├── frontend/
│   └── src/
│       ├── App.jsx            # Windowed UI + bottom dock
│       ├── pages/             # Dashboard, Containers, AppStore, Storage, Terminal, Users…
│       └── components/        # AuthGate (login / first-access setup)
├── apps/templates/            # Built-in app templates (YAML)
├── docs/screenshots/          # UI screenshots
├── docker/entrypoint.sh       # Colored ASCII startup banner
├── Dockerfile
└── docker-compose.yml
```

---

## Architecture Notes

- **WebSocket auth** — browsers can't send custom headers on WS upgrades; credentials are appended as query params and read via `starlette.requests.HTTPConnection`
- **Docker client** — singleton with auto-reconnect for fast repeated API calls
- **Store pre-warm** — store cache is populated in background at startup so App Store loads instantly
- **Container naming** — apps installed from stores use `pulse_{name_slug}` (e.g. `pulse_tailscale`)
- **Server-side preferences** — wallpaper and display name stored per user in `users.json`, loaded after login so they work in incognito and across devices
- **Host filesystem** — Pi's `/` is mounted at `/host` inside the container, enabling full file browsing and DNS management without SSH
- **DNS propagation** — dnsmasq reads `/etc/hosts` and serves entries to the whole LAN; managed entirely from the Pulse UI via `nsenter`
- **File download auth** — download URLs include credentials as query params (same pattern as WebSocket) since browsers don't send custom headers on `<a href>` navigations

---

<div align="center">
Made with ⚡ for self-hosters who want something beautiful
</div>
