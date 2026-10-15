import os
import sqlite3
from datetime import datetime

# تو Render فایل دیتابیس تو مسیر پروژه ذخیره می‌شه
DB_PATH = os.path.join(os.path.dirname(__file__), "zang_tafrih.db")


def init_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("""
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            room_id TEXT NOT NULL,
            author TEXT NOT NULL,
            author_class TEXT NOT NULL,
            text TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
    """)
    c.execute("CREATE INDEX IF NOT EXISTS idx_room ON messages(room_id)")
    conn.commit()
    conn.close()


def save_message(room_id, author, author_class, text):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    created_at = datetime.utcnow().isoformat(timespec="seconds")
    c.execute(
        "INSERT INTO messages (room_id, author, author_class, text, created_at) "
        "VALUES (?, ?, ?, ?, ?)",
        (room_id, author, author_class, text, created_at),
    )
    conn.commit()
    msg_id = c.lastrowid
    conn.close()
    return {
        "id": msg_id,
        "room_id": room_id,
        "author": author,
        "author_class": author_class,
        "text": text,
        "created_at": created_at,
    }


def get_messages(room_id, limit=100):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute(
        "SELECT id, room_id, author, author_class, text, created_at "
        "FROM messages WHERE room_id = ? ORDER BY id DESC LIMIT ?",
        (room_id, limit),
    )
    rows = c.fetchall()[::-1]
    conn.close()
    return [
        {
            "id": r[0],
            "room_id": r[1],
            "author": r[2],
            "author_class": r[3],
            "text": r[4],
            "created_at": r[5],
        }
        for r in rows
    ]