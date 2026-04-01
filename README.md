# ⚡ Pulse

Self-hosted container management platform for Raspberry Pi and ARM64 servers. Inspired by Umbrel/CasaOS — manage all your Docker containers from a clean web interface.

![Dashboard](https://img.shields.io/badge/status-active-brightgreen) ![Platform](https://img.shields.io/badge/platform-ARM64%20%7C%20x86-blue) ![Python](https://img.shields.io/badge/python-3.12-blue) ![React](https://img.shields.io/badge/react-18-61dafb)

## Features

- **Dashboard** — live app grid grouped by Docker Compose project, system resource widgets (CPU, RAM, disk, temp), wallpaper & glassmorphism themes
- **Containers** — grouped accordion view with per-app and per-container start/stop/restart/logs/config actions
- **App Store** — browse 24+ apps from TMC Store (CasaOS-compatible), install via template or manually (CasaOS-style form: image, ports, volumes, env vars)
- **Storage** — disk usage cards + Docker volumes table; click any disk/volume to open the built-in file manager
- **File Manager** — list & grid view modes, right-click context menu (copy/cut/paste/rename/delete), built-in text editor, file upload/download
- **Metrics** — real-time CPU, RAM, disk, temperature via WebSocket
- **System** — Docker info, images, networks
- **Container Config Editor** — edit env vars and restart policy directly from the UI (recreates container)
- **Auth** — optional API key (`PULSE_API_KEY` env var); disabled by default for local use

## Stack

| Layer | Tech |
|---|---|
| Backend | FastAPI + Docker SDK for Python |
| Frontend | React 18 + Vite + Tailwind CSS |
| Container access | `/var/run/docker.sock` (no DinD) |
| Metrics | psutil 6.1.1 (ARM64 pre-built wheel) |
| App Store | CasaOS-TMCstore via GitHub API |

## Deploy (Raspberry Pi / ARM64)

```bash
# Clone
git clone https://github.com/jhonatasortega/Pulse.git
cd Pulse

# Build frontend locally
cd frontend && npm install && npm run build && cd ..

# Configure (optional — leave empty to disable auth)
echo "PULSE_API_KEY=your-secret-key" > .env

# Build and start
docker compose up -d --build
```

Access at **http://\<pi-ip\>:3000**

## Development

```bash
# Backend
cd core
pip install -r requirements.txt
uvicorn main:app --reload --port 3000

# Frontend (separate terminal)
cd frontend
npm install
npm run dev   # Vite dev server with proxy → :3000
```

## Project Structure

```
Pulse/
├── core/                      # FastAPI backend
│   ├── main.py                # App entrypoint, SPA routing
│   ├── api/
│   │   ├── auth.py            # Optional API key auth
│   │   └── routes/
│   │       ├── containers.py  # Container CRUD + config edit
│   │       ├── groups.py      # Compose project grouping
│   │       ├── apps.py        # App Store + custom install
│   │       ├── storage.py     # Disks + Docker volumes
│   │       ├── files.py       # File manager (browse/edit/upload)
│   │       ├── metrics.py     # System metrics + WebSocket
│   │       ├── logs.py        # Container logs + WebSocket
│   │       └── system.py      # Docker info / images / networks
│   └── services/
│       ├── docker_service.py  # Docker SDK wrapper
│       ├── group_service.py   # Container grouping by compose project
│       ├── app_service.py     # Template install / uninstall
│       ├── store_service.py   # TMC Store GitHub fetcher (1h cache)
│       ├── storage_service.py # psutil disk info + Docker volumes
│       ├── file_service.py    # Secure file operations
│       └── metrics_service.py # CPU / RAM / disk / temperatures
├── frontend/                  # React + Vite + Tailwind
│   └── src/
│       ├── pages/             # Dashboard, Containers, AppStore, Storage, Metrics, System
│       ├── api.js             # Typed API client
│       └── cache.js           # In-memory TTL cache
├── apps/templates/            # Local YAML app templates
├── agents/                    # Agent .md files (loaded at startup)
├── Dockerfile                 # Python 3.12-slim, copies pre-built frontend dist
└── docker-compose.yml         # Single service, mounts /mnt /media /home
```

## App Store — Add a local template

Create `apps/templates/myapp.yml`:

```yaml
id: myapp
name: My App
description: Short description
version: "1.0"
category: tools
icon: 🛠️

docker:
  image: myimage:latest
  ports:
    - "8080:80"
  volumes:
    - ./data/myapp:/data
  env:
    - MY_VAR=default_value
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PULSE_API_KEY` | _(empty)_ | API key for auth. Empty = auth disabled |
| `PULSE_DATA_DIR` | `/app/data` | Data directory inside container |

## Container Grouping

Containers are grouped by the `com.docker.compose.project` label (set automatically by Docker Compose). Standalone containers appear as individual tiles. The aggregate status is:

- 🟢 **running** — all containers up
- 🟡 **partial** — some containers up
- ⚫ **stopped** — all containers down

## License

MIT
