"""
Tests — ML Prediction Service
==============================
Covers: feature vector construction, EVM fallback, model info endpoint.
These tests are self-contained and do NOT require a DB or a trained model file.
"""
import pytest
import numpy as np

from app.services.ml_service import (
    build_feature_vector,
    _evm_fallback,
    _project_type_code,
    predict,
    get_model_info,
)


FEATURE_COLS = [
    "project_type", "budget", "planned_duration_days", "worker_count",
    "task_count", "location_type", "has_subcontractors",
    "snapshot_progress_pct", "actual_cost_at_snapshot", "cpi", "spi",
    "delayed_task_count", "delayed_task_ratio", "labour_ratio",
    "material_ratio", "months_elapsed", "budget_used_pct",
    "schedule_efficiency",
]
N_FEATURES = len(FEATURE_COLS)


class TestBuildFeatureVector:
    """Unit tests for build_feature_vector()."""

    def _default_kwargs(self, **overrides) -> dict:
        base = dict(
            budget=10_000_000,
            planned_duration_days=120,
            worker_count=20,
            task_count=15,
            snapshot_progress_pct=50.0,
            actual_cost_at_snapshot=4_500_000,
            delayed_task_count=3,
            labour_cost=3_000_000,
            material_cost=5_000_000,
            months_elapsed=4,
            planned_progress_pct=50.0,
        )
        base.update(overrides)
        return base

    def test_output_shape(self):
        """Feature vector must have exactly N_FEATURES columns."""
        X = build_feature_vector(**self._default_kwargs())
        assert X.shape == (1, N_FEATURES), f"Expected shape (1, {N_FEATURES}), got {X.shape}"

    def test_cpi_on_budget(self):
        """When actual cost == planned spend, CPI ≈ 1.0."""
        budget = 10_000_000
        progress = 50.0
        actual = budget * (progress / 100)   # exactly on budget
        X = build_feature_vector(**self._default_kwargs(
            budget=budget,
            snapshot_progress_pct=progress,
            actual_cost_at_snapshot=actual,
        ))
        cpi = float(X[0, FEATURE_COLS.index("cpi")])
        assert abs(cpi - 1.0) < 0.01, f"CPI should be ~1.0 when on-budget, got {cpi}"

    def test_cpi_over_spend(self):
        """When actual cost > earned value, CPI < 1 (over-spending)."""
        budget = 10_000_000
        progress = 50.0
        actual = budget * (progress / 100) * 1.5   # 50% over-spend
        X = build_feature_vector(**self._default_kwargs(
            budget=budget,
            snapshot_progress_pct=progress,
            actual_cost_at_snapshot=actual,
        ))
        cpi = float(X[0, FEATURE_COLS.index("cpi")])
        assert cpi < 1.0, f"Over-spending should give CPI<1, got {cpi}"

    def test_delayed_task_ratio_clamped(self):
        """delayed_task_ratio must be in [0, 1]."""
        X = build_feature_vector(**self._default_kwargs(
            delayed_task_count=100,   # more delayed tasks than total
            task_count=10,
        ))
        ratio = float(X[0, FEATURE_COLS.index("delayed_task_ratio")])
        assert 0.0 <= ratio <= 1.0

    def test_zero_budget_does_not_crash(self):
        """Budget of 0 must not raise; function clamps to 1.0 internally."""
        X = build_feature_vector(**self._default_kwargs(budget=0))
        assert X.shape == (1, N_FEATURES)
        assert not np.any(np.isnan(X))

    def test_all_features_finite(self):
        """No feature value should be NaN or ±inf."""
        X = build_feature_vector(**self._default_kwargs())
        assert np.all(np.isfinite(X)), f"Non-finite values in feature vector: {X}"

    def test_project_type_residential(self):
        """Small budget resolves to residential (0) when no explicit type."""
        pt = _project_type_code(5_000_000, None)
        assert pt == 0

    def test_project_type_infrastructure(self):
        """Large budget resolves to infrastructure (2) when no explicit type."""
        pt = _project_type_code(500_000_000, None)
        assert pt == 2

    def test_project_type_explicit_overrides_budget(self):
        """Explicit project_type_str must override budget heuristic."""
        pt = _project_type_code(500_000_000, "residential")
        assert pt == 0


class TestEvmFallback:
    """Unit tests for _evm_fallback()."""

    def test_on_budget_gives_zero_overrun(self):
        """When actual == earned value (CPI=1), overrun should be ~0%."""
        budget = 10_000_000
        result = _evm_fallback(
            budget=budget,
            actual_cost=budget * 0.5,  # 50% spent, 50% progress → CPI=1
            progress_pct=50.0,
            delayed_count=0,
            task_count=10,
        )
        # EVM: EAC = BAC/CPI = budget/1 → overrun = 0
        assert abs(result["overrun_pct"]) < 1.0, (
            f"Expected ~0% overrun for on-budget project, got {result['overrun_pct']}"
        )

    def test_over_spend_gives_positive_overrun(self):
        """CPI < 1 must yield a positive overrun_pct."""
        budget = 10_000_000
        actual = budget * 0.7   # 70% of budget spent at only 50% progress → CPI≈0.71
        result = _evm_fallback(
            budget=budget,
            actual_cost=actual,
            progress_pct=50.0,
            delayed_count=0,
            task_count=10,
        )
        assert result["overrun_pct"] > 0.0

    def test_result_keys_present(self):
        """EVM fallback must return the expected keys."""
        result = _evm_fallback(
            budget=5_000_000, actual_cost=2_000_000,
            progress_pct=40.0, delayed_count=2, task_count=10,
        )
        for key in ["overrun_pct", "predicted_final_cost", "confidence_score", "cpi", "method"]:
            assert key in result, f"Missing key: {key}"

    def test_method_is_evm_fallback(self):
        result = _evm_fallback(
            budget=1_000_000, actual_cost=500_000,
            progress_pct=50.0, delayed_count=0, task_count=5,
        )
        assert result["method"] == "evm_fallback"

    def test_confidence_is_low(self):
        """Fallback confidence should be ≤ 55 (it's rule-based, less reliable)."""
        result = _evm_fallback(
            budget=1_000_000, actual_cost=500_000,
            progress_pct=50.0, delayed_count=0, task_count=5,
        )
        assert result["confidence_score"] <= 55


class TestPredictFunction:
    """Tests for predict() — uses EVM fallback when model file is absent."""

    def _default_args(self, **overrides) -> dict:
        base = dict(
            budget=10_000_000,
            planned_duration_days=180,
            worker_count=25,
            task_count=20,
            snapshot_progress_pct=60.0,
            actual_cost_at_snapshot=5_500_000,
            delayed_task_count=2,
            labour_cost=3_000_000,
            material_cost=5_000_000,
            months_elapsed=6,
            planned_progress_pct=60.0,
        )
        base.update(overrides)
        return base

    def test_returns_required_keys(self):
        result = predict(**self._default_args())
        for key in ["overrun_pct", "predicted_final_cost", "confidence_score", "method"]:
            assert key in result

    def test_overrun_pct_range(self):
        """overrun_pct must be within the clipped range [-20, 200]."""
        result = predict(**self._default_args())
        assert -20.0 <= result["overrun_pct"] <= 200.0

    def test_very_low_progress_uses_fallback(self):
        """Less than 5% progress should trigger EVM fallback."""
        result = predict(**self._default_args(snapshot_progress_pct=2.0))
        assert result["method"] == "evm_fallback"

    def test_predicted_cost_positive(self):
        """Predicted final cost must always be positive."""
        result = predict(**self._default_args())
        assert result["predicted_final_cost"] > 0


class TestGetModelInfo:
    """Tests for get_model_info()."""

    def test_returns_dict(self):
        info = get_model_info()
        assert isinstance(info, dict)

    def test_has_status_key(self):
        info = get_model_info()
        assert "status" in info
