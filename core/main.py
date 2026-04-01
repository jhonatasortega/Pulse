import os
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.responses import FileResponse
from starlette.types import Scope


class SPAStaticFiles(StaticFiles):
    """Serve index.html for any path that isn't a real static file (SPA fallback)."""
    async def get_response(self, path: str, scope: Scope):
        try:
            return await super().get_response(path, scope)
        except Exception:
            return FileResponse(Path(self.directory) / "index.html")

from api.routes import containers, apps, metrics, logs, agents, system, groups, storage, files
from api.auth import verify_key, auth_enabled
from agents_loader.loader import AgentLoader

agent_loader = AgentLoader(agents_dir="/app/agents")


@asynccontextmanager
async def lifespan(app: FastAPI):
    agent_loader.load_all()
    print(f"[Pulse] Loaded {len(agent_loader.agents)} agents")
    yield


app = FastAPI(
    title="Pulse",
    description="Self-hosted container management platform",
    version="1.0.0",
    lifespan=lifespan,
    dependencies=[Depends(verify_key)],
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API routes — must be registered BEFORE the static files mount
app.include_router(containers.router, prefix="/api/containers", tags=["containers"])
app.include_router(apps.router, prefix="/api/apps", tags=["apps"])
app.include_router(metrics.router, prefix="/api/metrics", tags=["metrics"])
app.include_router(logs.router, prefix="/api/logs", tags=["logs"])
app.include_router(agents.router, prefix="/api/agents", tags=["agents"])
app.include_router(system.router, prefix="/api/system", tags=["system"])
app.include_router(groups.router, prefix="/api/groups", tags=["groups"])
app.include_router(storage.router, prefix="/api/storage", tags=["storage"])
app.include_router(files.router, prefix="/api/files", tags=["files"])


@app.get("/api/health", dependencies=[])
async def health():
    return {"status": "ok", "version": "1.0.0"}


@app.get("/api/auth/status", dependencies=[])
async def auth_status():
    return {"auth_enabled": auth_enabled()}


@app.get("/api/auth/verify")
async def auth_verify():
    return {"valid": True}


# Static files mount LAST — catch-all, must come after all API routes
frontend_path = "/app/frontend/dist"
if os.path.exists(frontend_path):
    app.mount("/", SPAStaticFiles(directory=frontend_path, html=True), name="frontend")
