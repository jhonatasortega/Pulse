"""
Store registry — manages the list of app stores in /app/data/stores.json.
Each store entry: { id, name, type, url, enabled }
"""
import json
import os
from pathlib import Path

_DATA_DIR = Path(os.getenv("PULSE_DATA_DIR", "/app/data"))
_STORES_FILE = _DATA_DIR / "stores.json"

# Built-in stores — always present as defaults if stores.json doesn't exist yet
DEFAULT_STORES = [
    {
        "id":      "tmc",
        "name":    "TMC Store",
        "type":    "github_tmc",
        "url":     "https://github.com/mariosemes/CasaOS-TMCstore",
        "enabled": True,
    },
    {
        "id":      "cp0204-play",
        "name":    "Play Store (x86)",
        "type":    "zip",
        "url":     "https://play.cuse.eu.org/Cp0204-AppStore-Play.zip",
        "enabled": True,
    },
    {
        "id":      "cp0204-play-arm",
        "name":    "Play Store (ARM)",
        "type":    "zip",
        "url":     "https://play.cuse.eu.org/Cp0204-AppStore-Play-arm.zip",
        "enabled": True,
    },
    {
        "id":      "home-automation",
        "name":    "Home Automation Store",
        "type":    "zip",
        "url":     "https://github.com/mr-manuel/CasaOS-HomeAutomation-AppStore/archive/refs/tags/latest.zip",
        "enabled": True,
    },
    {
        "id":      "big-bear",
        "name":    "Big Bear Store",
        "type":    "zip",
        "url":     "https://github.com/bigbeartechworld/big-bear-casaos/archive/refs/heads/master.zip",
        "enabled": True,
    },
    {
        "id":      "pentest",
        "name":    "Pentest Tools",
        "type":    "zip",
        "url":     "https://github.com/arch3rPro/Pentest-Docker/archive/refs/heads/master.zip",
        "enabled": True,
    },
]


def _load() -> list:
    try:
        if _STORES_FILE.exists():
            return json.loads(_STORES_FILE.read_text())
    except Exception:
        pass
    return DEFAULT_STORES[:]


def _save(stores: list) -> None:
    _DATA_DIR.mkdir(parents=True, exist_ok=True)
    _STORES_FILE.write_text(json.dumps(stores, indent=2))


def list_stores() -> list:
    return _load()


def add_store(store_id: str, name: str, url: str, store_type: str = "zip") -> dict:
    stores = _load()
    if any(s["id"] == store_id for s in stores):
        raise ValueError(f"Store '{store_id}' already exists")
    entry = {"id": store_id, "name": name, "type": store_type, "url": url, "enabled": True}
    stores.append(entry)
    _save(stores)
    return entry


def remove_store(store_id: str) -> None:
    stores = _load()
    stores = [s for s in stores if s["id"] != store_id]
    _save(stores)


def toggle_store(store_id: str, enabled: bool) -> dict:
    stores = _load()
    for s in stores:
        if s["id"] == store_id:
            s["enabled"] = enabled
            _save(stores)
            return s
    raise ValueError(f"Store '{store_id}' not found")


def get_enabled_stores() -> list:
    stores = _load()
    if not stores:
        return DEFAULT_STORES[:]
    return [s for s in stores if s.get("enabled", True)]
