import os
import json
import yaml
from pathlib import Path
from typing import Optional
from . import docker_service

TEMPLATES_DIR = "/app/apps/templates"
DATA_DIR = "/app/data/apps"


def list_templates() -> list:
    templates = []
    path = Path(TEMPLATES_DIR)
    if not path.exists():
        return templates
    for f in path.glob("*.yml"):
        try:
            with open(f) as fp:
                t = yaml.safe_load(fp)
                t["_file"] = f.stem
                templates.append(t)
        except Exception as e:
            print(f"[AppService] Failed to load template {f}: {e}")
    return templates


def get_template(app_id: str) -> Optional[dict]:
    path = Path(TEMPLATES_DIR) / f"{app_id}.yml"
    if not path.exists():
        return None
    with open(path) as f:
        return yaml.safe_load(f)


def get_installed_apps() -> list:
    path = Path(DATA_DIR)
    path.mkdir(parents=True, exist_ok=True)
    apps = []
    for f in path.glob("*.json"):
        try:
            with open(f) as fp:
                apps.append(json.load(fp))
        except Exception:
            pass
    return apps


def get_installed_app(app_id: str) -> Optional[dict]:
    path = Path(DATA_DIR) / f"{app_id}.json"
    if not path.exists():
        return None
    with open(path) as f:
        return json.load(f)


def save_app_state(app_id: str, data: dict):
    path = Path(DATA_DIR)
    path.mkdir(parents=True, exist_ok=True)
    with open(path / f"{app_id}.json", "w") as f:
        json.dump(data, f, indent=2)


def delete_app_state(app_id: str):
    path = Path(DATA_DIR) / f"{app_id}.json"
    if path.exists():
        path.unlink()


def _build_run_config(template: dict, overrides: dict = None) -> dict:
    overrides = overrides or {}
    docker_cfg = template.get("docker", {})

    # Parse ports: "8080:80" -> {"80/tcp": 8080}
    ports = {}
    for p in docker_cfg.get("ports", []):
        host_port, container_port = p.split(":")
        ports[container_port] = int(host_port)

    # Parse volumes: "./data:/data" -> {"/app/data/APP_ID/data": {"bind": "/data", "mode": "rw"}}
    volumes = {}
    app_id = template["id"]
    for v in docker_cfg.get("volumes", []):
        parts = v.split(":")
        host_path = parts[0].replace("./", f"{DATA_DIR}/{app_id}/")
        bind_path = parts[1]
        mode = parts[2] if len(parts) > 2 else "rw"
        os.makedirs(host_path, exist_ok=True)
        volumes[host_path] = {"bind": bind_path, "mode": mode}

    # Parse environment
    environment = {}
    for e in docker_cfg.get("env", []):
        if "=" in e:
            k, v = e.split("=", 1)
            environment[k] = overrides.get(k, v)

    return {
        "image": docker_cfg.get("image"),
        "name": f"pulse_{app_id}",
        "ports": ports,
        "volumes": volumes,
        "environment": environment,
        "restart": docker_cfg.get("restart", "unless-stopped"),
        "labels": {"pulse.managed": "true", "pulse.app": app_id},
    }


def install_app(app_id: str, env_overrides: dict = None, template_override: dict = None) -> dict:
    template = template_override or get_template(app_id)
    if not template:
        # Try store
        from . import store_service
        store_apps = {a["id"]: a for a in store_service.fetch_store_apps()}
        template = store_apps.get(app_id)
    if not template:
        raise ValueError(f"Template '{app_id}' not found")

    existing = get_installed_app(app_id)
    if existing:
        raise ValueError(f"App '{app_id}' is already installed")

    # Pull image first
    docker_cfg = template.get("docker", {})
    docker_service.pull_image(docker_cfg["image"])

    run_config = _build_run_config(template, env_overrides)
    container = docker_service.run_container(run_config)

    state = {
        "id": app_id,
        "name": template["name"],
        "version": template.get("version", "latest"),
        "container_id": container["full_id"],
        "container_name": container["name"],
        "status": container["status"],
        "template": template,
        "env_overrides": env_overrides or {},
    }
    save_app_state(app_id, state)
    return state


def update_app(app_id: str) -> dict:
    """Pull latest image and recreate the container with the same config."""
    state = get_installed_app(app_id)
    if not state:
        raise ValueError(f"App '{app_id}' is not installed")

    template = state["template"]
    docker_cfg = template.get("docker", {})
    image = docker_cfg["image"]

    # Pull latest image
    docker_service.pull_image(image)

    # Stop and remove current container
    try:
        docker_service.remove_container(f"pulse_{app_id}", force=True)
    except Exception as e:
        print(f"[AppService] Remove before update warning: {e}")

    # Recreate with same env overrides
    run_config = _build_run_config(template, state.get("env_overrides", {}))
    container = docker_service.run_container(run_config)

    state["container_id"] = container["full_id"]
    state["container_name"] = container["name"]
    state["status"] = container["status"]
    save_app_state(app_id, state)
    return state


def reconfigure_app(app_id: str, new_env: dict) -> dict:
    """Update env vars and recreate the container."""
    state = get_installed_app(app_id)
    if not state:
        raise ValueError(f"App '{app_id}' is not installed")

    template = state["template"]

    # Stop and remove current container
    try:
        docker_service.remove_container(f"pulse_{app_id}", force=True)
    except Exception as e:
        print(f"[AppService] Remove before reconfig warning: {e}")

    # Merge: base env from template + new overrides
    run_config = _build_run_config(template, new_env)
    container = docker_service.run_container(run_config)

    state["container_id"] = container["full_id"]
    state["container_name"] = container["name"]
    state["status"] = container["status"]
    state["env_overrides"] = new_env
    save_app_state(app_id, state)
    return state


def uninstall_app(app_id: str, remove_data: bool = False) -> dict:
    state = get_installed_app(app_id)
    if not state:
        raise ValueError(f"App '{app_id}' is not installed")

    try:
        docker_service.remove_container(f"pulse_{app_id}", force=True)
    except Exception as e:
        print(f"[AppService] Container removal warning: {e}")

    delete_app_state(app_id)

    if remove_data:
        import shutil
        data_path = Path(DATA_DIR) / app_id
        if data_path.exists():
            shutil.rmtree(data_path)

    return {"uninstalled": app_id}
