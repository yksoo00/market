import os

os.environ.setdefault("INTERNAL_TOKEN", "test-token")  # settings 가 import 시점에 읽으므로 먼저

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402

client = TestClient(app)


def test_health_is_open() -> None:
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["ok"] is True


def test_other_paths_require_internal_token() -> None:
    res = client.post("/embed")
    assert res.status_code == 401
