from __future__ import annotations

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter(prefix='/api/ws', tags=['ws'])


class ConnectionManager:
    def __init__(self) -> None:
        self.active: list[WebSocket] = []

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active.append(websocket)

    def disconnect(self, websocket: WebSocket) -> None:
        if websocket in self.active:
            self.active.remove(websocket)

    async def broadcast(self, message: dict) -> None:
        for websocket in list(self.active):
            await websocket.send_json(message)


manager = ConnectionManager()


@router.websocket('/status')
async def agent_status_ws(websocket: WebSocket) -> None:
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
