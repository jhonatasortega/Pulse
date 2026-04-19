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


class HealthCheck(BaseModel):
    test: List[str] = []
    interval: str = "30s"
    timeout: str = "10s"
    retries: int = 3
    start_period: str = "0s"


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
    hostname: Optional[str] = None
    healthcheck: Optional[HealthCheck] = None


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
def install_app(app_id: str, req: InstallRequest, background_tasks: BackgroundTasks):
    try:
        # Register app state immediately so Dashboard can show it
        template = app_service.get_template(app_id)
        if not template:
             # Try store
            from services import store_service
            store_apps = {a["id"]: a for a in store_service.fetch_store_apps()}
            template = store_apps.get(app_id)

        if not template:
            raise HTTPException(404, f"Template '{app_id}' not found")

        state = {
            "id": app_id,
            "name": template["name"],
            "version": template.get("version", "latest"),
            "status": "installing",
            "icon_url": template.get("icon_url", ""),
            "template": template,
            "env_overrides": req.env_overrides or {},
        }
        app_service.save_app_state(app_id, state)

        def _do_install():
            try:
                # Reuse the existing app_service.install_app but without saving state again if possible
                # Actually, let's just let it run. It will overwrite the "installing" state with the final one.
                app_service.install_app(app_id, req.env_overrides, template_override=template)
            except Exception as e:
                state["status"] = "error"
                state["error"] = str(e)
                app_service.save_app_state(app_id, state)

        background_tasks.add_task(_do_install)
        return state
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
def custom_install(req: CustomInstallRequest, background_tasks: BackgroundTasks):
    """Install any Docker image with full configuration (background)."""

    def duration_to_ns(d: str) -> int:
        if not d: return 0
        import re
        m = re.match(r"(\d+)(ms|s|m|h)", d.lower().strip())
        if not m:
            try: return int(d) * 1_000_000_000  # Default to seconds if just number
            except: return 0
        val, unit = int(m.group(1)), m.group(2)
        mult = {"ms": 10**6, "s": 10**9, "m": 60*10**9, "h": 3600*10**9}
        return val * mult.get(unit, 10**9)

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
            # Fix relative paths (re-use logic from app_service)
            host_path = v.host
            if host_path.startswith("./"):
                from services.app_service import DATA_DIR
                # Create app-specific folder
                host_path = v.host.replace("./", f"{DATA_DIR}/{req.name}/")

            # Ensure local folder exists
            os.makedirs(host_path, exist_ok=True)
            volumes[host_path] = {"bind": v.container, "mode": v.mode}

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
        "hostname": req.hostname,
    }

    if req.healthcheck and req.healthcheck.test:
        config["healthcheck"] = {
            "test": req.healthcheck.test,
            "interval": duration_to_ns(req.healthcheck.interval),
            "timeout": duration_to_ns(req.healthcheck.timeout),
            "retries": req.healthcheck.retries,
            "start_period": duration_to_ns(req.healthcheck.start_period),
        }

    if req.network and req.network != "bridge":
        config["network"] = req.network

    try:
        # Register app state immediately so Dashboard can show it
        app_id = f"custom_{req.name}"
        state = {
            "id": app_id,
            "name": req.name,
            "version": req.tag,
            "container_name": req.name,
            "status": "installing",
            "icon_url": req.icon_url,
            "is_custom": True,
            "config": config,
        }
        app_service.save_app_state(app_id, state)

        # Run installation in background
        def _do_install():
            try:
                docker_service.pull_image(full_image)
                container = docker_service.run_container(config)
                state["status"] = container["status"]
                state["container_id"] = container["full_id"]
                app_service.save_app_state(app_id, state)
            except Exception as e:
                state["status"] = "error"
                state["error"] = str(e)
                app_service.save_app_state(app_id, state)

        background_tasks.add_task(_do_install)
        return state
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
