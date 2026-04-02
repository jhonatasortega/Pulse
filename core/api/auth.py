"""
Auth module — supports two modes:

1. API-key mode (legacy): PULSE_API_KEY env var or /app/data/auth.json
2. Multi-user mode: users stored in /app/data/users.json

Credentials can arrive as:
  - HTTP headers:  X-Pulse-Key, X-Pulse-User, X-Pulse-Pass
  - Query params:  ?key=, ?user=, ?pass=   (used by WebSocket — browsers can't send WS headers)

Role enforcement:
  admin  → all methods
  viewer → GET / WebSocket only (write operations return 403)
"""
import json
import os
import secrets
from pathlib import Path
from fastapi import HTTPException, Request

_DATA_DIR = Path(os.getenv("PULSE_DATA_DIR", "/app/data"))
_AUTH_FILE = _DATA_DIR / "auth.json"


# ─── API-key helpers ─────────────────────────────────────────────────────────

def _load_key_from_file() -> str:
    try:
        if _AUTH_FILE.exists():
            data = json.loads(_AUTH_FILE.read_text())
            return data.get("key", "")
    except Exception:
        pass
    return ""


def _get_api_key() -> str:
    return os.getenv("PULSE_API_KEY", "") or _load_key_from_file()


def auth_enabled() -> bool:
    from services.user_service import any_users_exist
    return bool(_get_api_key()) or any_users_exist()


def setup_required() -> bool:
    from services.user_service import any_users_exist
    return not bool(_get_api_key()) and not any_users_exist()


def save_key(key: str) -> None:
    _DATA_DIR.mkdir(parents=True, exist_ok=True)
    _AUTH_FILE.write_text(json.dumps({"key": key}))


# ─── Credential extraction (headers OR query params) ─────────────────────────

def _extract_credentials(request: Request) -> tuple[str, str, str]:
    """Returns (api_key, username, password) from headers or query params."""
    q = request.query_params
    h = request.headers
    api_key  = h.get("x-pulse-key")  or q.get("key")  or ""
    username = h.get("x-pulse-user") or q.get("user") or ""
    password = h.get("x-pulse-pass") or q.get("pass") or ""
    return api_key, username, password


def _resolve_user(request: Request) -> dict | None:
    """
    Returns user dict {"username": ..., "role": ...} or None if anonymous.
    Raises 401 if credentials are provided but wrong.
    """
    api_key, username, password = _extract_credentials(request)

    from services.user_service import any_users_exist
    if any_users_exist():
        if username and password:
            from services.user_service import verify_password
            user = verify_password(username, password)
            if not user:
                raise HTTPException(status_code=401, detail="Invalid credentials")
            return user
        return None  # unauthenticated in multi-user mode

    # API-key mode
    key = _get_api_key()
    if not key:
        return {"username": "admin", "role": "admin"}  # open access
    if api_key and secrets.compare_digest(api_key, key):
        return {"username": "admin", "role": "admin"}
    return None


# ─── FastAPI dependencies ─────────────────────────────────────────────────────

def verify_key(request: Request):
    """Global auth dependency — allows access or raises 401/403."""
    if not auth_enabled():
        return

    user = _resolve_user(request)
    if user is None:
        raise HTTPException(status_code=401, detail="Authentication required")

    # Viewer: block mutation methods (WebSocket connections always pass — they're read-only streams)
    is_ws = request.scope.get("type") == "websocket"
    if user["role"] == "viewer" and not is_ws and request.method not in ("GET", "HEAD", "OPTIONS"):
        raise HTTPException(status_code=403, detail="Viewers cannot perform write operations")

    request.state.user = user


def require_admin(request: Request):
    """Dependency that requires admin role."""
    if not auth_enabled():
        return

    user = _resolve_user(request)
    if user is None or user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")


def no_auth():
    return
