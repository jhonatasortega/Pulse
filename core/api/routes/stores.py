from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import Optional
from services import store_registry, store_service

router = APIRouter()


class AddStoreRequest(BaseModel):
    id:   str
    name: str
    url:  str
    type: str = "zip"


class ToggleStoreRequest(BaseModel):
    enabled: bool


@router.get("/")
def list_stores():
    return store_registry.list_stores()


@router.post("/")
def add_store(req: AddStoreRequest):
    try:
        return store_registry.add_store(req.id, req.name, req.url, req.type)
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.delete("/{store_id}")
def remove_store(store_id: str):
    store_registry.remove_store(store_id)
    return {"ok": True}


@router.put("/{store_id}/toggle")
def toggle_store(store_id: str, req: ToggleStoreRequest):
    try:
        return store_registry.toggle_store(store_id, req.enabled)
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.post("/{store_id}/refresh")
def refresh_store(store_id: str, background_tasks: BackgroundTasks):
    background_tasks.add_task(store_service.refresh_store, store_id)
    return {"ok": True, "message": f"Refreshing store '{store_id}' in background"}


@router.post("/refresh-all")
def refresh_all(background_tasks: BackgroundTasks):
    background_tasks.add_task(store_service.refresh_store, None)
    return {"ok": True, "message": "Refreshing all stores in background"}
