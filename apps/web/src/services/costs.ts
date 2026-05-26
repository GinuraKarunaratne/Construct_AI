import { apiClient } from "./api";

export interface BudgetVsActualItem {
  category: string;
  budgeted: number;
  actual: number;
  variance: number;  // actual - budgeted (positive = over budget)
}

export interface CostSummary {
  total_budget: number;
  actual_cost_to_date: number;
  budget_used_pct: number;
  material_cost: number;
  labour_cost: number;
  other_cost: number;
  remaining_budget: number;
  overrun_risk: boolean;
  budget_items_vs_actual?: BudgetVsActualItem[];
}

export interface BudgetItemOut {
  id: number;
  project_id: number;
  category: string;
  description?: string | null;
  estimated_amount: number;
}

export interface ExpenseOut {
  id: number;
  project_id: number;
  category: string;
  description?: string | null;
  amount: number;
  expense_date: string;
}

export interface ExpenseCreate {
  category: string;
  description?: string;
  amount: number;
  expense_date: string;
}

export interface PredictionOut {
  id: number;
  project_id: number;
  prediction_date: string;
  actual_cost_to_date: number;
  predicted_final_cost: number;
  budget: number;
  overrun_risk: boolean;
  confidence_score: number;
  model_version: string;
  notes?: string | null;
}

export const costsApi = {
  summary: (projectId: number) =>
    apiClient
      .get<CostSummary>(`/projects/${projectId}/cost-summary`)
      .then((r) => r.data),
  budgetItems: (projectId: number) =>
    apiClient
      .get<BudgetItemOut[]>(`/projects/${projectId}/budget-items`)
      .then((r) => r.data),
  expenses: (projectId: number) =>
    apiClient
      .get<ExpenseOut[]>(`/projects/${projectId}/expenses`)
      .then((r) => r.data),
  addExpense: (projectId: number, data: ExpenseCreate) =>
    apiClient
      .post<ExpenseOut>(`/projects/${projectId}/expenses`, data)
      .then((r) => r.data),
  latestPrediction: (projectId: number) =>
    apiClient
      .get<PredictionOut | null>(`/projects/${projectId}/cost-predictions/latest`)
      .then((r) => r.data),
  predictionHistory: (projectId: number, limit = 20) =>
    apiClient
      .get<PredictionOut[]>(`/projects/${projectId}/cost-predictions/history`, { params: { limit } })
      .then((r) => r.data),
  runPrediction: (projectId: number) =>
    apiClient
      .post<PredictionOut>(`/projects/${projectId}/cost-predictions/run`)
      .then((r) => r.data),
  exportExpensesCsv: (projectId: number) =>
    `/api/v1/projects/${projectId}/reports/expenses.csv`,
};
