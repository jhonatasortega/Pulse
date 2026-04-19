from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from services import storage_service, disk_service

router = APIRouter()


class MountRequest(BaseModel):
    uuid: str
    mountpoint: str
    fstype: str


@router.get("/")
def get_storage():
    try:
        return storage_service.get_storage_info()
    except Exception as e:
        raise HTTPException(500, str(e))


@router.get("/disks")
def get_disks():
    try:
        return storage_service.get_disks()
    except Exception as e:
        raise HTTPException(500, str(e))


@router.get("/volumes")
def get_volumes():
    try:
        return storage_service.get_docker_volumes()
    except Exception as e:
        raise HTTPException(500, str(e))


@router.post("/mount")
def mount_disk(req: MountRequest):
    try:
        return disk_service.mount_disk(req.uuid, req.mountpoint, req.fstype)
    except Exception as e:
        raise HTTPException(500, str(e))


@router.post("/unmount")
def unmount_disk(mountpoint: str):
    try:
        return disk_service.unmount_disk(mountpoint)
    except Exception as e:
        raise HTTPException(500, str(e))
