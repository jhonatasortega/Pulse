from fastapi import APIRouter, HTTPException
from services import storage_service

router = APIRouter()


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
