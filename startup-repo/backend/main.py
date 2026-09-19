from fastapi import FastAPI, HTTPException

from .database import get_conn, init_db
from .feed import get_feed

app = FastAPI(title="Definitely Not A Ponzi Scheme API")


@app.on_event("startup")
def _startup() -> None:
    init_db()


@app.get("/health")
def health() -> dict:
    return {"ok": True}


@app.get("/feed")
def feed(limit: int = 50) -> list[dict]:
    if limit < 1 or limit > 200:
        raise HTTPException(400, "limit must be 1..200")
    return get_feed(limit)


@app.get("/users/{user_id}")
def user(user_id: int) -> dict:
    conn = get_conn()
    row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(404, "no such user")
    return dict(row)
