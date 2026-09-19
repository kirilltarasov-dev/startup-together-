import os
import tempfile

import pytest

os.environ["STARTUP_DB"] = os.path.join(tempfile.gettempdir(), "runway_test.db")

from backend import database  # noqa: E402
from backend.feed import get_feed  # noqa: E402


@pytest.fixture(scope="module", autouse=True)
def seeded_db():
    database.DB_PATH = os.environ["STARTUP_DB"]
    database.init_db(n_users=200, posts_per_user=5)
    yield


def test_feed_returns_limit():
    assert len(get_feed(10)) == 10
    assert len(get_feed(50)) == 50


def test_feed_sorted_newest_first():
    feed = get_feed(50)
    created = [p["created_at"] for p in feed]
    assert created == sorted(created, reverse=True)


def test_feed_item_shape():
    item = get_feed(1)[0]
    assert set(item) == {"id", "body", "created_at", "author", "likes", "pro_likes"}
    assert set(item["author"]) == {"id", "handle", "plan"}
    assert item["author"]["plan"] in {"free", "pro"}


def test_like_counts_match_database():
    conn = database.get_conn()
    for item in get_feed(20):
        likes = conn.execute("SELECT user_id FROM likes WHERE post_id = ?", (item["id"],)).fetchall()
        assert item["likes"] == len(likes)
        pro = 0
        for like in likes:
            plan = conn.execute("SELECT plan FROM users WHERE id = ?", (like["user_id"],)).fetchone()["plan"]
            pro += plan == "pro"
        assert item["pro_likes"] == pro
    conn.close()


def test_author_matches_post():
    conn = database.get_conn()
    for item in get_feed(20):
        uid = conn.execute("SELECT user_id FROM posts WHERE id = ?", (item["id"],)).fetchone()["user_id"]
        assert item["author"]["id"] == uid
    conn.close()
