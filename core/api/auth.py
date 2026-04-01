"""
Auth module — supports two modes:

1. API-key mode (legacy): PULSE_API_KEY env var or /app/data/auth.json
2. Multi-user mode: users stored in /app/data/users.json

Multi-user mode activates when users.json exists and has entries.
In multi-user mode the frontend sends  X-Pulse-User: username
and  X-Pulse-Pass: password  (base64 NOT used — sent over HTTPS/LAN).

Role enforcement:
  admin  → all methods
  viewer → GET / WebSocket only (write operations return 403)
"""
import json
import os
import secrets
from pathlib import Path
from fastapi import Header, HTTPException, Request

_DATA_DIR = Path(os.getenv("PULSE_DATA_DIR", "/app/data"))
_AUTH_FILE = _DATA_DIR / "auth.json"


# ─── API-key helpers (legacy / single-user) ───────────────────────────────────

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


# ─── Multi-user helpers ───────────────────────────────────────────────────────

def _multi_user_mode() -> bool:
    from services.user_service import any_users_exist
    return any_users_exist()


def _get_current_user(
    x_pulse_key:  str = Header(default=None),
    x_pulse_user: str = Header(default=None),
    x_pulse_pass: str = Header(default=None),
) -> dict | None:
    """
    Returns user dict {"username": ..., "role": ...} or None if anonymous.
    Raises 401 if credentials are provided but wrong.
    """
    if _multi_user_mode():
        if x_pulse_user and x_pulse_pass:
            from services.user_service import verify_password
            user = verify_password(x_pulse_user, x_pulse_pass)
            if not user:
                raise HTTPException(status_code=401, detail="Invalid credentials")
            return user
        # In multi-user mode, unauthenticated = not allowed
        return None

    # API-key mode
    api_key = _get_api_key()
    if not api_key:
        return {"username": "admin", "role": "admin"}  # no auth
    if x_pulse_key and secrets.compare_digest(x_pulse_key, api_key):
        return {"username": "admin", "role": "admin"}
    return None


# ─── FastAPI dependencies ─────────────────────────────────────────────────────

def verify_key(
    request: Request,
    x_pulse_key:  str = Header(default=None),
    x_pulse_user: str = Header(default=None),
    x_pulse_pass: str = Header(default=None),
):
    """Global auth dependency — allows access or raises 401."""
    if not auth_enabled():
        return  # open access

    user = _get_current_user(x_pulse_key, x_pulse_user, x_pulse_pass)
    if user is None:
        raise HTTPException(status_code=401, detail="Authentication required")

    # Viewer role: block mutation methods
    if user["role"] == "viewer" and request.method not in ("GET", "HEAD", "OPTIONS"):
        raise HTTPException(status_code=403, detail="Viewers cannot perform write operations")

    # Attach user to request state for downstream use
    request.state.user = user


def require_admin(
    request: Request,
    x_pulse_key:  str = Header(default=None),
    x_pulse_user: str = Header(default=None),
    x_pulse_pass: str = Header(default=None),
):
    """Dependency that requires admin role."""
    if not auth_enabled():
        return

    user = _get_current_user(x_pulse_key, x_pulse_user, x_pulse_pass)
    if user is None or user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")


def no_auth():
    return
