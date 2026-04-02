"""
Store service — unified multi-store fetcher.
Coordinates the TMC GitHub store and any zip-based stores from the registry.
"""
import json
import re
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Optional

from services import store_registry, zip_store_service

# ─── TMC GitHub store (original) ─────────────────────────────────────────────

TMC_API_URL = "https://api.github.com/repos/mariosemes/CasaOS-TMCstore/contents/Apps"
TMC_RAW_BASE = "https://raw.githubusercontent.com/mariosemes/CasaOS-TMCstore/main/Apps"

_tmc_cache: dict = {"apps": [], "fetched_at": 0}
CACHE_TTL = 3600


def _fetch_json(url: str) -> Optional[dict | list]:
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Pulse/1.0"})
        with urllib.request.urlopen(req, timeout=10) as r:
            return json.loads(r.read())
    except Exception as e:
        print(f"[StoreService] fetch error {url}: {e}")
        return None


def _fetch_text(url: str) -> Optional[str]:
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Pulse/1.0"})
        with urllib.request.urlopen(req, timeout=10) as r:
            return r.read().decode("utf-8", errors="replace")
    except Exception as e:
        print(f"[StoreService] fetch error {url}: {e}")
        return None


def _parse_compose_port(text: str) -> Optional[str]:
    m = re.search(r'WEBUI_PORT[^:]*:\s*(\d+)', text)
    if m: return m.group(1)
    m = re.search(r'"(\d+):\d+/tcp"', text)
    if m: return m.group(1)
    m = re.search(r'-\s*["\']?(\d+):\d+["\']?', text)
    if m: return m.group(1)
    return None


def _parse_compose_image(text: str) -> Optional[str]:
    m = re.search(r'image:\s*([^\s\n]+)', text)
    return m.group(1).strip() if m else None


def _parse_compose_env(text: str) -> list:
    return [e.strip() for e in re.findall(r'-\s*([\w]+=[^\n]+)', text) if "=" in e]


def _fetch_tmc_app(app_id: str) -> Optional[dict]:
    meta = _fetch_json(f"{TMC_RAW_BASE}/{app_id}/app.json")
    compose_text = _fetch_text(f"{TMC_RAW_BASE}/{app_id}/docker-compose.yml")
    if not meta:
        return None
    image = meta.get("image", "")
    tag   = meta.get("tag", "latest")
    if image and not image.endswith(f":{tag}"):
        image = f"{image}:{tag}"
    if compose_text and not image:
        image = _parse_compose_image(compose_text) or ""
    port     = _parse_compose_port(compose_text) if compose_text else None
    icon_url = f"https://cdn.jsdelivr.net/gh/mariosemes/CasaOS-TMCstore@main/Apps/{app_id}/icon.png"
    return {
        "id":          f"store-{app_id}",
        "name":        meta.get("app", app_id),
        "description": meta.get("description", ""),
        "version":     tag,
        "category":    "store",
        "source":      "tmc",
        "store_name":  "TMC Store",
        "icon_url":    icon_url,
        "app_url":     meta.get("app_url", ""),
        "docker": {
            "image":   image,
            "ports":   [f"{port}:{port}"] if port else [],
            "env":     _parse_compose_env(compose_text) if compose_text else [],
            "volumes": [],
            "restart": "unless-stopped",
        },
    }


def _fetch_tmc_store(force: bool = False) -> list:
    global _tmc_cache
    now = time.time()
    if not force and _tmc_cache["apps"] and (now - _tmc_cache["fetched_at"]) < CACHE_TTL:
        return _tmc_cache["apps"]

    print("[StoreService] Fetching TMC store from GitHub...")
    entries = _fetch_json(TMC_API_URL)
    if not entries:
        return _tmc_cache["apps"]

    app_ids = [e["name"] for e in entries if e.get("type") == "dir"]
    apps = []
    with ThreadPoolExecutor(max_workers=12) as ex:
        futures = {ex.submit(_fetch_tmc_app, aid): aid for aid in app_ids}
        for f in as_completed(futures):
            result = f.result()
            if result:
                apps.append(result)

    apps.sort(key=lambda a: a["name"].lower())
    _tmc_cache = {"apps": apps, "fetched_at": now}
    print(f"[StoreService] TMC: loaded {len(apps)} apps")
    return apps


# ─── Unified fetch ────────────────────────────────────────────────────────────

def _fetch_one_store(store: dict, force: bool) -> list:
    sid   = store["id"]
    sname = store["name"]
    stype = store.get("type", "zip")
    url   = store.get("url", "")

    if stype == "github_tmc":
        return _fetch_tmc_store(force)

    if stype == "zip":
        return zip_store_service.fetch_zip_store(sid, sname, url, force)

    return []


def fetch_store_apps(force: bool = False) -> list:
    """Fetch apps from all enabled stores concurrently."""
    stores = store_registry.get_enabled_stores()
    all_apps = []

    with ThreadPoolExecutor(max_workers=len(stores) or 1) as ex:
        futures = {ex.submit(_fetch_one_store, s, force): s["id"] for s in stores}
        for f in as_completed(futures):
            try:
                all_apps.extend(f.result())
            except Exception as e:
                print(f"[StoreService] Error fetching store: {e}")

    # Deduplicate by id (keep first occurrence)
    seen = set()
    deduped = []
    for app in all_apps:
        if app["id"] not in seen:
            seen.add(app["id"])
            deduped.append(app)

    return deduped


def _reset_tmc_cache():
    global _tmc_cache
    _tmc_cache = {"apps": [], "fetched_at": 0}


def refresh_store(store_id: Optional[str] = None) -> int:
    """Force-refresh one or all stores."""
    if store_id:
        zip_store_service.bust(store_id)
        if store_id == "tmc":
            _reset_tmc_cache()
        stores = [s for s in store_registry.get_enabled_stores() if s["id"] == store_id]
    else:
        zip_store_service.bust_all()
        _reset_tmc_cache()
        stores = store_registry.get_enabled_stores()

    apps = []
    with ThreadPoolExecutor(max_workers=len(stores) or 1) as ex:
        futures = {ex.submit(_fetch_one_store, s, True): s["id"] for s in stores}
        for f in as_completed(futures):
            try:
                apps.extend(f.result())
            except Exception:
                pass
    return len(apps)
