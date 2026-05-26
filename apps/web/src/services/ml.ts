import { apiClient } from "./api";

export interface ModelComparison {
  model_name: string;
  test_r2: number;
  test_mae: number;
  test_rmse: number;
  cv_r2_mean: number;
  cv_r2_std: number;
}

export interface ModelInfo {
  status: "loaded" | "metadata_only" | "model_not_trained";
  model_name?: string;
  model_version?: string;
  training_date?: string;
  n_total_samples?: number;
  n_training_samples?: number;
  n_test_samples?: number;
  n_real_grounded?: number;
  real_pct?: number;
  test_r2?: number;
  test_mae?: number;
  test_rmse?: number;
  test_mape?: number;
  train_r2?: number;
  cv_r2_mean?: number;
  cv_r2_std?: number;
  cv_mae_mean?: number;
  feature_columns?: string[];
  shap_importances?: Record<string, number>;
  feature_importances?: Record<string, number>;
  all_models?: Record<string, ModelComparison>;
  dataset_source?: string;
  confidence_base?: number;
}

export const mlApi = {
  modelInfo: () =>
    apiClient
      .get<ModelInfo>("/ml/model-info")
      .then((r) => r.data)
      .catch(() => null),
};
