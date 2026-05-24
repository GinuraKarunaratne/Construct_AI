"use client";

import { useState, FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useActiveProject } from "@/hooks/useActiveProject";
import { labourApi } from "@/services/labour";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { formatCurrency } from "@/lib/utils";

export default function PayrollPage() {
  const qc = useQueryClient();
  const { projectId, isLoading: projLoading } = useActiveProject();
  const [genModal, setGenModal] = useState(false);
  const [detailRunId, setDetailRunId] = useState<number | null>(null);
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [genErr, setGenErr] = useState<string | null>(null);

  const { data: runs, isLoading } = useQuery({
    queryKey: ["payroll-runs", projectId],
    queryFn: () => labourApi.payrollRuns(projectId!),
    enabled: !!projectId,
  });

  const { data: detailRun } = useQuery({
    queryKey: ["payroll-run", detailRunId],
    queryFn: () => labourApi.getPayrollRun(detailRunId!),
    enabled: !!detailRunId,
  });

  const { data: workers } = useQuery({
    queryKey: ["workers", projectId],
    queryFn: () => labourApi.workers(projectId!),
    enabled: !!projectId,
  });

  const generate = useMutation({
    mutationFn: () => labourApi.generatePayroll(projectId!, periodStart, periodEnd),
    onSuccess: (run) => {
      qc.invalidateQueries({ queryKey: ["payroll-runs", projectId] });
      setGenModal(false);
      setGenErr(null);
      setDetailRunId(run.id);
    },
    onError: (e: unknown) => {
      setGenErr(
        (e as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? "Failed to generate payroll"
      );
    },
  });

  const approve = useMutation({
    mutationFn: labourApi.approvePayrollRun,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payroll-runs", projectId] });
      qc.invalidateQueries({ queryKey: ["payroll-run", detailRunId] });
    },
  });

  function handleGenSubmit(e: FormEvent) {
    e.preventDefault();
    setGenErr(null);
    generate.mutate();
  }

  if (projLoading || isLoading) return <LoadingSpinner message="Loading payroll…" />;

  const workerMap = new Map((workers ?? []).map((w) => [w.id, w]));

  // Compute totals for a run's lines if available
  const runTotal = detailRun?.lines
    ? detailRun.lines.reduce((sum, l) => sum + l.net_pay, 0)
    : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Payroll</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {runs?.length ?? 0} payroll run{runs?.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => { setGenErr(null); setGenModal(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Generate Payroll
        </button>
      </div>

      {/* Runs list */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-200">
          <h2 className="text-sm font-semibold text-slate-700">Payroll Runs</h2>
        </div>
        {(runs ?? []).length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-sm">
            No payroll runs yet. Click "Generate Payroll" to start.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-500 uppercase">Period</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Status</th>
                <th className="text-right px-5 py-2.5 text-xs font-semibold text-slate-500 uppercase">Action</th>
              </tr>
            </thead>
            <tbody>
              {(runs ?? []).map((run) => (
                <tr key={run.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-5 py-3">
                    <p className="font-medium text-slate-800">
                      {run.period_start} → {run.period_end}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Run #{run.id}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <Badge label={run.status} variant={run.status} />
                  </td>
                  <td className="px-5 py-3 text-right flex justify-end gap-2">
                    <button
                      onClick={() => setDetailRunId(run.id)}
                      className="px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded border border-blue-200 transition-colors"
                    >
                      View
                    </button>
                    {run.status === "draft" && (
                      <button
                        onClick={() => approve.mutate(run.id)}
                        disabled={approve.isPending}
                        className="px-3 py-1.5 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded border border-green-600 transition-colors disabled:opacity-60"
                      >
                        Approve
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Payroll detail */}
      {detailRun && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-700">
                Payroll Detail — {detailRun.period_start} to {detailRun.period_end}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Status: <Badge label={detailRun.status} variant={detailRun.status} />
              </p>
            </div>
            {runTotal != null && (
              <div className="text-right">
                <p className="text-xs text-slate-400">Total Net Pay</p>
                <p className="text-lg font-bold text-slate-800">
                  {formatCurrency(runTotal)}
                </p>
              </div>
            )}
          </div>
          {detailRun.lines && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-500 uppercase">Worker</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Days</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">OT Hours</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Gross Pay</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Advances</th>
                    <th className="text-right px-5 py-2.5 text-xs font-semibold text-slate-500 uppercase">Net Pay</th>
                  </tr>
                </thead>
                <tbody>
                  {detailRun.lines.map((line) => {
                    const w = workerMap.get(line.worker_id);
                    return (
                      <tr key={line.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-5 py-3">
                          <p className="font-medium text-slate-800">{w?.full_name ?? `Worker #${line.worker_id}`}</p>
                          <p className="text-xs text-slate-400">{w?.skill_type}</p>
                        </td>
                        <td className="px-4 py-3 text-right text-slate-700">{line.days_worked}</td>
                        <td className="px-4 py-3 text-right text-slate-700">{line.overtime_hours}h</td>
                        <td className="px-4 py-3 text-right text-slate-700">{formatCurrency(line.gross_pay)}</td>
                        <td className="px-4 py-3 text-right text-amber-600">
                          {line.advances > 0 ? `-${formatCurrency(line.advances)}` : "—"}
                        </td>
                        <td className="px-5 py-3 text-right font-semibold text-slate-900">
                          {formatCurrency(line.net_pay)}
                        </td>
                      </tr>
                    );
                  })}
                  {/* Total row */}
                  <tr className="border-t-2 border-slate-200 bg-slate-50">
                    <td className="px-5 py-3 font-semibold text-slate-700" colSpan={5}>
                      Total
                    </td>
                    <td className="px-5 py-3 text-right font-bold text-slate-900">
                      {formatCurrency(runTotal ?? 0)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Generate Modal */}
      <Modal
        open={genModal}
        onClose={() => setGenModal(false)}
        title="Generate Payroll"
      >
        <form onSubmit={handleGenSubmit} className="space-y-4">
          {genErr && (
            <div className="px-3 py-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
              {genErr}
            </div>
          )}
          <p className="text-sm text-slate-600">
            Payroll is calculated from actual attendance records for the selected
            period. Workers are paid based on days present plus overtime.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Period Start *
              </label>
              <input
                type="date"
                required
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Period End *
              </label>
              <input
                type="date"
                required
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setGenModal(false)}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={generate.isPending}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg transition-colors flex items-center gap-2"
            >
              {generate.isPending && (
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              Generate
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
