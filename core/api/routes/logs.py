import asyncio
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException, Query
from services import docker_service

router = APIRouter()


@router.get("/{name_or_id}")
def get_logs(name_or_id: str, tail: int = Query(100, ge=1, le=2000)):
    try:
        logs = docker_service.get_logs(name_or_id, tail=tail)
        return {"container": name_or_id, "logs": logs}
    except Exception as e:
        raise HTTPException(500, str(e))


@router.websocket("/ws/{name_or_id}")
async def stream_logs(websocket: WebSocket, name_or_id: str):
    await websocket.accept()
    try:
        client = docker_service.get_client()
        container = client.containers.get(name_or_id)
        for line in container.logs(stream=True, follow=True, tail=50):
            await websocket.send_text(line.decode("utf-8", errors="replace"))
            await asyncio.sleep(0)
    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await websocket.send_text(f"[ERROR] {e}")
            await websocket.close()
        except Exception:
            pass
