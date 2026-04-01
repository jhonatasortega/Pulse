from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel
from typing import Optional
from services import user_service
from api.auth import require_admin

router = APIRouter()


class CreateUserRequest(BaseModel):
    username: str
    password: str
    role: str = "viewer"


class UpdateUserRequest(BaseModel):
    password: Optional[str] = None
    role: Optional[str] = None


@router.get("/")
def list_users(_=Depends(require_admin)):
    return user_service.list_users()


@router.post("/")
def create_user(req: CreateUserRequest, _=Depends(require_admin)):
    try:
        return user_service.create_user(req.username, req.password, req.role)
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.put("/{username}")
def update_user(username: str, req: UpdateUserRequest, _=Depends(require_admin)):
    try:
        return user_service.update_user(username, req.password, req.role)
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.delete("/{username}")
def delete_user(username: str, _=Depends(require_admin)):
    try:
        user_service.delete_user(username)
        return {"ok": True}
    except ValueError as e:
        raise HTTPException(400, str(e))
