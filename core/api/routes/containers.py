from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from services import docker_service

router = APIRouter()


class RecreateRequest(BaseModel):
    env: dict
    restart_policy: Optional[str] = None


@router.get("/")
def list_containers(all: bool = True):
    try:
        return docker_service.list_containers(all=all)
    except Exception as e:
        raise HTTPException(500, str(e))


@router.get("/{name_or_id}")
def get_container(name_or_id: str):
    try:
        c = docker_service.get_container(name_or_id)
        return docker_service.serialize_container(c)
    except Exception as e:
        raise HTTPException(404, str(e))


@router.post("/{name_or_id}/start")
def start_container(name_or_id: str):
    try:
        return docker_service.start_container(name_or_id)
    except Exception as e:
        raise HTTPException(500, str(e))


@router.post("/{name_or_id}/stop")
def stop_container(name_or_id: str):
    try:
        return docker_service.stop_container(name_or_id)
    except Exception as e:
        raise HTTPException(500, str(e))


@router.post("/{name_or_id}/restart")
def restart_container(name_or_id: str):
    try:
        return docker_service.restart_container(name_or_id)
    except Exception as e:
        raise HTTPException(500, str(e))


@router.delete("/{name_or_id}")
def remove_container(name_or_id: str, force: bool = False):
    try:
        return docker_service.remove_container(name_or_id, force=force)
    except Exception as e:
        raise HTTPException(500, str(e))


@router.get("/{name_or_id}/config")
def get_container_config(name_or_id: str):
    try:
        return docker_service.get_container_config(name_or_id)
    except Exception as e:
        raise HTTPException(404, str(e))


@router.put("/{name_or_id}/config")
def update_container_config(name_or_id: str, req: RecreateRequest):
    try:
        return docker_service.recreate_container(name_or_id, req.env, req.restart_policy)
    except Exception as e:
        raise HTTPException(500, str(e))
