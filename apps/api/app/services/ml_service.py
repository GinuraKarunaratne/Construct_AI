"""
ConstructAI — ML Prediction Service
=====================================

Loads the trained GradientBoosting model (cost_model.joblib) and uses it to
predict final cost overrun % for a live project from its current snapshot.

Feature engineering mirrors EXACTLY what was used in train_model.py so that the
model receives correctly-structured input at inference time.

Feature vector (18 columns, same order as FEATURE_COLS in train_model.py):
  project_type, budget, planned_duration_days, worker_count, task_count,
  location_type, has_subcontractors, snapshot_progress_pct,
  actual_cost_at_snapshot, cpi, spi, delayed_task_count, delayed_task_ratio,
  labour_ratio, material_ratio, months_elapsed, budget_used_pct,
  schedule_efficiency

Confidence mapping:
  Model CV R² = 0.9129  →  confidence = clip(R² * 100 * 0.93, 0, 88)
  The 0.93 discount acknowledges synthetic training data vs. real projects.
  Falls back to rule-based EVM estimate when model file is absent.
"""

import os
import json
import logging
import math
from datetime import date
from typing import Optional

import numpy as np

logger = logging.getLogger(__name__)

# ── Paths ──────────────────────────────────────────────────────────────────────
_BASE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
_MODEL_PATH = os.path.join(_BASE, "models", "cost_model.joblib")
_META_PATH  = os.path.join(_BASE, "models", "model_metadata.json")

# ── Lazy-loaded singletons ─────────────────────────────────────────────────────
_model = None
_meta: dict = {}


def _load() -> bool:
    """Load model + metadata once. Returns True if model is ready."""
    global _model, _meta

    if _model is not None:
        return True

    try:
        import joblib  # type: ignore
        _model = joblib.load(_MODEL_PATH)
        logger.info("ML model loaded: %s", _MODEL_PATH)
    except Exception as exc:
        logger.warning("ML model not available (%s) — using EVM fallback", exc)
        _model = None

    if os.path.exists(_META_PATH):
        try:
            with open(_META_PATH) as f:
                _meta = json.load(f)
        except Exception:
            _meta = {}

    return _model is not None


def _project_type_code(budget: float, project_type_str: str | None = None) -> int:
    """
    Map project_type string to integer code (matches training data encoding).
    Falls back to budget-based heuristic only if no explicit type is set.
    """
    if project_type_str:
        return {"residential": 0, "commercial": 1, "infrastructure": 2}.get(
            project_type_str.lower(), 1
        )
    # Budget-based fallback
    if budget <= 25_000_000:
        return 0
    elif budget <= 150_000_000:
        return 1
    return 2


def build_feature_vector(
    *,
    budget: float,
    planned_duration_days: int,
    worker_count: int,
    task_count: int,
    snapshot_progress_pct: float,
    actual_cost_at_snapshot: float,
    delayed_task_count: int,
    labour_cost: float,
    material_cost: float,
    months_elapsed: int,
    has_subcontractors: int = 0,
    location_type: int = 0,        # 0=urban, 1=suburban, 2=rural
    planned_progress_pct: float = 0.0,
    project_type_str: str | None = None,
) -> np.ndarray:
    """
    Construct the 18-element feature vector expected by the trained model.
    All arguments should be derived from live project + task data.
    """
    budget = max(budget, 1.0)

    # ── Cost Performance Index (EV / AC) ───────────────────────────────────────
    # EV = budget * (snapshot_progress / 100)
    earned_value = budget * (snapshot_progress_pct / 100.0)
    ac = max(actual_cost_at_snapshot, 1.0)
    cpi = np.clip(earned_value / ac, 0.3, 2.0)

    # ── Schedule Performance Index (actual_progress / planned_progress) ────────
    planned_pct = max(planned_progress_pct, 1.0)
    spi = np.clip(snapshot_progress_pct / planned_pct, 0.3, 2.0)

    # ── Derived ratios ─────────────────────────────────────────────────────────
    task_count_safe = max(task_count, 1)
    delayed_task_ratio = np.clip(delayed_task_count / task_count_safe, 0.0, 1.0)
    labour_ratio = np.clip(labour_cost / budget, 0.0, 1.0)
    material_ratio = np.clip(material_cost / budget, 0.0, 1.0)
    budget_used_pct = (actual_cost_at_snapshot / budget) * 100.0
    months_elapsed_safe = max(months_elapsed, 1)
    schedule_efficiency = snapshot_progress_pct / months_elapsed_safe

    project_type = _project_type_code(budget, project_type_str)

    # Order MUST match FEATURE_COLS in train_model.py
    return np.array([[
        project_type,            # 0
        budget,                  # 1
        planned_duration_days,   # 2
        worker_count,            # 3
        task_count,              # 4
        location_type,           # 5
        has_subcontractors,      # 6
        snapshot_progress_pct,   # 7
        actual_cost_at_snapshot, # 8
        cpi,                     # 9  ← primary predictor
        spi,                     # 10 ← secondary predictor
        delayed_task_count,      # 11
        delayed_task_ratio,      # 12
        labour_ratio,            # 13
        material_ratio,          # 14
        months_elapsed,          # 15
        budget_used_pct,         # 16
        schedule_efficiency,     # 17
    ]], dtype=float)


def _evm_fallback(
    budget: float,
    actual_cost: float,
    progress_pct: float,
    delayed_count: int,
    task_count: int,
) -> dict:
    """
    Earned Value Management rule-based fallback when the model is not loaded.
    EAC = BAC / CPI  →  overrun_pct = (1/CPI - 1) * 100
    Source: PMBOK Guide 7th edition.
    """
    budget = max(budget, 1.0)
    earned_value = budget * (progress_pct / 100.0)
    cpi = earned_value / max(actual_cost, 1.0)
    cpi = max(cpi, 0.3)

    overrun_pct = (1.0 / cpi - 1.0) * 100.0
    delay_ratio = delayed_count / max(task_count, 1)
    overrun_pct += delay_ratio * 30.0  # Love et al. 2015

    overrun_pct = float(np.clip(overrun_pct, -20.0, 200.0))
    predicted_final = budget * (1 + overrun_pct / 100.0)

    return {
        "overrun_pct": round(overrun_pct, 2),
        "predicted_final_cost": round(predicted_final, 2),
        "confidence_score": round(40.0, 1),   # low — rule-based
        "model_version": "evm_rule_based_v1",
        "cpi": round(cpi, 4),
        "method": "evm_fallback",
    }


def predict(
    *,
    budget: float,
    planned_duration_days: int,
    worker_count: int,
    task_count: int,
    snapshot_progress_pct: float,
    actual_cost_at_snapshot: float,
    delayed_task_count: int,
    labour_cost: float,
    material_cost: float,
    months_elapsed: int,
    has_subcontractors: int = 0,
    location_type: int = 0,
    planned_progress_pct: float = 0.0,
) -> dict:
    """
    Run the ML prediction pipeline.

    Returns a dict with:
      overrun_pct            — predicted % over/under budget at completion
      predicted_final_cost   — predicted total final cost (LKR)
      confidence_score       — 0-100 score (mapped from CV R²)
      model_version          — identifier string
      cpi                    — computed Cost Performance Index
      method                 — 'ml' or 'evm_fallback'
    """
    model_ready = _load()
    budget = max(float(budget), 1.0)

    # Compute CPI for all paths (used by fallback and displayed in notes)
    earned_value = budget * (snapshot_progress_pct / 100.0)
    cpi = np.clip(earned_value / max(actual_cost_at_snapshot, 1.0), 0.3, 2.0)

    if not model_ready or snapshot_progress_pct < 5.0:
        # Not enough progress or model missing — use EVM
        return _evm_fallback(
            budget=budget,
            actual_cost=actual_cost_at_snapshot,
            progress_pct=snapshot_progress_pct,
            delayed_count=delayed_task_count,
            task_count=task_count,
        )

    try:
        X = build_feature_vector(
            budget=budget,
            planned_duration_days=planned_duration_days,
            worker_count=worker_count,
            task_count=task_count,
            snapshot_progress_pct=snapshot_progress_pct,
            actual_cost_at_snapshot=actual_cost_at_snapshot,
            delayed_task_count=delayed_task_count,
            labour_cost=labour_cost,
            material_cost=material_cost,
            months_elapsed=months_elapsed,
            has_subcontractors=has_subcontractors,
            location_type=location_type,
            planned_progress_pct=planned_progress_pct,
        )

        raw_overrun = float(_model.predict(X)[0])
        overrun_pct = float(np.clip(raw_overrun, -20.0, 200.0))
        predicted_final = budget * (1 + overrun_pct / 100.0)

        # ── Confidence: map CV R² → 0-100 score ───────────────────────────────
        # CV R² is loaded from model_metadata.json (updated on each training run).
        # Discount factor 0.90 = conservative adjustment acknowledging that model
        # was trained on calibrated rather than fully observed construction outcomes.
        # Additional penalty for low project progress (less EVM data = less reliable).
        cv_r2 = _meta.get("cv_r2_mean", 0.9018)
        base_confidence = cv_r2 * 100.0 * 0.90          # e.g. 0.9018 * 90 = 81.2
        progress_penalty = max(0, (30 - snapshot_progress_pct) * 0.5)  # penalty if <30%
        confidence = float(np.clip(base_confidence - progress_penalty, 20.0, 88.0))

        model_name = _meta.get("model_name", "GradientBoosting")
        version = _meta.get("model_version", "gbr_v2")

        return {
            "overrun_pct": round(overrun_pct, 2),
            "predicted_final_cost": round(predicted_final, 2),
            "confidence_score": round(confidence, 1),
            "model_version": version,
            "cpi": round(float(cpi), 4),
            "method": "ml",
            "model_name": model_name,
            "cv_r2": round(cv_r2, 4),
        }

    except Exception as exc:
        logger.error("ML prediction failed: %s — falling back to EVM", exc)
        return _evm_fallback(
            budget=budget,
            actual_cost=actual_cost_at_snapshot,
            progress_pct=snapshot_progress_pct,
            delayed_count=delayed_task_count,
            task_count=task_count,
        )


def get_model_info() -> dict:
    """Return the full model metadata for the /ml/model-info endpoint."""
    _load()
    if not _meta:
        return {
            "status": "model_not_trained",
            "message": "Run scripts/generate_training_data.py then scripts/train_model.py",
        }
    return {
        "status": "loaded" if _model is not None else "metadata_only",
        **_meta,
    }
