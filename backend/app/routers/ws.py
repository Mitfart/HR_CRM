"""
WebSocket endpoint для real-time обновлений карточки заявки в CRM.

Подключение: ws://host/ws/applications/{application_id}
"""
import json
import logging
from collections import defaultdict

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter()
log = logging.getLogger(__name__)

# application_id → список активных WebSocket-соединений
_connections: dict[str, list[WebSocket]] = defaultdict(list)


@router.websocket("/applications/{application_id}")
async def ws_application(websocket: WebSocket, application_id: str):
    await websocket.accept()
    _connections[application_id].append(websocket)
    log.info("WS connected: application=%s total=%d", application_id, len(_connections[application_id]))
    try:
        while True:
            # Держим соединение открытым; клиент может слать ping
            await websocket.receive_text()
    except WebSocketDisconnect:
        _connections[application_id].remove(websocket)
        log.info("WS disconnected: application=%s", application_id)


async def notify_application(application_id: str, payload: dict) -> None:
    """Рассылает событие всем подключённым CRM-клиентам по этой заявке."""
    dead: list[WebSocket] = []
    for ws in _connections.get(application_id, []):
        try:
            await ws.send_text(json.dumps(payload, ensure_ascii=False))
        except Exception:
            dead.append(ws)
    for ws in dead:
        _connections[application_id].remove(ws)
