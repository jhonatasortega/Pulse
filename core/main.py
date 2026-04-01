import asyncio
import os
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.responses import FileResponse
from starlette.types import Scope
from pydantic import BaseModel


class SPAStaticFiles(StaticFiles):
    """Serve index.html for any path that isn't a real static file (SPA fallback)."""
    async def get_response(self, path: str, scope: Scope):
        try:
            return await super().get_response(path, scope)
        except Exception:
            return FileResponse(Path(self.directory) / "index.html")


from api.routes import containers, apps, metrics, logs, system, groups, storage, files, terminal, users
from api.auth import verify_key, auth_enabled, setup_required, save_key


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Pre-warm the store cache in background so first App Store load is fast
    loop = asyncio.get_event_loop()
    loop.run_in_executor(None, _prewarm_store)
    yield


def _prewarm_store():
    try:
        from services.store_service import fetch_store_apps
        fetch_store_apps()
    except Exception as e:
        print(f"[Startup] Store pre-warm failed: {e}")


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
app.include_router(system.router, prefix="/api/system", tags=["system"])
app.include_router(groups.router, prefix="/api/groups", tags=["groups"])
app.include_router(storage.router, prefix="/api/storage", tags=["storage"])
app.include_router(files.router, prefix="/api/files", tags=["files"])
app.include_router(terminal.router, prefix="/api/terminal", tags=["terminal"])
app.include_router(users.router, prefix="/api/users", tags=["users"])


@app.get("/api/health", dependencies=[])
async def health():
    return {"status": "ok", "version": "1.0.0"}


@app.get("/api/auth/status", dependencies=[])
async def auth_status():
    from services.user_service import any_users_exist
    multi = any_users_exist()
    return {
        "auth_enabled":  auth_enabled(),
        "setup_required": setup_required(),
        "multi_user":    multi,
    }


@app.get("/api/auth/verify")
async def auth_verify():
    return {"valid": True}


class SetupRequest(BaseModel):
    key: str


@app.post("/api/auth/setup", dependencies=[])
async def auth_setup(req: SetupRequest):
    if not setup_required():
        raise HTTPException(status_code=400, detail="Auth already configured")
    if len(req.key) < 8:
        raise HTTPException(status_code=400, detail="Key must be at least 8 characters")
    save_key(req.key)
    return {"ok": True}


class LoginRequest(BaseModel):
    username: str
    password: str


class SetupUserRequest(BaseModel):
    username: str
    password: str


@app.post("/api/auth/login", dependencies=[])
async def auth_login(req: LoginRequest):
    from services.user_service import verify_password, any_users_exist
    if not any_users_exist():
        raise HTTPException(status_code=400, detail="No users configured")
    user = verify_password(req.username, req.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return {"username": user["username"], "role": user["role"]}


@app.post("/api/auth/setup-user", dependencies=[])
async def auth_setup_user(req: SetupUserRequest):
    """Create the first admin user (only works when no users exist)."""
    from services.user_service import any_users_exist, create_user
    if any_users_exist():
        raise HTTPException(status_code=400, detail="Users already configured")
    if len(req.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    user = create_user(req.username, req.password, "admin")
    return {"username": user["username"], "role": user["role"]}


# Static files mount LAST — catch-all, must come after all API routes
frontend_path = "/app/frontend/dist"
if os.path.exists(frontend_path):
    app.mount("/", SPAStaticFiles(directory=frontend_path, html=True), name="frontend")
