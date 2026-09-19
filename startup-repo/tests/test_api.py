import os
import tempfile

import pytest
from fastapi.testclient import TestClient

os.environ["STARTUP_DB"] = os.path.join(tempfile.gettempdir(), "runway_test_api.db")

from backend import database  # noqa: E402
from backend.main import app  # noqa: E402


@pytest.fixture(scope="module")
def client():
    database.DB_PATH = os.environ["STARTUP_DB"]
    database.init_db(n_users=100, posts_per_user=3)
    with TestClient(app) as c:
        yield c


def test_health(client):
    assert client.get("/health").json() == {"ok": True}


def test_feed_endpoint(client):
    r = client.get("/feed?limit=5")
    assert r.status_code == 200
    assert len(r.json()) == 5


def test_feed_limit_validation(client):
    assert client.get("/feed?limit=0").status_code == 400
    assert client.get("/feed?limit=9999").status_code == 400


def test_user_lookup(client):
    assert client.get("/users/1").json()["handle"] == "founder_1"
    assert client.get("/users/999999").status_code == 404
