"use client";

import { useState, FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useActiveProject } from "@/hooks/useActiveProject";
import { costsApi, ExpenseCreate } from "@/services/costs";
import { LoadingSpinner, EmptyState } from "@/components/ui/LoadingSpinner";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { formatCurrency } from "@/lib/utils";
import { Plus, AlertTriangle, CheckCircle2, TrendingUp, BarChart3 } from "lucide-react";
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

  const { data: summary, isLoading: sumLoading } = useQuery({
    queryKey: ["cost-summary", projectId],
    queryFn: () => costsApi.summary(projectId!),
    enabled: !!projectId,
  });

  const { data: budgetItems } = useQuery({
    queryKey: ["budget-items", projectId],
    queryFn: () => costsApi.budgetItems(projectId!),
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
    },
  });

  function handleExpSubmit(e: FormEvent) {
    e.preventDefault();
    setExpErr(null);
    addExpense.mutate(expForm);
  }

  if (projLoading || sumLoading) return <LoadingSpinner message="Loading cost data…" />;
  if (!summary) return null;

  const budgetUsedWidth = Math.min(summary.budget_used_pct, 100);
  const budgetColor =
    summary.budget_used_pct >= 90
      ? "bg-red-500"
      : summary.budget_used_pct >= 70
      ? "bg-amber-500"
      : "bg-brand-500";

  // Group expenses by category
  const expByCategory: Record<string, number> = {};
  (expenses ?? []).forEach((e) => {
    expByCategory[e.category] = (expByCategory[e.category] ?? 0) + e.amount;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="page-title">Costs</h1>
          <p className="page-subtitle">Budget tracking and cost prediction</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => runPrediction.mutate()}
            disabled={runPrediction.isPending}
            className="btn-secondary"
          >
            {runPrediction.isPending ? (
              <span className="w-3.5 h-3.5 border-2 border-stone-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <BarChart3 className="w-4 h-4" strokeWidth={2} />
            )}
            Run Prediction
          </button>
          <button
            onClick={() => { setExpErr(null); setExpModal(true); }}
            className="btn-primary"
          >
            <Plus className="w-4 h-4" strokeWidth={2.5} />
            Add Expense
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "Total Budget",
            value: formatCurrency(summary.total_budget),
            sub: null,
            valueClass: "text-stone-800",
          },
          {
            label: "Actual Cost to Date",
            value: formatCurrency(summary.actual_cost_to_date),
            sub: null,
            valueClass: "text-brand-700",
          },
          {
            label: "Remaining Budget",
            value: formatCurrency(summary.remaining_budget),
            sub: null,
            valueClass: summary.remaining_budget < 0 ? "text-red-600" : "text-green-700",
          },
          {
            label: "Budget Used",
            value: `${summary.budget_used_pct.toFixed(1)}%`,
            sub: "progress",
            valueClass: "text-stone-800",
          },
        ].map((card) => (
          <div key={card.label} className="bg-white rounded-xl border border-stone-200 p-5">
            <p className="text-[11px] text-stone-400 uppercase font-semibold tracking-wide mb-1.5">
              {card.label}
            </p>
            <p className={cn("text-xl font-bold leading-tight", card.valueClass)}>
              {card.value}
            </p>
            {card.sub === "progress" && (
              <div className="w-full bg-stone-100 rounded-full h-1.5 mt-2.5">
                <div
                  className={cn("h-1.5 rounded-full transition-all duration-500", budgetColor)}
                  style={{ width: `${budgetUsedWidth}%` }}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* AI Prediction widget */}
      {prediction && (
        <div
          className={cn(
            "rounded-xl border p-5",
            prediction.overrun_risk
              ? "bg-red-50 border-red-200"
              : "bg-green-50 border-green-200"
          )}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              {prediction.overrun_risk ? (
                <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" strokeWidth={2} />
              ) : (
                <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" strokeWidth={2} />
              )}
              <div>
                <h3 className={cn("font-semibold", prediction.overrun_risk ? "text-red-800" : "text-green-800")}>
                  {prediction.overrun_risk ? "Budget Overrun Risk Detected" : "Project on Budget"}
                </h3>
                <p className={cn("text-sm mt-1", prediction.overrun_risk ? "text-red-600" : "text-green-600")}>
                  {prediction.notes}
                </p>
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-xs text-stone-400 mb-1">Predicted Final Cost</p>
              <p className={cn("text-xl font-bold", prediction.overrun_risk ? "text-red-700" : "text-green-700")}>
                {formatCurrency(prediction.predicted_final_cost)}
              </p>
              <p className="text-xs text-stone-400 mt-0.5">
                Confidence: {prediction.confidence_score}% · {prediction.model_version}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Budget items vs actual */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Budget Allocation */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Budget Allocation</h2>
          </div>
          <div className="p-5 space-y-3">
            {(budgetItems ?? []).length === 0 ? (
              <p className="text-sm text-stone-400 italic">No budget items defined.</p>
            ) : (
              (budgetItems ?? []).map((item) => {
                const pct = summary.total_budget
                  ? (item.estimated_amount / summary.total_budget) * 100
                  : 0;
                return (
                  <div key={item.id}>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="font-medium text-stone-700">{item.category}</span>
                      <span className="text-stone-500">
                        {formatCurrency(item.estimated_amount)}
                        <span className="text-stone-400 ml-1">({pct.toFixed(0)}%)</span>
                      </span>
                    </div>
                    <div className="w-full bg-stone-100 rounded-full h-2">
                      <div
                        className="bg-brand-400 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Cost breakdown */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Actual Cost Breakdown</h2>
          </div>
          <div className="p-5 space-y-4">
            {[
              { label: "Materials", value: summary.material_cost, color: "bg-brand-500" },
              { label: "Labour",    value: summary.labour_cost,   color: "bg-violet-400" },
              { label: "Other",     value: summary.other_cost,    color: "bg-stone-300"  },
            ].map((row) => {
              const pct = summary.actual_cost_to_date
                ? (row.value / summary.actual_cost_to_date) * 100
                : 0;
              return (
                <div key={row.label}>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="font-medium text-stone-700">{row.label}</span>
                    <span className="text-stone-500">
                      {formatCurrency(row.value)}{" "}
                      <span className="text-stone-400">({pct.toFixed(0)}%)</span>
                    </span>
                  </div>
                  <div className="w-full bg-stone-100 rounded-full h-3">
                    <div
                      className={cn("h-3 rounded-full transition-all duration-500", row.color)}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
            <div className="pt-2 border-t border-stone-100 flex justify-between text-sm font-semibold text-stone-800">
              <span>Total</span>
              <span>{formatCurrency(summary.actual_cost_to_date)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Expenses</h2>
          <span className="text-xs text-stone-400">{expenses?.length ?? 0} records</span>
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
                    <td className="text-stone-500 tabular-nums">{exp.expense_date}</td>
                    <td>
                      <Badge label={exp.category} variant="default" />
                    </td>
                    <td className="text-stone-700">{exp.description ?? "—"}</td>
                    <td className="td-right font-semibold text-stone-800 tabular-nums">
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
            <div role="alert" className="flex items-start gap-2 px-3.5 py-2.5 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" strokeWidth={2} />
              {expErr}
            </div>
          )}
          <div>
            <label className="form-label">Category *</label>
            <select
              required
              value={expForm.category}
              onChange={(e) =>
                setExpForm((f) => ({ ...f, category: e.target.value }))
              }
              className="form-input"
            >
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
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
          <div className="flex justify-end gap-3 pt-2 border-t border-stone-100">
            <button
              type="button"
              onClick={() => setExpModal(false)}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={addExpense.isPending}
              className="btn-primary"
            >
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
