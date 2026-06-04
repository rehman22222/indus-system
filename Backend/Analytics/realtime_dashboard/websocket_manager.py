import asyncio
import json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from realtime_dashboard.live_stats import get_current_stats
from utils.logger import get_logger

logger = get_logger(__name__)
websocket_router = APIRouter()

class ConnectionManager:
    def __init__(self):
        self.active: list[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active.append(ws)
        logger.info(f"WS connected. Total: {len(self.active)}")

    def disconnect(self, ws: WebSocket):
        if ws in self.active:
            self.active.remove(ws)
        logger.info(f"WS disconnected. Total: {len(self.active)}")

    async def broadcast(self, data: dict):
        dead = []
        for ws in self.active:
            try:
                await ws.send_text(json.dumps(data))
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)


manager = ConnectionManager()


@websocket_router.websocket("/ws/live")
async def websocket_endpoint(ws: WebSocket):
    await manager.connect(ws)
    try:
        while True:
            stats = await get_current_stats()
            await ws.send_text(json.dumps({"type": "stats_update", "data": stats}))
            await asyncio.sleep(10)
    except WebSocketDisconnect:
        manager.disconnect(ws)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(ws)