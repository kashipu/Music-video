from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
import json

router = APIRouter()


class ConnectionManager:
    def __init__(self):
        # venue_id -> list of (websocket, user_id or None)
        self.active_connections: dict[int, list[tuple[WebSocket, int | None]]] = {}

    async def connect(self, websocket: WebSocket, venue_id: int, user_id: int | None = None):
        await websocket.accept()
        if venue_id not in self.active_connections:
            self.active_connections[venue_id] = []
        self.active_connections[venue_id].append((websocket, user_id))

    def disconnect(self, websocket: WebSocket, venue_id: int):
        if venue_id in self.active_connections:
            self.active_connections[venue_id] = [
                (ws, uid) for ws, uid in self.active_connections[venue_id] if ws != websocket
            ]

    async def broadcast(self, venue_id: int, message: dict):
        if venue_id not in self.active_connections:
            return
        data = json.dumps(message)
        disconnected = []
        for ws, uid in self.active_connections[venue_id]:
            try:
                await ws.send_text(data)
            except Exception:
                disconnected.append(ws)
        for ws in disconnected:
            self.disconnect(ws, venue_id)

    async def send_to_user(self, venue_id: int, user_id: int, message: dict):
        if venue_id not in self.active_connections:
            return
        data = json.dumps(message)
        disconnected = []
        for ws, uid in self.active_connections[venue_id]:
            if uid == user_id:
                try:
                    await ws.send_text(data)
                except Exception:
                    disconnected.append(ws)
        for ws in disconnected:
            self.disconnect(ws, venue_id)


manager = ConnectionManager()


@router.websocket("/ws/queue")
async def websocket_endpoint(
    websocket: WebSocket,
    venue: str = Query(...),
    user_id: int | None = Query(None),
):
    from app.database import get_db

    db = await get_db()
    rows = await db.execute_fetchall(
        "SELECT id FROM venues WHERE slug = ?", (venue,)
    )
    if not rows:
        await websocket.close(code=4004, reason="Venue not found")
        return

    venue_id = rows[0][0]
    await manager.connect(websocket, venue_id, user_id)

    try:
        while True:
            # Keep connection alive, receive pings
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, venue_id)
