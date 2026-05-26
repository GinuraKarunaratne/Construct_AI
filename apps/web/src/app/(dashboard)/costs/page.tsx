"use client";

import { useState, FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useActiveProject } from "@/hooks/useActiveProject";
import { costsApi, ExpenseCreate } from "@/services/costs";
import { LoadingSpinner, EmptyState } from "@/components/ui/LoadingSpinner";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { formatCurrency, formatCompact } from "@/lib/utils";
import {
  Plus,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  BarChart3,
  FileDown,
  ArrowDownCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

const EXPENSE_CATEGORIES = [
  "Equipment",
  "Transport",
  "Labour",
  "Material",
  "Subcontractor",
  "Repair",
  "Other",
];

function confidencePill(score: number) {
  if (score >= 75) return { label: "High confidence",   cls: "bg-success-50 text-success-700 border border-success-100" };
  if (score >= 55) return { label: "Medium confidence", cls: "bg-warning-50 text-warning-700 border border-warning-100" };
  return                  { label: "Low confidence",    cls: "bg-danger-50  text-danger-700  border border-danger-100"  };
}

export default function CostsPage() {
  const qc = useQueryClient();
  const { projectId, isLoading: projLoading } = useActiveProject();
  const [expModal, setExpModal] = useState(false);
  const [expForm, setExpForm] = useState<ExpenseCreate>({
    category: "Equipment",
    description: "",
    amount: 0,
    expense_date: new Date().toISOString().slice(0, 10),
  });
  const [expErr, setExpErr] = useState<string | null>(null);
  const [csvLoading, setCsvLoading] = useState(false);

  const { data: summary, isLoading: sumLoading } = useQuery({
    queryKey: ["cost-summary", projectId],
    queryFn: () => costsApi.summary(projectId!),
    enabled: !!projectId,
  });

  const { data: expenses } = useQuery({
    queryKey: ["expenses", projectId],
    queryFn: () => costsApi.expenses(projectId!),
    enabled: !!projectId,
  });

  const { data: prediction } = useQuery({
    queryKey: ["prediction", projectId],
    queryFn: () => costsApi.latestPrediction(projectId!),
    enabled: !!projectId,
  });

  const { data: predHistory } = useQuery({
    queryKey: ["prediction-history", projectId],
    queryFn: () => costsApi.predictionHistory(projectId!, 20),
    enabled: !!projectId,
  });

  const addExpense = useMutation({
    mutationFn: (data: ExpenseCreate) => costsApi.addExpense(projectId!, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses", projectId] });
      qc.invalidateQueries({ queryKey: ["cost-summary", projectId] });
      qc.invalidateQueries({ queryKey: ["dashboard", projectId] });
      setExpModal(false);
      setExpErr(null);
    },
    onError: (e: unknown) => {
      setExpErr(
        (e as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? "Failed to add expense"
      );
    },
  });

  const runPrediction = useMutation({
    mutationFn: () => costsApi.runPrediction(projectId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["prediction", projectId] });
      qc.invalidateQueries({ queryKey: ["prediction-history", projectId] });
      qc.invalidateQueries({ queryKey: ["dashboard", projectId] });
    },
  });

  function handleExpSubmit(e: FormEvent) {
    e.preventDefault();
    setExpErr(null);
    addExpense.mutate(expForm);
  }

  async function handleExportCsv() {
    if (!projectId) return;
    setCsvLoading(true);
    try {
      const token =
        typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
      const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
      const res = await fetch(
        `${base}/api/v1/projects/${projectId}/reports/expenses.csv`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `expenses_project_${projectId}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // silently ignore
    } finally {
      setCsvLoading(false);
    }
  }

  if (projLoading || sumLoading) return <LoadingSpinner message="Loading cost data…" />;
  if (!summary) return null;

  const budgetUsedWidth = Math.min(summary.budget_used_pct, 100);
  const budgetColor =
    summary.budget_used_pct >= 90
      ? "bg-red-500"
      : summary.budget_used_pct >= 70
      ? "bg-amber-500"
      : "bg-ink-900";

  const overrunAmount = prediction
    ? prediction.predicted_final_cost - summary.total_budget
    : 0;
  const overrunPct = summary.total_budget
    ? (overrunAmount / summary.total_budget) * 100
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="page-title">Costs</h1>
          <p className="page-subtitle">Budget tracking and cost forecast</p>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          <button
            onClick={() => runPrediction.mutate()}
            disabled={runPrediction.isPending}
            className="btn-secondary"
            title="Run AI cost forecast"
          >
            {runPrediction.isPending ? (
              <span className="w-3.5 h-3.5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <BarChart3 className="w-4 h-4" strokeWidth={2} />
            )}
            <span className="hidden sm:inline">Run Forecast</span>
          </button>
          <button
            onClick={handleExportCsv}
            disabled={csvLoading || !projectId}
            className="btn-secondary"
            title="Download all expenses as CSV"
          >
            {csvLoading ? (
              <span className="w-3.5 h-3.5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <FileDown className="w-4 h-4" strokeWidth={2} />
            )}
            <span className="hidden sm:inline">Export CSV</span>
          </button>
          <button
            onClick={() => {
              setExpErr(null);
              setExpModal(true);
            }}
            className="btn-primary"
          >
            <Plus className="w-4 h-4" strokeWidth={2.5} />
            <span className="hidden sm:inline">Add Expense</span>
          </button>
        </div>
      </div>

      {/* Summary KPI tiles — Untitled UI style with dark highlight */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Dark / featured card */}
        <div className="kpi-tile-dark">
          <p className="kpi-label">Total Budget</p>
          <div>
            <p className="kpi-value">{formatCurrency(summary.total_budget)}</p>
            <p className="kpi-sub">Project budget</p>
          </div>
        </div>
        <div className="kpi-tile">
          <p className="kpi-label">Actual Cost to Date</p>
          <div>
            <p className="kpi-value">{formatCurrency(summary.actual_cost_to_date)}</p>
            <p className="kpi-sub">{summary.budget_used_pct.toFixed(1)}% of budget</p>
          </div>
        </div>
        <div className="kpi-tile">
          <p className="kpi-label">Remaining Budget</p>
          <div>
            <p className={cn(
              "kpi-value",
              summary.remaining_budget < 0 ? "text-danger-600" : "text-success-700"
            )}>
              {formatCurrency(summary.remaining_budget)}
            </p>
            <p className="kpi-sub">
              {summary.remaining_budget < 0 ? "Budget exceeded" : "Available"}
            </p>
          </div>
        </div>
        <div className="kpi-tile">
          <p className="kpi-label">Budget Used</p>
          <div>
            <p className="kpi-value">{summary.budget_used_pct.toFixed(1)}%</p>
            <div className="progress-track h-2 mt-3">
              <div
                className={cn("progress-bar h-2", budgetColor)}
                style={{ width: `${budgetUsedWidth}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* AI Cost Forecast */}
      {prediction ? (
        <div
          className={cn(
            "rounded-xl border p-5",
            prediction.overrun_risk
              ? "bg-danger-50 border-danger-100"
              : "bg-success-50 border-success-100"
          )}
        >
          <div className="flex items-start justify-between gap-6 flex-wrap">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              {prediction.overrun_risk ? (
                <AlertTriangle
                  className="w-5 h-5 text-danger-600 flex-shrink-0 mt-0.5"
                  strokeWidth={2}
                />
              ) : (
                <CheckCircle2
                  className="w-5 h-5 text-success-600 flex-shrink-0 mt-0.5"
                  strokeWidth={2}
                />
              )}
              <div>
                <h3
                  className={cn(
                    "font-semibold text-sm",
                    prediction.overrun_risk ? "text-danger-700" : "text-success-700"
                  )}
                >
                  {prediction.overrun_risk
                    ? "Budget Overrun Risk Detected"
                    : "Project on Budget"}
                </h3>
                {prediction.overrun_risk && overrunAmount > 0 && (
                  <p className="text-sm text-danger-700 mt-1 font-semibold">
                    Projected overrun: +{formatCompact(overrunAmount)}{" "}
                    <span className="font-normal text-danger-600">
                      ({overrunPct.toFixed(1)}% over budget)
                    </span>
                  </p>
                )}
                <p className="text-xs text-ink-500 mt-1.5">
                  AI forecast · Last updated {prediction.prediction_date}
                </p>
              </div>
            </div>

            <div className="text-right flex-shrink-0">
              <p className="text-xs text-ink-500 mb-1">Predicted Final Cost</p>
              <p
                className={cn(
                  "text-2xl font-bold tabular-nums tracking-tight",
                  prediction.overrun_risk ? "text-danger-700" : "text-success-700"
                )}
              >
                {formatCompact(prediction.predicted_final_cost)}
              </p>
              <div className="mt-2 flex justify-end">
                <span
                  className={cn(
                    "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold",
                    confidencePill(prediction.confidence_score).cls
                  )}
                >
                  {confidencePill(prediction.confidence_score).label}
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3 p-4 bg-white border border-surface-border rounded-xl text-sm">
          <BarChart3 className="w-4 h-4 text-ink-500 flex-shrink-0 mt-0.5" strokeWidth={2} />
          <div>
            <p className="font-semibold text-ink-900">No cost forecast yet</p>
            <p className="text-sm text-ink-500 mt-0.5">
              Click <strong>Run Forecast</strong> to generate an AI cost prediction for this project.
            </p>
          </div>
        </div>
      )}

      {/* Budget vs Actuals + Cost Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Budget vs Actuals */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Budget vs. Actuals</h2>
          </div>
          <div className="p-5">
            {(summary.budget_items_vs_actual ?? []).length === 0 ? (
              <p className="text-sm text-gray-400 italic">
                No budget items defined. Add budget items to see comparison.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th className="th-right">Budgeted</th>
                      <th className="th-right">Actual</th>
                      <th className="th-right">Variance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(summary.budget_items_vs_actual ?? []).map((row) => (
                      <tr key={row.category}>
                        <td className="font-medium text-gray-700">{row.category}</td>
                        <td className="td-right text-gray-600 tabular-nums">
                          {formatCurrency(row.budgeted)}
                        </td>
                        <td className="td-right text-gray-800 font-semibold tabular-nums">
                          {formatCurrency(row.actual)}
                        </td>
                        <td
                          className={cn(
                            "td-right font-bold tabular-nums",
                            row.variance > 0 ? "text-red-600" : "text-emerald-600"
                          )}
                        >
                          {row.variance > 0 ? "+" : ""}
                          {formatCurrency(Math.abs(row.variance))}
                          {row.variance > 0 && (
                            <ArrowDownCircle className="w-3 h-3 inline ml-1" />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Actual Cost Breakdown */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Actual Cost Breakdown</h2>
          </div>
          <div className="p-5 space-y-4">
            {[
              { label: "Materials", value: summary.material_cost, color: "bg-ink-900" },
              { label: "Labour", value: summary.labour_cost, color: "bg-violet-400" },
              { label: "Other", value: summary.other_cost, color: "bg-gray-300" },
            ].map((row) => {
              const pct = summary.actual_cost_to_date
                ? (row.value / summary.actual_cost_to_date) * 100
                : 0;
              return (
                <div key={row.label}>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="font-medium text-gray-700">{row.label}</span>
                    <span className="text-gray-500">
                      {formatCurrency(row.value)}{" "}
                      <span className="text-gray-400">({pct.toFixed(0)}%)</span>
                    </span>
                  </div>
                  <div className="progress-track h-3">
                    <div
                      className={cn("progress-bar h-3", row.color)}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
            <div className="pt-2 border-t border-gray-100 flex justify-between text-sm font-semibold text-gray-800">
              <span>Total to Date</span>
              <span>{formatCurrency(summary.actual_cost_to_date)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Forecast Trend */}
      {(predHistory ?? []).length > 1 && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-ink-700" />
              Cost Forecast Trend
            </h2>
            <span className="text-xs text-gray-400">{predHistory?.length} data points</span>
          </div>
          <div className="p-5">
            {(() => {
              const data = predHistory!;
              const costs = data.map((p) => p.predicted_final_cost);
              const budgets = data.map((p) => p.budget);
              const minVal = Math.min(...costs, ...budgets) * 0.95;
              const maxVal = Math.max(...costs, ...budgets) * 1.05;
              const W = 600;
              const H = 120;
              const xStep = W / (data.length - 1);
              const yScale = (v: number) =>
                H - ((v - minVal) / (maxVal - minVal)) * H;

              const costPath = data
                .map(
                  (p, i) =>
                    `${i === 0 ? "M" : "L"} ${i * xStep},${yScale(
                      p.predicted_final_cost
                    )}`
                )
                .join(" ");
              const budgetPath = data
                .map(
                  (p, i) =>
                    `${i === 0 ? "M" : "L"} ${i * xStep},${yScale(p.budget)}`
                )
                .join(" ");

              return (
                <div>
                  <svg
                    viewBox={`0 0 ${W} ${H}`}
                    className="w-full h-28"
                    preserveAspectRatio="none"
                  >
                    <path
                      d={budgetPath}
                      fill="none"
                      stroke="#d1d5db"
                      strokeWidth="1.5"
                      strokeDasharray="4 3"
                    />
                    <path
                      d={costPath}
                      fill="none"
                      stroke="#f97316"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    {data.map((p, i) => (
                      <circle
                        key={i}
                        cx={i * xStep}
                        cy={yScale(p.predicted_final_cost)}
                        r="3"
                        fill={p.overrun_risk ? "#ef4444" : "#10b981"}
                      />
                    ))}
                  </svg>
                  <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                    <span>{data[0].prediction_date}</span>
                    <div className="flex gap-4">
                      <span className="flex items-center gap-1">
                        <span className="inline-block w-4 h-0.5 bg-ink-700" />
                        Predicted Cost
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="inline-block w-4 border-t border-dashed border-gray-400" />
                        Budget
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
                        Under budget
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="inline-block w-2 h-2 rounded-full bg-red-500" />
                        Overrun risk
                      </span>
                    </div>
                    <span>{data[data.length - 1].prediction_date}</span>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Expenses Table */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Expenses</h2>
          <span className="text-xs text-gray-400">{expenses?.length ?? 0} records</span>
        </div>
        {(expenses ?? []).length === 0 ? (
          <EmptyState
            icon={<TrendingUp className="w-5 h-5" />}
            title="No expenses recorded"
            description="Add an expense to start tracking costs."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Category</th>
                  <th>Description</th>
                  <th className="th-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {(expenses ?? []).map((exp) => (
                  <tr key={exp.id}>
                    <td className="text-gray-500 tabular-nums">{exp.expense_date}</td>
                    <td>
                      <Badge label={exp.category} variant="default" />
                    </td>
                    <td className="text-gray-700">{exp.description ?? "—"}</td>
                    <td className="td-right font-semibold text-gray-800 tabular-nums">
                      {formatCurrency(exp.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Expense Modal */}
      <Modal open={expModal} onClose={() => setExpModal(false)} title="Add Expense">
        <form onSubmit={handleExpSubmit} className="space-y-4">
          {expErr && (
            <div
              role="alert"
              className="flex items-start gap-2 px-3.5 py-2.5 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg"
            >
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" strokeWidth={2} />
              {expErr}
            </div>
          )}
          <div>
            <label className="form-label">Category *</label>
            <select
              required
              value={expForm.category}
              onChange={(e) => setExpForm((f) => ({ ...f, category: e.target.value }))}
              className="form-input"
            >
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">Description</label>
            <input
              value={expForm.description ?? ""}
              onChange={(e) =>
                setExpForm((f) => ({ ...f, description: e.target.value }))
              }
              placeholder="e.g. Concrete mixer rental"
              className="form-input"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Amount (LKR) *</label>
              <input
                type="number"
                required
                min={0.01}
                step="any"
                value={expForm.amount || ""}
                onChange={(e) =>
                  setExpForm((f) => ({ ...f, amount: Number(e.target.value) }))
                }
                placeholder="50000"
                className="form-input"
              />
            </div>
            <div>
              <label className="form-label">Date *</label>
              <input
                type="date"
                required
                value={expForm.expense_date}
                onChange={(e) =>
                  setExpForm((f) => ({ ...f, expense_date: e.target.value }))
                }
                className="form-input"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
            <button type="button" onClick={() => setExpModal(false)} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={addExpense.isPending} className="btn-primary">
              {addExpense.isPending && (
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              Save Expense
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
