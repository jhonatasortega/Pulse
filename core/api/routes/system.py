import platform
import docker
from fastapi import APIRouter, HTTPException
from services import docker_service

router = APIRouter()


@router.get("/info")
def system_info():
    try:
        client = docker_service.get_client()
        info = client.info()
        return {
            "docker": {
                "version": info.get("ServerVersion"),
                "containers": info.get("Containers"),
                "containers_running": info.get("ContainersRunning"),
                "containers_paused": info.get("ContainersPaused"),
                "containers_stopped": info.get("ContainersStopped"),
                "images": info.get("Images"),
                "os": info.get("OperatingSystem"),
                "architecture": info.get("Architecture"),
                "memory": info.get("MemTotal"),
            },
            "host": {
                "platform": platform.system(),
                "machine": platform.machine(),
                "python": platform.python_version(),
            },
        }
    except Exception as e:
        raise HTTPException(500, str(e))


@router.get("/networks")
def list_networks():
    try:
        client = docker_service.get_client()
        networks = client.networks.list()
        return [
            {
                "id": n.short_id,
                "name": n.name,
                "driver": n.attrs.get("Driver"),
                "scope": n.attrs.get("Scope"),
            }
            for n in networks
        ]
    except Exception as e:
        raise HTTPException(500, str(e))


@router.get("/images")
def list_images():
    try:
        client = docker_service.get_client()
        images = client.images.list()
        return [
            {
                "id": img.short_id,
                "tags": img.tags,
                "size": img.attrs.get("Size", 0),
                "created": img.attrs.get("Created", ""),
            }
            for img in images
        ]
    except Exception as e:
        raise HTTPException(500, str(e))
