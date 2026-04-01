"""
Remote store service — fetches apps from CasaOS-compatible GitHub stores.
Parses app.json + docker-compose.yml from each app directory.
"""
import json
import re
import time
import urllib.request
from typing import Optional

STORE_URL = "https://api.github.com/repos/mariosemes/CasaOS-TMCstore/contents/Apps"
RAW_BASE = "https://raw.githubusercontent.com/mariosemes/CasaOS-TMCstore/main/Apps"

_cache: dict = {"apps": [], "fetched_at": 0}
CACHE_TTL = 3600  # 1 hour


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


def _parse_compose_port(compose_text: str) -> Optional[str]:
    """Extract the first host port from docker-compose.yml ports section."""
    m = re.search(r'WEBUI_PORT[^:]*:\s*(\d+)', compose_text)
    if m:
        return m.group(1)
    m = re.search(r'"(\d+):\d+/tcp"', compose_text)
    if m:
        return m.group(1)
    m = re.search(r'-\s*["\']?(\d+):\d+["\']?', compose_text)
    if m:
        return m.group(1)
    return None


def _parse_compose_image(compose_text: str) -> Optional[str]:
    m = re.search(r'image:\s*([^\s\n]+)', compose_text)
    return m.group(1).strip() if m else None


def _parse_compose_env(compose_text: str) -> list:
    envs = re.findall(r'-\s*([\w]+=[^\n]+)', compose_text)
    return [e.strip() for e in envs if '=' in e]


def fetch_store_apps(force: bool = False) -> list:
    global _cache
    now = time.time()
    if not force and _cache["apps"] and (now - _cache["fetched_at"]) < CACHE_TTL:
        return _cache["apps"]

    print("[StoreService] Fetching store apps from GitHub...")
    entries = _fetch_json(STORE_URL)
    if not entries:
        return _cache["apps"]

    apps = []
    for entry in entries:
        if entry.get("type") != "dir":
            continue

        app_id = entry["name"]
        app_json_url = f"{RAW_BASE}/{app_id}/app.json"
        compose_url = f"{RAW_BASE}/{app_id}/docker-compose.yml"

        meta = _fetch_json(app_json_url)
        compose_text = _fetch_text(compose_url)

        if not meta:
            continue

        image = meta.get("image", "")
        tag = meta.get("tag", "latest")
        if image and not image.endswith(f":{tag}"):
            image = f"{image}:{tag}"

        if compose_text and not image:
            image = _parse_compose_image(compose_text) or ""

        port = None
        if compose_text:
            port = _parse_compose_port(compose_text)

        icon_url = (
            f"https://cdn.jsdelivr.net/gh/mariosemes/CasaOS-TMCstore@main/Apps/{app_id}/icon.png"
        )

        apps.append({
            "id": f"store-{app_id}",
            "name": meta.get("app", app_id),
            "description": meta.get("description", ""),
            "version": tag,
            "category": "store",
            "source": "tmcstore",
            "icon_url": icon_url,
            "app_url": meta.get("app_url", ""),
            "docker": {
                "image": image,
                "ports": [f"{port}:{port}"] if port else [],
                "env": _parse_compose_env(compose_text) if compose_text else [],
                "volumes": [],
                "restart": "unless-stopped",
            },
        })
        print(f"[StoreService] Loaded: {meta.get('app', app_id)}")

    _cache = {"apps": apps, "fetched_at": now}
    print(f"[StoreService] Loaded {len(apps)} store apps")
    return apps
