# ⚡ Pulse

Self-hosted container management platform for Raspberry Pi and ARM64 servers. Manage all your Docker containers from a clean, modern web interface — inspired by Umbrel/CasaOS.

![Status](https://img.shields.io/badge/status-active-brightgreen) ![Platform](https://img.shields.io/badge/platform-ARM64%20%7C%20x86-blue) ![Python](https://img.shields.io/badge/python-3.12-blue) ![React](https://img.shields.io/badge/react-18-61dafb)

---

## Features

### Dashboard
- Live app grid grouped by Docker Compose project
- System resource widgets — CPU, RAM, disk, temperature (real-time WebSocket)
- Wallpaper support: 4 photo presets, custom URL, or upload from your computer
- Glassmorphism theme when wallpaper is active
- Personalized greeting using your display name

### Navigation — Floating Dock
- Icon-only bottom dock (fixed, centered, glassmorphism)
- Each icon opens the corresponding page as a **floating window** — draggable, maximizable, macOS-style traffic light buttons
- Dashboard always fills the background viewport

### Containers
- Grouped accordion view by Docker Compose project
- Per-app actions: start / stop / restart / logs / config editor
- Config editor: edit env vars and restart policy (recreates container in-place)
- Real-time logs with WebSocket tail

### App Store
- **6 built-in stores**: TMC Store, Play Store (x86 + ARM), Home Automation, Big Bear, Pentest Tools
- All stores load concurrently — no waiting
- Store cache pre-warmed on startup so the first open is instant
- Store manager: enable/disable, refresh, remove, add any zip-based store URL
- Per-store filter tabs (auto-generated, scrollable)
- **Install with compose editor**: preview and edit the generated `docker-compose.yml` before installing
- Manual install (CasaOS-style): image, ports, volumes, env vars, network, restart policy
- Paste a `docker-compose.yml` directly — fields auto-filled from it

### Storage
- Disk usage cards + Docker volumes table
- Click any disk to open the built-in file manager inline

### File Manager
- List / grid view modes
- Breadcrumb navigation
- Right-click context menu: copy, cut, paste, rename, delete, new folder, new file
- Built-in text editor for config files
- File upload and download

### Terminal
- Full bash terminal inside the container, directly in the browser
- xterm.js frontend with 256-color theme and resize support
- WebSocket PTY backend (Linux only)

### Metrics
- Real-time CPU, RAM, disk, temperature via WebSocket
- Historical graphs per container

### System
- Docker info, images, networks

### Users & RBAC
- Multi-user support with username + password
- Roles: **admin** (full access) / **viewer** (read-only — GET only, mutations blocked)
- First-access setup: create admin account with display name on first visit
- User management page: create, delete, toggle role
- All authentication works over WebSocket connections too (query-param fallback)

### Auth Modes
| Mode | How it works |
|---|---|
| Open | No `PULSE_API_KEY` set, no users configured — full access |
| API Key | Set `PULSE_API_KEY` env var or configure via first-access setup screen |
| Multi-user | Create users via the setup screen or Users page; each user has a role |

### Docker Startup
- Pretty colored banner on `docker compose up`
- Shows auth status, data directory, Docker socket check

---

## Stack

| Layer | Tech |
|---|---|
| Backend | FastAPI + Docker SDK for Python |
| Frontend | React 18 + Vite + Tailwind CSS |
| Terminal | xterm.js + Python `pty` (PTY over WebSocket) |
| Container access | `/var/run/docker.sock` (no DinD) |
| Metrics | psutil 6.1.1 (ARM64 pre-built wheel) |
| App Store | Multi-store zip fetcher + CasaOS-TMCstore via GitHub API |
| Auth | SHA-256 + salt, stored in `/app/data/users.json` |

---

## Deploy (Raspberry Pi / ARM64)

```bash
# Clone
git clone https://github.com/jhonatasortega/Pulse.git
cd Pulse

# Build frontend
cd frontend && npm install && npm run build && cd ..

# Optional: set API key (or configure via UI on first access)
echo "PULSE_API_KEY=your-secret-key" > .env

# Build and start
docker compose up -d --build
```

Access at **http://\<pi-ip\>:3000**

On first access with no key configured, you'll be prompted to create an admin account.

---

## Development

```bash
# Backend
cd core
pip install -r requirements.txt
uvicorn main:app --reload --port 3000

# Frontend (separate terminal)
cd frontend
npm install
npm run dev   # Vite dev server → proxies API to :3000
```

---

## Project Structure

```
Pulse/
├── core/                          # FastAPI backend
│   ├── main.py                    # App entrypoint, SPA routing, auth endpoints
│   ├── api/
│   │   ├── auth.py                # Multi-mode auth (open / API key / multi-user)
│   │   └── routes/
│   │       ├── containers.py      # Container CRUD + config editor
│   │       ├── groups.py          # Compose project grouping
│   │       ├── apps.py            # App Store + custom/manual install
│   │       ├── stores.py          # Store registry CRUD
│   │       ├── storage.py         # Disks + Docker volumes
│   │       ├── files.py           # File manager (browse/edit/upload/download)
│   │       ├── metrics.py         # System metrics + WebSocket
│   │       ├── logs.py            # Container logs + WebSocket
│   │       ├── system.py          # Docker info / images / networks
│   │       ├── terminal.py        # PTY terminal over WebSocket
│   │       └── users.py           # User management (RBAC)
│   └── services/
│       ├── docker_service.py      # Docker SDK wrapper
│       ├── group_service.py       # Container grouping by compose project
│       ├── app_service.py         # Template install / uninstall
│       ├── store_service.py       # Unified multi-store fetcher
│       ├── store_registry.py      # Store list persistence (/app/data/stores.json)
│       ├── zip_store_service.py   # Zip-based store downloader + parser
│       ├── storage_service.py     # psutil disk info + Docker volumes
│       ├── file_service.py        # Secure file operations
│       ├── metrics_service.py     # CPU / RAM / disk / temperatures
│       └── user_service.py        # Multi-user auth + RBAC
├── frontend/                      # React + Vite + Tailwind
│   └── src/
│       ├── App.jsx                # Dock + floating window system
│       ├── auth.js                # Auth helpers (API key + multi-user)
│       ├── api.js                 # Typed API client + WebSocket helpers
│       ├── cache.js               # In-memory TTL cache
│       ├── components/
│       │   └── AuthGate.jsx       # Login / first-access setup screen
│       └── pages/
│           ├── Dashboard.jsx      # App grid, metrics widgets, wallpaper
│           ├── Containers.jsx     # Container list + logs + config editor
│           ├── AppStore.jsx       # Multi-store browser + install modals
│           ├── Storage.jsx        # Disks, volumes, inline file manager
│           ├── Metrics.jsx        # Real-time graphs
│           ├── System.jsx         # Docker info / images / networks
│           ├── Terminal.jsx       # xterm.js PTY terminal
│           └── Users.jsx          # User management page
├── apps/templates/                # Local YAML app templates
│   ├── nginx-proxy-manager.yml    # Reverse proxy + Let's Encrypt
│   ├── traefik.yml                # Traefik v3 load balancer
│   ├── portainer.yml
│   ├── filebrowser.yml
│   └── uptime-kuma.yml
├── docker/
│   └── entrypoint.sh              # Colored startup banner + health checks
├── Dockerfile                     # Python 3.12-slim, pre-built frontend
└── docker-compose.yml             # Single service, mounts /mnt /media /home
```

---

## App Stores

Pulse fetches apps from multiple stores simultaneously. All stores are enabled by default and can be managed from the UI (App Store → Lojas).

| Store | Type | Notes |
|---|---|---|
| TMC Store | GitHub API | 24+ apps, icons from jsDelivr CDN |
| Play Store (x86) | ZIP | General-purpose apps |
| Play Store (ARM) | ZIP | ARM-optimized images |
| Home Automation | ZIP | Home Assistant, Zigbee, etc. |
| Big Bear Store | ZIP | Large curated collection |
| Pentest Tools | ZIP | Security/pentest containers |

You can also add any custom zip store URL from the store manager.

---

## Add a Local Template

Create `apps/templates/myapp.yml`:

```yaml
id: myapp
name: My App
description: Short description
version: "1.0"
category: tools
icon: 🛠️
webui_port: 8080
webui_path: /

docker:
  image: myimage:latest
  ports:
    - "8080:80"
  volumes:
    - ./data/myapp:/data
  env:
    - MY_VAR=default_value
```

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PULSE_API_KEY` | _(empty)_ | API key for single-user auth. Empty = use UI setup or open access |
| `PULSE_DATA_DIR` | `/app/data` | Data directory inside container |

---

## Container Grouping

Containers are grouped by the `com.docker.compose.project` label (set automatically by Docker Compose). Standalone containers appear as individual tiles.

| Status | Meaning |
|---|---|
| 🟢 running | All containers up |
| 🟡 partial | Some containers up |
| ⚫ stopped | All containers down |

---

## License

MIT
