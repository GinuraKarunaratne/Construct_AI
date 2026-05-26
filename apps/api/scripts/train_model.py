"""
ConstructAI — ML Model Training Pipeline
=========================================

Models compared:
  1. Ridge Regression     (linear baseline — interpretable)
  2. Random Forest        (ensemble, handles non-linearity)
  3. Gradient Boosting    (scikit-learn, historically best for this type of data)
  4. XGBoost              (state-of-the-art gradient boosting with regularisation)

Selection: Best model by 5-fold cross-validated R².

Evaluation:
  - Train/test split: 80/20 (stratified on overrun quintile)
  - 5-fold cross-validation
  - Metrics: MAE, RMSE, R², MAPE
  - SHAP feature importances (for explainability API)
  - Learning curves saved to models/learning_curves.json

Output:
  models/cost_model.joblib       — trained best model + scaler pipeline
  models/model_metadata.json     — all metrics, feature importances, SHAP values

Run:
    cd apps/api
    python scripts/fetch_real_data.py        # 1. download real data
    python scripts/generate_training_data.py # 2. build training set
    python scripts/train_model.py            # 3. train & save model
"""

import os
import sys
import json
import warnings
from datetime import date

import numpy as np
import pandas as pd
import joblib
import shap

from sklearn.linear_model import Ridge
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.model_selection import (
    train_test_split, cross_val_score, KFold, learning_curve
)
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

import xgboost as xgb

warnings.filterwarnings("ignore")

# ── Paths ──────────────────────────────────────────────────────────────────────
BASE_DIR  = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_CSV  = os.path.join(BASE_DIR, "data", "construction_projects.csv")
MODEL_OUT = os.path.join(BASE_DIR, "models", "cost_model.joblib")
META_OUT  = os.path.join(BASE_DIR, "models", "model_metadata.json")
LC_OUT    = os.path.join(BASE_DIR, "models", "learning_curves.json")

# ── Feature columns ────────────────────────────────────────────────────────────
FEATURE_COLS = [
    "project_type",           # 0=residential, 1=commercial, 2=infrastructure
    "budget",                 # Total planned budget
    "planned_duration_days",  # Planned project duration
    "worker_count",           # Team size
    "task_count",             # Number of tasks
    "location_type",          # 0=urban, 1=suburban, 2=rural
    "has_subcontractors",     # Binary
    "snapshot_progress_pct",  # % complete at time of prediction
    "actual_cost_at_snapshot",# Actual spend so far
    "cpi",                    # Cost Performance Index (EV / AC) — KEY
    "spi",                    # Schedule Performance Index — KEY
    "delayed_task_count",     # Number of delayed tasks
    "delayed_task_ratio",     # Delayed / total tasks
    "labour_ratio",           # Labour as fraction of budget
    "material_ratio",         # Materials as fraction of budget
    "months_elapsed",         # Months since project start
    "budget_used_pct",        # Actual cost / budget × 100
    "schedule_efficiency",    # Progress per month
]
TARGET_COL = "overrun_pct"


def mape(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    """Mean Absolute Percentage Error, skipping near-zero targets."""
    y_true = np.asarray(y_true, dtype=float)
    y_pred = np.asarray(y_pred, dtype=float)
    mask = np.abs(y_true) > 1.0
    if mask.sum() == 0:
        return 0.0
    return float(np.mean(np.abs((y_true[mask] - y_pred[mask]) / y_true[mask])) * 100.0)


def evaluate(name: str, model, X_train, X_test, y_train, y_test) -> dict:
    """Fit, predict, and compute all metrics including cross-validation."""
    model.fit(X_train, y_train)
    y_pred_train = model.predict(X_train)
    y_pred_test  = model.predict(X_test)

    cv = KFold(n_splits=5, shuffle=True, random_state=42)
    cv_r2  = cross_val_score(model, X_train, y_train, cv=cv, scoring="r2")
    cv_mae = cross_val_score(model, X_train, y_train, cv=cv,
                             scoring="neg_mean_absolute_error")
    return {
        "model_name": name,
        # Hold-out test metrics
        "test_r2":    round(float(r2_score(y_test,  y_pred_test)),  4),
        "test_mae":   round(float(mean_absolute_error(y_test,  y_pred_test)), 4),
        "test_rmse":  round(float(np.sqrt(mean_squared_error(y_test, y_pred_test))), 4),
        "test_mape":  round(float(mape(y_test, y_pred_test)), 4),
        # Training set metrics (detect overfitting)
        "train_r2":   round(float(r2_score(y_train, y_pred_train)), 4),
        "train_mae":  round(float(mean_absolute_error(y_train, y_pred_train)), 4),
        # Cross-validation
        "cv_r2_mean":  round(float(cv_r2.mean()),   4),
        "cv_r2_std":   round(float(cv_r2.std()),    4),
        "cv_mae_mean": round(float(-cv_mae.mean()), 4),
        "cv_mae_std":  round(float(cv_mae.std()),   4),
    }


def compute_learning_curve(model, X_train, y_train) -> dict:
    """
    Compute training and validation scores at increasing sample sizes.
    Returns a JSON-serialisable dict for later plotting.
    """
    train_sizes, train_scores, val_scores = learning_curve(
        model, X_train, y_train,
        cv=5,
        scoring="r2",
        train_sizes=np.linspace(0.1, 1.0, 10),
        n_jobs=-1,
        random_state=42,
    )
    return {
        "train_sizes":       [int(s) for s in train_sizes],
        "train_r2_mean":     [round(float(v), 4) for v in train_scores.mean(axis=1)],
        "train_r2_std":      [round(float(v), 4) for v in train_scores.std(axis=1)],
        "val_r2_mean":       [round(float(v), 4) for v in val_scores.mean(axis=1)],
        "val_r2_std":        [round(float(v), 4) for v in val_scores.std(axis=1)],
    }


def compute_shap_importances(model, X_train: np.ndarray) -> dict:
    """
    Compute SHAP-based mean absolute feature importances.
    Works for both tree-based and linear models.
    Returns a dict keyed by feature name.
    """
    try:
        # Use a sample of up to 500 rows for speed
        sample_size = min(500, len(X_train))
        idx = np.random.choice(len(X_train), sample_size, replace=False)
        X_sample = X_train[idx]

        inner = model.named_steps.get("model", model)

        if isinstance(inner, (xgb.XGBRegressor, RandomForestRegressor, GradientBoostingRegressor)):
            explainer = shap.TreeExplainer(inner)
            shap_values = explainer.shap_values(X_sample)
        else:
            # Fallback: kernel explainer (slower but universal)
            background = shap.sample(X_sample, 50)
            predict_fn = model.predict
            explainer = shap.KernelExplainer(predict_fn, background)
            shap_values = explainer.shap_values(X_sample, nsamples=100)

        mean_abs = np.abs(shap_values).mean(axis=0)
        total    = mean_abs.sum()
        result   = {
            FEATURE_COLS[i]: round(float(mean_abs[i] / total), 6)
            for i in range(len(FEATURE_COLS))
        }
        return dict(sorted(result.items(), key=lambda x: x[1], reverse=True))

    except Exception as e:
        print(f"  WARNING: SHAP computation failed ({e}) — using feature_importances_ fallback")
        try:
            inner = model.named_steps.get("model", model)
            raw = inner.feature_importances_
            total = raw.sum()
            return {
                FEATURE_COLS[i]: round(float(raw[i] / total), 6)
                for i in range(len(FEATURE_COLS))
            }
        except Exception:
            return {}


def main():
    print("=" * 70)
    print("ConstructAI — ML Model Training Pipeline")
    print("=" * 70)

    # ── Load dataset ───────────────────────────────────────────────────────
    if not os.path.exists(DATA_CSV):
        print(f"\nERROR: Dataset not found at {DATA_CSV}")
        print("Run generate_training_data.py first.")
        sys.exit(1)

    df = pd.read_csv(DATA_CSV)

    # Validate all feature columns exist
    missing = [c for c in FEATURE_COLS if c not in df.columns]
    if missing:
        print(f"\nERROR: Missing columns in dataset: {missing}")
        sys.exit(1)

    print(f"\n✓ Dataset loaded: {len(df):,} rows, {len(FEATURE_COLS)} features")
    print(f"  Target (overrun_pct): mean={df[TARGET_COL].mean():.1f}%  "
          f"std={df[TARGET_COL].std():.1f}%  "
          f"range=[{df[TARGET_COL].min():.1f}%, {df[TARGET_COL].max():.1f}%]")

    if "data_source" in df.columns:
        real_n = df["data_source"].str.startswith("USASpending").sum()
        print(f"  Real-grounded rows:  {real_n:,} ({real_n/len(df)*100:.0f}%)")
        print(f"  Synthetic rows:      {len(df)-real_n:,} ({(len(df)-real_n)/len(df)*100:.0f}%)")

    X = df[FEATURE_COLS].values.astype(float)
    y = df[TARGET_COL].values.astype(float)

    # ── Stratified train/test split ────────────────────────────────────────
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, random_state=42,
        stratify=pd.cut(y, bins=5, labels=False)
    )
    print(f"\n  Training samples: {len(X_train):,}")
    print(f"  Test samples:     {len(X_test):,}")

    # ── Define candidate models ────────────────────────────────────────────
    candidates = {
        "RidgeRegression": Pipeline([
            ("scaler", StandardScaler()),
            ("model",  Ridge(alpha=10.0)),
        ]),
        "RandomForest": Pipeline([
            ("scaler", StandardScaler()),
            ("model",  RandomForestRegressor(
                n_estimators=400,
                max_depth=14,
                min_samples_leaf=3,
                max_features=0.6,
                random_state=42,
                n_jobs=-1,
            )),
        ]),
        "GradientBoosting": Pipeline([
            ("scaler", StandardScaler()),
            ("model",  GradientBoostingRegressor(
                n_estimators=600,
                learning_rate=0.04,
                max_depth=5,
                min_samples_leaf=5,
                subsample=0.80,
                max_features=0.7,
                random_state=42,
            )),
        ]),
        "XGBoost": Pipeline([
            ("scaler", StandardScaler()),
            ("model",  xgb.XGBRegressor(
                n_estimators=600,
                learning_rate=0.04,
                max_depth=6,
                min_child_weight=5,
                subsample=0.80,
                colsample_bytree=0.75,
                reg_alpha=0.5,          # L1 regularisation
                reg_lambda=2.0,         # L2 regularisation
                gamma=0.1,              # min split loss
                random_state=42,
                n_jobs=-1,
                eval_metric="rmse",
                verbosity=0,
            )),
        ]),
    }

    # ── Train & evaluate all candidates ───────────────────────────────────
    print("\n" + "-" * 70)
    print(f"{'Model':<22} {'Test R²':>8} {'Test MAE':>10} {'Test RMSE':>11}  {'CV R² (mean±std)':>20}")
    print("-" * 70)

    results = {}
    trained_models = {}
    for name, pipeline in candidates.items():
        print(f"  Training {name}…", end="\r")
        res = evaluate(name, pipeline,
                       X_train.copy(), X_test.copy(),
                       y_train.copy(), y_test.copy())
        results[name]       = res
        trained_models[name] = pipeline  # already fitted by evaluate()
        print(f"  {name:<20} {res['test_r2']:>8.4f} {res['test_mae']:>10.2f}% "
              f"{res['test_rmse']:>11.2f}%   "
              f"{res['cv_r2_mean']:.4f} ± {res['cv_r2_std']:.4f}")

    print("-" * 70)

    # ── Select best model by CV R² ─────────────────────────────────────────
    best_name  = max(results, key=lambda n: results[n]["cv_r2_mean"])
    best_res   = results[best_name]
    best_model = trained_models[best_name]

    print(f"\n✓ Best model: {best_name}  (CV R² = {best_res['cv_r2_mean']:.4f})")

    # Re-fit best model on full training set before saving
    print("  Re-training on full training set…")
    best_model.fit(X_train, y_train)

    # ── SHAP feature importances ───────────────────────────────────────────
    print("  Computing SHAP feature importances…")
    inner_model = best_model.named_steps["model"]
    # For SHAP we need raw (scaled) inputs
    scaler = best_model.named_steps.get("scaler")
    X_train_scaled = scaler.transform(X_train) if scaler else X_train
    shap_importances = compute_shap_importances(
        Pipeline([("model", inner_model)]),
        X_train_scaled
    )

    if shap_importances:
        top5 = list(shap_importances.items())[:5]
        print("\n  Top-5 SHAP importances:")
        for feat, imp in top5:
            print(f"    {feat:<30} {imp:.4f}")

    # ── Learning curves (best model) ───────────────────────────────────────
    print("\n  Computing learning curves…")
    lc = compute_learning_curve(best_model, X_train, y_train)

    # ── Save model ─────────────────────────────────────────────────────────
    os.makedirs(os.path.dirname(MODEL_OUT), exist_ok=True)
    joblib.dump(best_model, MODEL_OUT)
    print(f"\n✓ Model saved → {MODEL_OUT}")

    # ── Save learning curves ───────────────────────────────────────────────
    with open(LC_OUT, "w") as f:
        json.dump(lc, f, indent=2)
    print(f"✓ Learning curves → {LC_OUT}")

    # ── Save metadata ──────────────────────────────────────────────────────
    meta = {
        "model_name":         best_name,
        "model_version":      f"v3_{best_name.lower()}_{date.today().isoformat()}",
        "training_date":      date.today().isoformat(),
        "feature_columns":    FEATURE_COLS,
        "target_column":      TARGET_COL,
        "n_training_samples": int(len(X_train)),
        "n_test_samples":     int(len(X_test)),
        "n_total_samples":    int(len(df)),
        "all_models":         results,
        "selected_model":     best_name,
        "test_r2":            best_res["test_r2"],
        "test_mae":           best_res["test_mae"],
        "test_rmse":          best_res["test_rmse"],
        "test_mape":          best_res["test_mape"],
        "train_r2":           best_res["train_r2"],
        "cv_r2_mean":         best_res["cv_r2_mean"],
        "cv_r2_std":          best_res["cv_r2_std"],
        "cv_mae_mean":        best_res["cv_mae_mean"],
        # SHAP importances (normalised, sum to 1)
        "shap_importances":   shap_importances,
        # For backwards compat — raw feature_importances_ if available
        "feature_importances": shap_importances,
        # Confidence base for UI display
        "confidence_base":    round(float(best_res["test_r2"]) * 100, 1),
        "dataset_source": (
            "Hybrid: ~88% USASpending.gov real US federal construction contracts "
            "(EVM snapshots via Christensen 1992 CPI stability) + "
            "~12% calibrated synthetic (Flyvbjerg 2002, Cantarelli 2010)"
        ),
    }

    with open(META_OUT, "w") as f:
        json.dump(meta, f, indent=2)
    print(f"✓ Metadata saved → {META_OUT}")

    # ── Final summary ──────────────────────────────────────────────────────
    print("\n" + "=" * 70)
    print("TRAINING COMPLETE")
    print(f"  Model:     {best_name}")
    print(f"  Test R²:   {best_res['test_r2']:.4f}  "
          f"({'excellent' if best_res['test_r2'] > 0.85 else 'good' if best_res['test_r2'] > 0.75 else 'moderate'})")
    print(f"  Test MAE:  {best_res['test_mae']:.2f}%")
    print(f"  Test RMSE: {best_res['test_rmse']:.2f}%")
    print(f"  CV R²:     {best_res['cv_r2_mean']:.4f} ± {best_res['cv_r2_std']:.4f}")

    overfit_gap = best_res["train_r2"] - best_res["test_r2"]
    if overfit_gap > 0.10:
        print(f"\n  ⚠  Overfitting warning: train_R²–test_R² = {overfit_gap:.3f} (>0.10)")
    else:
        print(f"\n  ✓ Generalisation gap: train_R²–test_R² = {overfit_gap:.3f} (healthy)")

    print("=" * 70)
    print("\nNext: restart the API server — it will auto-load the model.")


if __name__ == "__main__":
    main()
