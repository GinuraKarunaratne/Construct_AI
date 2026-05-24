from fastapi.testclient import TestClient
from unittest.mock import MagicMock, patch

from app.main import app
from app.core.deps import get_db

client = TestClient(app)


def test_health_check_db_connected():
    mock_db = MagicMock()
    mock_db.execute.return_value = None

    app.dependency_overrides[get_db] = lambda: mock_db

    response = client.get("/api/v1/health")

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["database"] == "connected"

    app.dependency_overrides.clear()
