import os
import random
import sqlite3

DB_PATH = os.environ.get("STARTUP_DB", os.path.join(os.path.dirname(__file__), "..", "startup.db"))


def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db(n_users: int = 2000, posts_per_user: int = 10, seed: int = 42) -> None:
    """Create and seed the database. Idempotent."""
    if os.path.exists(DB_PATH):
        os.remove(DB_PATH)
    conn = get_conn()
    cur = conn.cursor()
    cur.executescript(
        """
        CREATE TABLE users (
            id INTEGER PRIMARY KEY,
            handle TEXT NOT NULL,
            plan TEXT NOT NULL
        );
        CREATE TABLE posts (
            id INTEGER PRIMARY KEY,
            user_id INTEGER NOT NULL,
            body TEXT NOT NULL,
            created_at INTEGER NOT NULL
        );
        CREATE TABLE likes (
            id INTEGER PRIMARY KEY,
            post_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL
        );
        """
    )
    rng = random.Random(seed)
    plans = ["free", "free", "free", "pro"]
    users = [(i, f"founder_{i}", rng.choice(plans)) for i in range(1, n_users + 1)]
    cur.executemany("INSERT INTO users VALUES (?, ?, ?)", users)

    posts = []
    pid = 1
    for uid in range(1, n_users + 1):
        for _ in range(posts_per_user):
            posts.append((pid, uid, f"post {pid} by {uid}: we are so back", rng.randint(1, 1_000_000)))
            pid += 1
    cur.executemany("INSERT INTO posts VALUES (?, ?, ?, ?)", posts)

    likes = []
    lid = 1
    for p in posts:
        for _ in range(rng.randint(0, 6)):
            likes.append((lid, p[0], rng.randint(1, n_users)))
            lid += 1
    cur.executemany("INSERT INTO likes VALUES (?, ?, ?)", likes)
    conn.commit()
    conn.close()
