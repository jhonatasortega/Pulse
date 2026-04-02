"""
Zip store fetcher — downloads a zip from a URL, extracts it in memory,
and parses CasaOS-compatible docker-compose.yml files from each app directory.

Supports the x-casaos: extension block for metadata (title, icon, description,
port_map) as well as plain compose files with image/ports/env.
"""
import io
import re
import time
import urllib.request
import zipfile
from typing import Optional

import yaml

_CACHE: dict = {}         # store_id → { apps, fetched_at }
CACHE_TTL = 3600          # 1 hour


def _fetch_bytes(url: str) -> Optional[bytes]:
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Pulse/1.0"})
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.read()
    except Exception as e:
        print(f"[ZipStore] fetch error {url}: {e}")
        return None


def _parse_casaos_ext(meta: dict) -> dict:
    """Extract Pulse-usable fields from x-casaos dict."""
    result = {}

    title = meta.get("title", {})
    if isinstance(title, dict):
        result["name"] = title.get("en_us") or next(iter(title.values()), "")
    elif isinstance(title, str):
        result["name"] = title

    desc = meta.get("description", {})
    if isinstance(desc, dict):
        result["description"] = desc.get("en_us") or next(iter(desc.values()), "")
    elif isinstance(desc, str):
        result["description"] = desc

    tagline = meta.get("tagline", {})
    if isinstance(tagline, dict):
        result["tagline"] = tagline.get("en_us") or next(iter(tagline.values()), "")

    result["icon_url"]  = meta.get("icon") or meta.get("thumbnail") or ""
    result["port_map"]  = str(meta.get("port_map", "")).strip()
    result["app_url"]   = meta.get("project_url") or meta.get("app_url") or ""
    result["main_svc"]  = meta.get("main") or ""
    return result


def _parse_compose(compose_text: str, app_dir: str, store_id: str, store_name: str) -> Optional[dict]:
    """Parse a docker-compose.yml and return a Pulse template dict."""
    try:
        doc = yaml.safe_load(compose_text)
    except Exception:
        return None

    if not isinstance(doc, dict):
        return None

    services = doc.get("services", {})
    if not services:
        return None

    # x-casaos metadata
    casaos_meta = doc.get("x-casaos", {}) or {}
    parsed_meta = _parse_casaos_ext(casaos_meta) if casaos_meta else {}

    # Pick the "main" service (from x-casaos or first one)
    main_svc_name = parsed_meta.get("main_svc") or next(iter(services))
    svc = services.get(main_svc_name) or next(iter(services.values()))
    if not isinstance(svc, dict):
        return None

    image = str(svc.get("image", "")).strip()
    if not image:
        return None

    # App name — prefer x-casaos title, then dir name
    raw_name = parsed_meta.get("name") or app_dir.replace("-", " ").replace("_", " ").title()

    # Unique id
    app_id = f"{store_id}-{re.sub(r'[^a-z0-9]', '-', app_dir.lower())}"

    # Ports
    ports_raw = svc.get("ports", []) or []
    ports = []
    for p in ports_raw:
        p = str(p).strip().strip('"\'')
        m = re.match(r'(\d+):(\d+)', p)
        if m:
            ports.append(f"{m.group(1)}:{m.group(2)}")

    # Volumes
    vols_raw = svc.get("volumes", []) or []
    volumes = []
    for v in vols_raw:
        if isinstance(v, str) and ":" in v:
            volumes.append(v)
        elif isinstance(v, dict) and v.get("source"):
            volumes.append(f"{v['source']}:{v.get('target', v['source'])}")

    # Env
    env_raw = svc.get("environment", []) or []
    env = []
    if isinstance(env_raw, list):
        env = [e for e in env_raw if isinstance(e, str) and "=" in e]
    elif isinstance(env_raw, dict):
        env = [f"{k}={v}" for k, v in env_raw.items()]

    # WebUI port — from x-casaos port_map or first exposed port
    webui_port = parsed_meta.get("port_map") or ""
    if not webui_port and ports:
        m = re.match(r'(\d+):', ports[0])
        if m:
            webui_port = m.group(1)

    # Icon URL
    icon_url = parsed_meta.get("icon_url") or ""
    if not icon_url:
        labels = svc.get("labels", {}) or {}
        if isinstance(labels, dict):
            icon_url = labels.get("icon") or labels.get("net.unraid.docker.icon") or ""
        elif isinstance(labels, list):
            for lbl in labels:
                if isinstance(lbl, str) and lbl.startswith("icon="):
                    icon_url = lbl.split("=", 1)[1]
                    break

    description = parsed_meta.get("description") or parsed_meta.get("tagline") or ""

    return {
        "id":          app_id,
        "name":        raw_name,
        "description": description,
        "version":     "latest",
        "category":    store_id,
        "source":      store_id,
        "store_name":  store_name,
        "icon_url":    icon_url,
        "app_url":     parsed_meta.get("app_url") or "",
        "docker": {
            "image":   image,
            "ports":   ports,
            "env":     env,
            "volumes": volumes,
            "restart": "unless-stopped",
        },
    }


def fetch_zip_store(store_id: str, store_name: str, url: str, force: bool = False) -> list:
    """Download and parse a zip-based app store."""
    global _CACHE
    now = time.time()
    cached = _CACHE.get(store_id)
    if not force and cached and (now - cached["fetched_at"]) < CACHE_TTL:
        return cached["apps"]

    print(f"[ZipStore] Fetching {store_name} from {url}")
    data = _fetch_bytes(url)
    if not data:
        return cached["apps"] if cached else []

    apps = []
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as zf:
            names = zf.namelist()

            # Find all docker-compose.yml files
            compose_files = [n for n in names if n.endswith("docker-compose.yml")]

            for compose_path in compose_files:
                # Directory name = app name (skip root-level compose files)
                parts = compose_path.rstrip("/").split("/")
                if len(parts) < 2:
                    continue

                # Try to find app dir — usually Apps/AppName/docker-compose.yml
                # or Root/AppName/docker-compose.yml
                if len(parts) >= 3 and parts[-2].lower() not in ("", "apps"):
                    app_dir = parts[-2]
                elif len(parts) >= 2:
                    app_dir = parts[-2]
                else:
                    continue

                # Skip obviously non-app dirs
                if app_dir.lower() in ("apps", "templates", "docs", ".github", "scripts"):
                    continue

                try:
                    compose_text = zf.read(compose_path).decode("utf-8", errors="replace")
                except Exception:
                    continue

                app = _parse_compose(compose_text, app_dir, store_id, store_name)
                if app:
                    apps.append(app)

    except zipfile.BadZipFile as e:
        print(f"[ZipStore] Bad zip from {url}: {e}")
        return cached["apps"] if cached else []
    except Exception as e:
        print(f"[ZipStore] Error parsing {url}: {e}")
        return cached["apps"] if cached else []

    apps.sort(key=lambda a: a["name"].lower())
    _CACHE[store_id] = {"apps": apps, "fetched_at": now}
    print(f"[ZipStore] {store_name}: loaded {len(apps)} apps")
    return apps


def bust(store_id: str):
    _CACHE.pop(store_id, None)


def bust_all():
    _CACHE.clear()
