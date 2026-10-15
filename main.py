from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pathlib import Path
import json

from database import init_db, save_message, get_messages

# ==================== تنظیمات ====================

ADMIN_NAME = "Arian"

ROOMS = {
    "info":  {"name": "اطلاع‌رسانی زنگ تفریح", "type": "admin"},
    "news":  {"name": "اخبار مدرسه",         "type": "admin"},
    "grade": {"name": "پایه نهم",            "type": "public"},
    "901":   {"name": "کلاس ۹۰۱",            "type": "class", "classId": "901"},
    "902":   {"name": "کلاس ۹۰۲",            "type": "class", "classId": "902"},
    "903":   {"name": "کلاس ۹۰۳",            "type": "class", "classId": "903"},
}

# ==================== اپ ====================

app = FastAPI(title="زنگ تفریح API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

init_db()

# ==================== مدیریت اتصال‌ها ====================

class ConnectionManager:
    def __init__(self):
        self.active: dict[str, list] = {}

    async def connect(self, ws, room_id, user, class_id):
        await ws.accept()
        self.active.setdefault(room_id, []).append(
            {"ws": ws, "user": user, "classId": class_id}
        )

    def disconnect(self, ws, room_id):
        if room_id in self.active:
            self.active[room_id] = [c for c in self.active[room_id] if c["ws"] != ws]
            if not self.active[room_id]:
                del self.active[room_id]

    async def broadcast(self, room_id, message):
        if room_id not in self.active:
            return
        dead = []
        for conn in self.active[room_id]:
            try:
                await conn["ws"].send_json(message)
            except Exception:
                dead.append(conn)
        for d in dead:
            self.active[room_id].remove(d)


manager = ConnectionManager()

# ==================== اجازه‌دهی ====================

def can_access_room(room_id, user, class_id):
    room = ROOMS.get(room_id)
    if not room:
        return False
    if room["type"] == "class":
        return room["classId"] == class_id
    return True


def can_write(room_id, user):
    room = ROOMS.get(room_id)
    if not room:
        return False
    if room["type"] == "admin":
        return user.lower() == ADMIN_NAME.lower()
    return True

# ==================== WebSocket ====================

@app.websocket("/ws/{room_id}")
async def websocket_endpoint(ws: WebSocket, room_id: str, user: str, class_id: str):
    if not can_access_room(room_id, user, class_id):
        await ws.close(code=4003, reason="دسترسی نداری")
        return

    await manager.connect(ws, room_id, user, class_id)

    await ws.send_json({
        "type": "history",
        "messages": get_messages(room_id),
    })

    try:
        while True:
            data = await ws.receive_text()
            payload = json.loads(data)
            text = payload.get("text", "").strip()
            if not text:
                continue

            if not can_write(room_id, user):
                await ws.send_json({
                    "type": "error",
                    "message": "فقط ادمین می‌تونه اینجا پیام بذاره",
                })
                continue

            msg = save_message(room_id, user, class_id, text)
            await manager.broadcast(room_id, {"type": "message", "message": msg})

    except WebSocketDisconnect:
        manager.disconnect(ws, room_id)

# ==================== REST ====================

@app.get("/api/rooms")
def api_rooms():
    return ROOMS


@app.get("/api/messages/{room_id}")
def api_messages(room_id: str, limit: int = 100):
    return get_messages(room_id, limit)


@app.get("/api/health")
def health():
    return {"status": "ok"}

# ==================== فایل‌های استاتیک ====================

STATIC_DIR = Path(__file__).parent / "static"

app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


@app.get("/")
def root():
    return FileResponse(str(STATIC_DIR / "index.html"))