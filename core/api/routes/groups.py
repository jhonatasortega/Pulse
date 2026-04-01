from fastapi import APIRouter, HTTPException
from services import group_service

router = APIRouter()


@router.get("/")
def list_groups():
    try:
        return group_service.list_groups()
    except Exception as e:
        raise HTTPException(500, str(e))


@router.post("/{project}/start")
def start_group(project: str):
    try:
        return group_service.group_action(project, "start")
    except ValueError as e:
        raise HTTPException(404, str(e))
    except Exception as e:
        raise HTTPException(500, str(e))


@router.post("/{project}/stop")
def stop_group(project: str):
    try:
        return group_service.group_action(project, "stop")
    except ValueError as e:
        raise HTTPException(404, str(e))
    except Exception as e:
        raise HTTPException(500, str(e))


@router.post("/{project}/restart")
def restart_group(project: str):
    try:
        return group_service.group_action(project, "restart")
    except ValueError as e:
        raise HTTPException(404, str(e))
    except Exception as e:
        raise HTTPException(500, str(e))
