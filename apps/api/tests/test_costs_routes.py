"""
Tests — Costs Routes
=====================
Tests for budget items, expenses, predictions, and CSV export endpoints.
All DB calls are mocked so no running database is needed.
"""
import pytest
from datetime import date
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient

from app.main import app
from app.core.deps import get_db, get_current_user_id
from app.models.user import User as UserModel


client = TestClient(app)

# ── Common test fixtures ───────────────────────────────────────────────────────

def _override_auth(user_id: int = 1):
    """Inject a fake authenticated user so auth middleware is bypassed."""
    app.dependency_overrides[get_current_user_id] = lambda: user_id


def _clear_overrides():
    app.dependency_overrides.clear()


def _make_admin_user(user_id: int = 1) -> MagicMock:
    """Return a mock User with admin role so project access checks are bypassed."""
    u = MagicMock(spec=UserModel)
    u.id = user_id
    u.role = "admin"   # ROLE_RANK 4 — bypasses all project membership checks
    u.is_active = True
    return u


def _mock_db(user_id: int = 1):
    """
    Return a mock SQLAlchemy session.
    db.get(UserModel, user_id) returns an admin user so that
    assert_project_access() passes without a real DB.
    All other db.get() calls return None (simulating empty DB).
    """
    admin_user = _make_admin_user(user_id)
    db = MagicMock()
    db.execute.return_value = MagicMock(
        scalars=MagicMock(return_value=MagicMock(
            all=MagicMock(return_value=[]),
            first=MagicMock(return_value=None),
        ))
    )

    def _get_side_effect(model, pk):
        if model is UserModel:
            return admin_user
        return None

    db.get = MagicMock(side_effect=_get_side_effect)
    return db


# ── Budget items ────────────────────────────────────────────────────────────────

class TestBudgetItemsRoute:

    def setup_method(self):
        _override_auth(1)

    def teardown_method(self):
        _clear_overrides()

    def test_list_budget_items_empty(self):
        """GET budget-items with empty DB returns 200 and empty list."""
        db = _mock_db()
        app.dependency_overrides[get_db] = lambda: db
        resp = client.get("/api/v1/projects/1/budget-items")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_create_budget_item_negative_amount_rejected(self):
        """Negative estimated_amount must be rejected with 400."""
        db = _mock_db()
        app.dependency_overrides[get_db] = lambda: db
        resp = client.post(
            "/api/v1/projects/1/budget-items",
            json={"category": "Materials", "estimated_amount": -100},
        )
        assert resp.status_code == 400

    def test_create_budget_item_missing_fields(self):
        """Missing required fields must return 422."""
        db = _mock_db()
        app.dependency_overrides[get_db] = lambda: db
        resp = client.post("/api/v1/projects/1/budget-items", json={})
        assert resp.status_code == 422


# ── Expenses ────────────────────────────────────────────────────────────────────

class TestExpensesRoute:

    def setup_method(self):
        _override_auth(1)

    def teardown_method(self):
        _clear_overrides()

    def test_list_expenses_empty(self):
        db = _mock_db()
        app.dependency_overrides[get_db] = lambda: db
        resp = client.get("/api/v1/projects/1/expenses")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_create_expense_zero_amount_rejected(self):
        """Amount of 0 must be rejected (must be positive)."""
        db = _mock_db()
        app.dependency_overrides[get_db] = lambda: db
        resp = client.post(
            "/api/v1/projects/1/expenses",
            json={
                "category": "Materials",
                "amount": 0,
                "expense_date": str(date.today()),
            },
        )
        assert resp.status_code == 400

    def test_create_expense_future_date_rejected(self):
        """Expense date in the future must be rejected with 400."""
        db = _mock_db()
        app.dependency_overrides[get_db] = lambda: db
        resp = client.post(
            "/api/v1/projects/1/expenses",
            json={
                "category": "Labour",
                "amount": 5000.00,
                "expense_date": "2099-01-01",
            },
        )
        assert resp.status_code == 400

    def test_delete_nonexistent_expense_returns_404(self):
        """Deleting an expense that doesn't exist must return 404."""
        db = _mock_db()
        db.get.return_value = None   # simulate "not found"
        app.dependency_overrides[get_db] = lambda: db
        resp = client.delete("/api/v1/expenses/99999")
        assert resp.status_code == 404


# ── Predictions ──────────────────────────────────────────────────────────────────

class TestPredictionsRoute:

    def setup_method(self):
        _override_auth(1)

    def teardown_method(self):
        _clear_overrides()

    def test_latest_prediction_returns_none_when_empty(self):
        """GET latest prediction returns null when no predictions exist."""
        db = _mock_db()
        app.dependency_overrides[get_db] = lambda: db
        resp = client.get("/api/v1/projects/1/cost-predictions/latest")
        assert resp.status_code == 200
        assert resp.json() is None

    def test_prediction_history_empty(self):
        db = _mock_db()
        app.dependency_overrides[get_db] = lambda: db
        resp = client.get("/api/v1/projects/1/cost-predictions/history")
        assert resp.status_code == 200
        assert resp.json() == []


# ── CSV Export ───────────────────────────────────────────────────────────────────

class TestCsvExport:

    def setup_method(self):
        _override_auth(1)

    def teardown_method(self):
        _clear_overrides()

    def test_csv_export_returns_csv_content_type(self):
        """CSV export endpoint must respond with text/csv content type."""
        db = _mock_db()
        app.dependency_overrides[get_db] = lambda: db

        # Mock get_cost_summary
        with patch("app.routes.v1.costs.get_cost_summary", return_value={
            "total_budget": 1_000_000,
            "actual_cost_to_date": 400_000,
            "material_cost": 200_000,
            "labour_cost": 150_000,
            "other_cost": 50_000,
            "remaining_budget": 600_000,
            "budget_used_pct": 40.0,
        }):
            resp = client.get("/api/v1/projects/1/reports/expenses.csv")

        assert resp.status_code == 200
        assert "text/csv" in resp.headers.get("content-type", "")

    def test_csv_export_has_header_row(self):
        """CSV file must contain at least a header row."""
        db = _mock_db()
        app.dependency_overrides[get_db] = lambda: db

        with patch("app.routes.v1.costs.get_cost_summary", return_value={
            "total_budget": 0, "actual_cost_to_date": 0, "material_cost": 0,
            "labour_cost": 0, "other_cost": 0, "remaining_budget": 0, "budget_used_pct": 0,
        }):
            resp = client.get("/api/v1/projects/1/reports/expenses.csv")

        content = resp.content.decode("utf-8")
        assert "ID" in content or "Date" in content or "Category" in content


# ── ML model info endpoint ───────────────────────────────────────────────────────

class TestModelInfoRoute:

    def test_model_info_endpoint_responds(self):
        """GET /ml/model-info must respond (either 200 or 503 if not trained)."""
        resp = client.get("/api/v1/ml/model-info")
        assert resp.status_code in (200, 503)

    def test_model_info_503_has_helpful_message(self):
        """If model not trained, 503 body should contain instructions."""
        with patch("app.services.ml_service.get_model_info", return_value={"status": "model_not_trained"}):
            resp = client.get("/api/v1/ml/model-info")
        if resp.status_code == 503:
            assert "detail" in resp.json()
