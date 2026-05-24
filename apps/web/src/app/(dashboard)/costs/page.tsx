"use client";

import { useState, FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useActiveProject } from "@/hooks/useActiveProject";
import { costsApi, ExpenseCreate } from "@/services/costs";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Modal } from "@/components/ui/Modal";
import { formatCurrency } from "@/lib/utils";

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
      : "bg-blue-500";

  // Group expenses by category
  const expByCategory: Record<string, number> = {};
  (expenses ?? []).forEach((e) => {
    expByCategory[e.category] = (expByCategory[e.category] ?? 0) + e.amount;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Costs</h1>
          <p className="text-sm text-slate-500 mt-0.5">Budget tracking and cost prediction</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => runPrediction.mutate()}
            disabled={runPrediction.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {runPrediction.isPending ? (
              <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            )}
            Run Prediction
          </button>
          <button
            onClick={() => { setExpErr(null); setExpModal(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Expense
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Budget", value: summary.total_budget, color: "text-slate-800" },
          { label: "Actual Cost to Date", value: summary.actual_cost_to_date, color: "text-blue-700" },
          { label: "Remaining Budget", value: summary.remaining_budget, color: summary.remaining_budget < 0 ? "text-red-600" : "text-green-700" },
          { label: "Budget Used", value: null, pct: summary.budget_used_pct, color: "text-slate-800" },
        ].map((card) => (
          <div key={card.label} className="bg-white rounded-xl border border-slate-200 p-5">
            <p className="text-xs text-slate-400 uppercase font-semibold mb-1">
              {card.label}
            </p>
            {card.value != null ? (
              <p className={`text-xl font-bold ${card.color}`}>
                {formatCurrency(card.value)}
              </p>
            ) : (
              <div>
                <p className={`text-xl font-bold ${card.color}`}>
                  {card.pct?.toFixed(1)}%
                </p>
                <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2">
                  <div
                    className={`${budgetColor} h-1.5 rounded-full`}
                    style={{ width: `${budgetUsedWidth}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* AI Prediction widget */}
      {prediction && (
        <div
          className={`rounded-xl border p-5 ${
            prediction.overrun_risk
              ? "bg-red-50 border-red-200"
              : "bg-green-50 border-green-200"
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className={`font-semibold ${prediction.overrun_risk ? "text-red-800" : "text-green-800"}`}>
                {prediction.overrun_risk
                  ? "⚠ Budget Overrun Risk Detected"
                  : "✓ Project on Budget"}
              </h3>
              <p className={`text-sm mt-1 ${prediction.overrun_risk ? "text-red-600" : "text-green-600"}`}>
                {prediction.notes}
              </p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-xs text-slate-500 mb-1">Predicted Final Cost</p>
              <p className={`text-xl font-bold ${prediction.overrun_risk ? "text-red-700" : "text-green-700"}`}>
                {formatCurrency(prediction.predicted_final_cost)}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                Confidence: {prediction.confidence_score}% · {prediction.model_version}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Budget items vs actual */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Budget Allocation */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">
            Budget Allocation
          </h2>
          <div className="space-y-3">
            {(budgetItems ?? []).map((item) => {
              const pct = summary.total_budget
                ? (item.estimated_amount / summary.total_budget) * 100
                : 0;
              return (
                <div key={item.id}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium text-slate-700">{item.category}</span>
                    <span className="text-slate-500">
                      {formatCurrency(item.estimated_amount)}
                      <span className="text-slate-400 ml-1">({pct.toFixed(0)}%)</span>
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2">
                    <div
                      className="bg-blue-400 h-2 rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Cost breakdown */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">
            Actual Cost Breakdown
          </h2>
          <div className="space-y-4">
            {[
              { label: "Materials", value: summary.material_cost, color: "bg-blue-400" },
              { label: "Labour",    value: summary.labour_cost,   color: "bg-purple-400" },
              { label: "Other",     value: summary.other_cost,    color: "bg-orange-400" },
            ].map((row) => {
              const pct = summary.actual_cost_to_date
                ? (row.value / summary.actual_cost_to_date) * 100
                : 0;
              return (
                <div key={row.label}>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="font-medium text-slate-700">{row.label}</span>
                    <span className="text-slate-500">
                      {formatCurrency(row.value)}{" "}
                      <span className="text-slate-400">({pct.toFixed(0)}%)</span>
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-3">
                    <div
                      className={`${row.color} h-3 rounded-full`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
            <div className="pt-2 border-t border-slate-100 flex justify-between text-sm font-semibold text-slate-800">
              <span>Total</span>
              <span>{formatCurrency(summary.actual_cost_to_date)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Expenses Table */}
      {expenses && expenses.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">Expenses</h2>
            <span className="text-xs text-slate-400">
              {expenses.length} records
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-500 uppercase">Date</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Category</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Description</th>
                  <th className="text-right px-5 py-2.5 text-xs font-semibold text-slate-500 uppercase">Amount</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((exp) => (
                  <tr key={exp.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-5 py-3 text-slate-600">{exp.expense_date}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full text-xs font-medium">
                        {exp.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{exp.description ?? "—"}</td>
                    <td className="px-5 py-3 text-right font-medium text-slate-800">
                      {formatCurrency(exp.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Expense Modal */}
      <Modal open={expModal} onClose={() => setExpModal(false)} title="Add Expense">
        <form onSubmit={handleExpSubmit} className="space-y-4">
          {expErr && (
            <div className="px-3 py-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
              {expErr}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Category *
            </label>
            <select
              required
              value={expForm.category}
              onChange={(e) =>
                setExpForm((f) => ({ ...f, category: e.target.value }))
              }
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Description
            </label>
            <input
              value={expForm.description ?? ""}
              onChange={(e) =>
                setExpForm((f) => ({ ...f, description: e.target.value }))
              }
              placeholder="e.g. Concrete mixer rental"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Amount (LKR) *
              </label>
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
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Date *
              </label>
              <input
                type="date"
                required
                value={expForm.expense_date}
                onChange={(e) =>
                  setExpForm((f) => ({ ...f, expense_date: e.target.value }))
                }
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setExpModal(false)}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={addExpense.isPending}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg transition-colors flex items-center gap-2"
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
