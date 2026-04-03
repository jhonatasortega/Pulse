from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from starlette.requests import HTTPConnection
from services import user_service
from api.auth import require_admin, verify_key

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


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


@router.post("/{username}/change-password")
def change_password(username: str, req: ChangePasswordRequest, conn: HTTPConnection = Depends(verify_key)):
    """Any authenticated user can change their own password."""
    caller = conn.headers.get("x-pulse-user") or conn.query_params.get("user", "")
    if caller != username:
        raise HTTPException(403, "You can only change your own password")
    user = user_service.verify_password(username, req.current_password)
    if not user:
        raise HTTPException(400, "Senha atual incorreta")
    if len(req.new_password) < 8:
        raise HTTPException(400, "Nova senha deve ter mínimo 8 caracteres")
    try:
        user_service.update_user(username, password=req.new_password)
        return {"ok": True}
    except ValueError as e:
        raise HTTPException(400, str(e))
