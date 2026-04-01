from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import Optional, List
from services import app_service, docker_service, store_service

router = APIRouter()


class InstallRequest(BaseModel):
    env_overrides: Optional[dict] = {}


class ReconfigureRequest(BaseModel):
    env: dict


class PortMapping(BaseModel):
    host: str
    container: str
    protocol: str = "tcp"


class VolumeMapping(BaseModel):
    host: str
    container: str
    mode: str = "rw"


class EnvVar(BaseModel):
    key: str
    value: str


class CustomInstallRequest(BaseModel):
    image: str
    tag: str = "latest"
    name: str
    icon_url: str = ""
    network: str = "bridge"
    ports: List[PortMapping] = []
    volumes: List[VolumeMapping] = []
    env: List[EnvVar] = []
    restart: str = "unless-stopped"
    webui_port: str = ""
    webui_path: str = "/"


@router.get("/templates")
def list_templates():
    local = app_service.list_templates()
    remote = store_service.fetch_store_apps()
    return local + remote


@router.get("/store/refresh")
def refresh_store():
    apps = store_service.fetch_store_apps(force=True)
    return {"refreshed": len(apps)}


@router.get("/templates/{app_id}")
def get_template(app_id: str):
    t = app_service.get_template(app_id)
    if not t:
        raise HTTPException(404, f"Template '{app_id}' not found")
    return t


@router.get("/installed")
def list_installed():
    installed = app_service.get_installed_apps()
    # Enrich with live container status
    for app in installed:
        try:
            c = docker_service.get_container(app["container_name"])
            app["status"] = c.status
        except Exception:
            app["status"] = "missing"
    return installed


@router.get("/installed/{app_id}")
def get_installed(app_id: str):
    app = app_service.get_installed_app(app_id)
    if not app:
        raise HTTPException(404, f"App '{app_id}' not installed")
    try:
        c = docker_service.get_container(app["container_name"])
        app["status"] = c.status
    except Exception:
        app["status"] = "missing"
    return app


@router.post("/install/{app_id}")
def install_app(app_id: str, req: InstallRequest):
    try:
        return app_service.install_app(app_id, req.env_overrides)
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(500, str(e))


@router.delete("/uninstall/{app_id}")
def uninstall_app(app_id: str, remove_data: bool = False):
    try:
        return app_service.uninstall_app(app_id, remove_data=remove_data)
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(500, str(e))


@router.post("/installed/{app_id}/start")
def start_app(app_id: str):
    app = app_service.get_installed_app(app_id)
    if not app:
        raise HTTPException(404, f"App '{app_id}' not installed")
    try:
        return docker_service.start_container(app["container_name"])
    except Exception as e:
        raise HTTPException(500, str(e))


@router.post("/installed/{app_id}/stop")
def stop_app(app_id: str):
    app = app_service.get_installed_app(app_id)
    if not app:
        raise HTTPException(404, f"App '{app_id}' not installed")
    try:
        return docker_service.stop_container(app["container_name"])
    except Exception as e:
        raise HTTPException(500, str(e))


@router.post("/installed/{app_id}/restart")
def restart_app(app_id: str):
    app = app_service.get_installed_app(app_id)
    if not app:
        raise HTTPException(404, f"App '{app_id}' not installed")
    try:
        return docker_service.restart_container(app["container_name"])
    except Exception as e:
        raise HTTPException(500, str(e))


@router.post("/installed/{app_id}/update")
def update_app(app_id: str):
    """Pull latest image and recreate container with same config."""
    try:
        return app_service.update_app(app_id)
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(500, str(e))


@router.post("/custom-install")
def custom_install(req: CustomInstallRequest):
    """Install any Docker image with full configuration (CasaOS-style)."""
    full_image = f"{req.image}:{req.tag}" if req.tag else req.image

    ports = {}
    for p in req.ports:
        if p.host and p.container:
            key = f"{p.container}/{p.protocol}"
            try:
                ports[key] = int(p.host)
            except ValueError:
                pass

    volumes = {}
    for v in req.volumes:
        if v.host and v.container:
            volumes[v.host] = {"bind": v.container, "mode": v.mode}

    environment = {e.key: e.value for e in req.env if e.key.strip()}

    labels = {
        "pulse.custom": "true",
        "pulse.icon_url": req.icon_url,
        "pulse.webui_port": req.webui_port,
        "pulse.webui_path": req.webui_path,
    }

    config = {
        "image": full_image,
        "name": req.name,
        "ports": ports,
        "volumes": volumes,
        "environment": environment,
        "restart": req.restart,
        "labels": labels,
    }
    if req.network and req.network != "bridge":
        config["network"] = req.network

    try:
        docker_service.pull_image(full_image)
        return docker_service.run_container(config)
    except Exception as e:
        raise HTTPException(500, str(e))


@router.put("/installed/{app_id}/reconfigure")
def reconfigure_app(app_id: str, req: ReconfigureRequest):
    """Update env vars and recreate container."""
    try:
        return app_service.reconfigure_app(app_id, req.env)
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(500, str(e))
