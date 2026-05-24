"use client";

import { useState, FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useActiveProject } from "@/hooks/useActiveProject";
import { labourApi } from "@/services/labour";
import { LoadingSpinner, EmptyState } from "@/components/ui/LoadingSpinner";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { formatCurrency } from "@/lib/utils";
import { Plus, Banknote, AlertTriangle, CheckCircle2, FileText, Users } from "lucide-react";

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

  const runTotal = detailRun?.lines
    ? detailRun.lines.reduce((sum, l) => sum + l.net_pay, 0)
    : null;

  // Summary stats from run list
  const approvedRuns = (runs ?? []).filter((r) => r.status === "approved").length;
  const draftRuns    = (runs ?? []).filter((r) => r.status === "draft").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="page-title">Payroll</h1>
          <p className="page-subtitle">
            {runs?.length ?? 0} payroll run{runs?.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => { setGenErr(null); setGenModal(true); }}
          className="btn-primary"
        >
          <Plus className="w-4 h-4" strokeWidth={2.5} />
          Generate Payroll
        </button>
      </div>

      {/* Summary chips */}
      {(runs ?? []).length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            {
              label: "Total Runs",
              value: String(runs?.length ?? 0),
              icon: FileText,
              bg: "bg-stone-50 border-stone-200 text-stone-700",
              iconBg: "bg-stone-100 text-stone-500",
            },
            {
              label: "Approved",
              value: String(approvedRuns),
              icon: CheckCircle2,
              bg: "bg-green-50 border-green-200 text-green-800",
              iconBg: "bg-green-100 text-green-600",
            },
            {
              label: "Draft",
              value: String(draftRuns),
              icon: FileText,
              bg: "bg-amber-50 border-amber-200 text-amber-800",
              iconBg: "bg-amber-100 text-amber-600",
            },
            {
              label: "Workers Registered",
              value: String(workers?.length ?? 0),
              icon: Users,
              bg: "bg-brand-50 border-brand-200 text-brand-800",
              iconBg: "bg-brand-100 text-brand-600",
            },
          ].map((chip) => (
            <div
              key={chip.label}
              className={`flex items-center gap-3 px-4 py-3 rounded-2xl border shadow-sm ${chip.bg}`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${chip.iconBg}`}>
                <chip.icon className="w-4 h-4" strokeWidth={2} />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide opacity-60">
                  {chip.label}
                </p>
                <p className="text-xl font-bold leading-tight">{chip.value}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Runs list */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Payroll Runs</h2>
          <span className="text-xs text-stone-400">{runs?.length ?? 0} total</span>
        </div>
        {(runs ?? []).length === 0 ? (
          <EmptyState
            icon={<Banknote className="w-5 h-5" />}
            title="No payroll runs yet"
            description='Click "Generate Payroll" to create your first run.'
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Run</th>
                  <th>Period</th>
                  <th>Status</th>
                  <th className="th-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(runs ?? []).map((run) => (
                  <tr key={run.id}>
                    <td className="font-mono text-xs text-stone-400">
                      #{run.id}
                    </td>
                    <td>
                      <p className="font-semibold text-stone-800">
                        {run.period_start} → {run.period_end}
                      </p>
                    </td>
                    <td>
                      <Badge label={run.status} variant={run.status} />
                    </td>
                    <td className="td-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setDetailRunId(run.id)}
                          className="inline-flex items-center px-3 py-1.5 text-xs font-semibold text-brand-600 hover:text-white hover:bg-brand-600 rounded-lg border border-brand-200 hover:border-brand-600 transition-colors duration-150"
                        >
                          View Details
                        </button>
                        {run.status === "draft" && (
                          <button
                            onClick={() => approve.mutate(run.id)}
                            disabled={approve.isPending}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg border border-green-600 transition-colors disabled:opacity-50"
                          >
                            <CheckCircle2 className="w-3 h-3" strokeWidth={2.5} />
                            Approve
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payroll detail */}
      {detailRun && (
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">
                Payroll Detail
                <span className="ml-2 font-normal text-stone-400 text-xs">
                  {detailRun.period_start} → {detailRun.period_end}
                </span>
              </h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-stone-400">Status:</span>
                <Badge label={detailRun.status} variant={detailRun.status} />
              </div>
            </div>
            {runTotal != null && (
              <div className="text-right">
                <p className="text-xs text-stone-400">Total Net Pay</p>
                <p className="text-lg font-bold text-stone-900">
                  {formatCurrency(runTotal)}
                </p>
              </div>
            )}
          </div>
          {detailRun.lines && (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Worker</th>
                    <th className="th-right">Days</th>
                    <th className="th-right">OT Hours</th>
                    <th className="th-right">Gross Pay</th>
                    <th className="th-right">Advances</th>
                    <th className="th-right">Net Pay</th>
                  </tr>
                </thead>
                <tbody>
                  {detailRun.lines.map((line) => {
                    const w = workerMap.get(line.worker_id);
                    return (
                      <tr key={line.id}>
                        <td>
                          <p className="font-semibold text-stone-800">
                            {w?.full_name ?? `Worker #${line.worker_id}`}
                          </p>
                          <p className="text-xs text-stone-400">{w?.skill_type}</p>
                        </td>
                        <td className="td-right text-stone-700 tabular-nums">
                          {line.days_worked}
                        </td>
                        <td className="td-right text-stone-700 tabular-nums">
                          {line.overtime_hours}h
                        </td>
                        <td className="td-right text-stone-700 tabular-nums">
                          {formatCurrency(line.gross_pay)}
                        </td>
                        <td className="td-right tabular-nums">
                          {line.advances > 0 ? (
                            <span className="text-amber-600 font-medium">
                              -{formatCurrency(line.advances)}
                            </span>
                          ) : (
                            <span className="text-stone-400">—</span>
                          )}
                        </td>
                        <td className="td-right font-semibold text-stone-900 tabular-nums">
                          {formatCurrency(line.net_pay)}
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="border-t-2 border-stone-200 bg-stone-50">
                    <td className="px-5 py-3 font-semibold text-stone-700" colSpan={5}>
                      Total
                    </td>
                    <td className="px-5 py-3 text-right font-bold text-stone-900 tabular-nums">
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
      <Modal open={genModal} onClose={() => setGenModal(false)} title="Generate Payroll">
        <form onSubmit={handleGenSubmit} className="space-y-4">
          {genErr && (
            <div role="alert" className="flex items-start gap-2 px-3.5 py-2.5 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" strokeWidth={2} />
              {genErr}
            </div>
          )}
          <p className="text-sm text-stone-500 leading-relaxed">
            Payroll is calculated from actual attendance records for the selected
            period. Workers are paid based on days present plus overtime.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Period Start *</label>
              <input
                type="date"
                required
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
                className="form-input"
              />
            </div>
            <div>
              <label className="form-label">Period End *</label>
              <input
                type="date"
                required
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                className="form-input"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-stone-100">
            <button
              type="button"
              onClick={() => setGenModal(false)}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={generate.isPending}
              className="btn-primary"
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
