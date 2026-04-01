import os
import secrets
from fastapi import Header, HTTPException, Request
from fastapi.security import APIKeyHeader

_header_scheme = APIKeyHeader(name="X-Pulse-Key", auto_error=False)

# If PULSE_API_KEY is not set, auth is disabled (dev/local mode)
_API_KEY = os.getenv("PULSE_API_KEY", "")


def auth_enabled() -> bool:
    return bool(_API_KEY)


def verify_key(x_pulse_key: str = Header(default=None)):
    if not auth_enabled():
        return
    if not x_pulse_key or not secrets.compare_digest(x_pulse_key, _API_KEY):
        raise HTTPException(status_code=401, detail="Invalid or missing API key")


# Public dependency — use this on routes that should always be accessible
def no_auth():
    return
