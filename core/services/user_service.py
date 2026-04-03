"""
User service — manages multi-user accounts with RBAC.
Users are stored in /app/data/users.json.

Roles:
  admin  — full access (all operations)
  viewer — read-only (GET endpoints only, no mutations)
"""
import hashlib
import json
import os
import secrets
from pathlib import Path
from typing import Optional

_DATA_DIR = Path(os.getenv("PULSE_DATA_DIR", "/app/data"))
_USERS_FILE = _DATA_DIR / "users.json"

ROLES = ("admin", "viewer")


def _hash_password(password: str, salt: str) -> str:
    return hashlib.sha256(f"{salt}{password}".encode()).hexdigest()


def _load_users() -> dict:
    try:
        if _USERS_FILE.exists():
            return json.loads(_USERS_FILE.read_text())
    except Exception:
        pass
    return {}


def _save_users(users: dict) -> None:
    _DATA_DIR.mkdir(parents=True, exist_ok=True)
    _USERS_FILE.write_text(json.dumps(users, indent=2))


def list_users() -> list:
    users = _load_users()
    return [
        {"username": u, "role": v["role"], "display_name": v.get("display_name", u)}
        for u, v in users.items()
    ]


def get_user(username: str) -> Optional[dict]:
    return _load_users().get(username)


def create_user(username: str, password: str, role: str = "viewer", display_name: str = "") -> dict:
    if role not in ROLES:
        raise ValueError(f"Invalid role: {role}")
    users = _load_users()
    if username in users:
        raise ValueError(f"User '{username}' already exists")
    salt = secrets.token_hex(16)
    users[username] = {
        "role":         role,
        "display_name": display_name or username,
        "salt":         salt,
        "password":     _hash_password(password, salt),
    }
    _save_users(users)
    return {"username": username, "role": role, "display_name": users[username]["display_name"]}


def update_user(username: str, password: Optional[str] = None, role: Optional[str] = None) -> dict:
    users = _load_users()
    if username not in users:
        raise ValueError(f"User '{username}' not found")
    if role is not None:
        if role not in ROLES:
            raise ValueError(f"Invalid role: {role}")
        users[username]["role"] = role
    if password is not None:
        salt = secrets.token_hex(16)
        users[username]["salt"]     = salt
        users[username]["password"] = _hash_password(password, salt)
    _save_users(users)
    return {"username": username, "role": users[username]["role"]}


def delete_user(username: str) -> None:
    users = _load_users()
    if username not in users:
        raise ValueError(f"User '{username}' not found")
    del users[username]
    _save_users(users)


def verify_password(username: str, password: str) -> Optional[dict]:
    """Returns user dict if credentials valid, None otherwise."""
    user = get_user(username)
    if not user:
        return None
    expected = _hash_password(password, user["salt"])
    if not secrets.compare_digest(expected, user["password"]):
        return None
    return {"username": username, "role": user["role"], "display_name": user.get("display_name", username)}


def any_users_exist() -> bool:
    return bool(_load_users())


def get_preferences(username: str) -> dict:
    user = _load_users().get(username, {})
    return user.get("preferences", {})


def save_preferences(username: str, prefs: dict) -> dict:
    users = _load_users()
    if username not in users:
        raise ValueError(f"User '{username}' not found")
    users[username]["preferences"] = prefs
    _save_users(users)
    return prefs
