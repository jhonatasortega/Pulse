import asyncio
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException
from services import metrics_service

router = APIRouter()


@router.get("/system")
def system_metrics():
    try:
        return metrics_service.get_system_metrics()
    except Exception as e:
        raise HTTPException(500, str(e))


@router.get("/container/{name_or_id}")
def container_stats(name_or_id: str):
    try:
        return metrics_service.get_container_stats(name_or_id)
    except Exception as e:
        raise HTTPException(500, str(e))


@router.websocket("/ws")
async def metrics_ws(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            data = metrics_service.get_system_metrics()
            await websocket.send_json(data)
            await asyncio.sleep(2)
    except WebSocketDisconnect:
        pass
    except Exception as e:
        await websocket.close()
