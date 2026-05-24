"use client";

import { useState, FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useActiveProject } from "@/hooks/useActiveProject";
import { labourApi, AttendanceManual } from "@/services/labour";
import { LoadingSpinner, EmptyState } from "@/components/ui/LoadingSpinner";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { formatCurrency } from "@/lib/utils";
import { Plus, Check, X, AlertTriangle, Search } from "lucide-react";

const today = new Date().toISOString().slice(0, 10);

export default function LabourPage() {
  const qc = useQueryClient();
  const { projectId, isLoading: projLoading } = useActiveProject();

  const [selectedDate, setSelectedDate] = useState(today);
  const [workerSearch, setWorkerSearch] = useState("");
  const [attModal, setAttModal] = useState(false);
  const [attForm, setAttForm]   = useState<AttendanceManual>({
    worker_id: 0,
    attendance_date: today,
    status: "present",
  });
  const [attErr, setAttErr] = useState<string | null>(null);

  const { data: workers, isLoading: workersLoading } = useQuery({
    queryKey: ["workers", projectId],
    queryFn: () => labourApi.workers(projectId!),
    enabled: !!projectId,
  });

  const { data: attendance, isLoading: attLoading } = useQuery({
    queryKey: ["attendance", projectId, selectedDate],
    queryFn: () => labourApi.attendance(projectId!, selectedDate),
    enabled: !!projectId,
  });

  const markAtt = useMutation({
    mutationFn: (data: AttendanceManual) =>
      labourApi.markAttendance(projectId!, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance", projectId] });
      setAttModal(false);
      setAttErr(null);
    },
    onError: (e: unknown) => {
      setAttErr(
        (e as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? "Failed to record attendance"
      );
    },
  });

  function quickMark(workerId: number, status: "present" | "absent") {
    setAttErr(null);
    markAtt.mutate({ worker_id: workerId, attendance_date: selectedDate, status });
  }

  function handleAttSubmit(e: FormEvent) {
    e.preventDefault();
    setAttErr(null);
    markAtt.mutate(attForm);
  }

  if (projLoading || workersLoading) return <LoadingSpinner message="Loading labour data…" />;

  const attMap = new Map((attendance ?? []).map((a) => [a.worker_id, a]));
  const presentCount = [...attMap.values()].filter(
    (a) => a.status === "present" || a.status === "half_day"
  ).length;

  const filteredWorkers = (workers ?? []).filter((w) => {
    const q = workerSearch.toLowerCase();
    return !q || w.full_name.toLowerCase().includes(q) || w.worker_code.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="page-title">Labour</h1>
          <p className="page-subtitle">
            {workers?.length ?? 0} workers registered
          </p>
        </div>
        <button
          onClick={() => {
            setAttForm({ worker_id: 0, attendance_date: selectedDate, status: "present" });
            setAttErr(null);
            setAttModal(true);
          }}
          className="btn-primary"
        >
          <Plus className="w-4 h-4" strokeWidth={2.5} />
          Mark Attendance
        </button>
      </div>

      {/* Workers table */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Registered Workers</h2>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400 pointer-events-none" />
              <input
                type="search"
                placeholder="Search workers…"
                value={workerSearch}
                onChange={(e) => setWorkerSearch(e.target.value)}
                className="search-input"
              />
            </div>
            <span className="text-xs text-stone-400 whitespace-nowrap">
              {filteredWorkers.length} of {workers?.length ?? 0}
            </span>
          </div>
        </div>
        {(workers ?? []).length === 0 ? (
          <EmptyState title="No workers registered" description="Add workers to start tracking labour." />
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Worker</th>
                  <th>Code</th>
                  <th>Skill</th>
                  <th className="th-right">Daily Rate</th>
                  <th>Phone</th>
                </tr>
              </thead>
              <tbody>
                {filteredWorkers.map((w) => (
                  <tr key={w.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full bg-brand-100 border border-brand-200 flex items-center justify-center text-xs font-bold text-brand-700 flex-shrink-0">
                          {w.full_name.charAt(0)}
                        </div>
                        <span className="font-semibold text-stone-800">{w.full_name}</span>
                      </div>
                    </td>
                    <td className="font-mono text-xs text-stone-500">{w.worker_code}</td>
                    <td>
                      <Badge label={w.skill_type} variant="default" />
                    </td>
                    <td className="td-right font-semibold text-stone-800 tabular-nums">
                      {formatCurrency(w.daily_rate)}
                    </td>
                    <td className="text-stone-500">{w.phone ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Attendance section */}
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">
              Attendance
              <span className="ml-2 font-normal text-stone-400 text-xs">
                {selectedDate}
              </span>
            </h2>
            {!attLoading && (
              <p className="text-xs text-stone-400 mt-0.5">
                {presentCount} present / {workers?.length ?? 0} total
              </p>
            )}
          </div>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="form-input !w-auto text-xs"
          />
        </div>

        {attLoading ? (
          <div className="py-8 flex justify-center">
            <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Worker</th>
                  <th>Skill</th>
                  <th>Status</th>
                  <th>Check In</th>
                  <th className="th-right">OT Hours</th>
                  <th className="th-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {(workers ?? []).map((w) => {
                  const att = attMap.get(w.id);
                  return (
                    <tr key={w.id}>
                      <td className="font-semibold text-stone-800">{w.full_name}</td>
                      <td className="text-stone-500 text-xs">{w.skill_type}</td>
                      <td>
                        {att ? (
                          <Badge label={att.status} variant={att.status} />
                        ) : (
                          <span className="text-xs text-stone-400 italic">Not marked</span>
                        )}
                      </td>
                      <td className="text-stone-500 tabular-nums text-xs">
                        {att?.check_in_time?.slice(0, 5) ?? "—"}
                      </td>
                      <td className="td-right text-stone-500 text-xs tabular-nums">
                        {att ? `${att.overtime_hours}h` : "—"}
                      </td>
                      <td className="td-right">
                        {att ? (
                          <span className="text-xs text-stone-400 italic">Recorded</span>
                        ) : (
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => quickMark(w.id, "present")}
                              disabled={markAtt.isPending}
                              aria-label={`Mark ${w.full_name} present`}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-green-700 bg-green-50 hover:bg-green-100 rounded-lg border border-green-200 transition-colors disabled:opacity-50"
                            >
                              <Check className="w-3 h-3" strokeWidth={2.5} />
                              Present
                            </button>
                            <button
                              onClick={() => quickMark(w.id, "absent")}
                              disabled={markAtt.isPending}
                              aria-label={`Mark ${w.full_name} absent`}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg border border-red-200 transition-colors disabled:opacity-50"
                            >
                              <X className="w-3 h-3" strokeWidth={2.5} />
                              Absent
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Manual Attendance Modal */}
      <Modal
        open={attModal}
        onClose={() => setAttModal(false)}
        title="Record Attendance"
      >
        <form onSubmit={handleAttSubmit} className="space-y-4">
          {attErr && (
            <div role="alert" className="flex items-start gap-2 px-3.5 py-2.5 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" strokeWidth={2} />
              {attErr}
            </div>
          )}
          <div>
            <label className="form-label">Worker *</label>
            <select
              required
              value={attForm.worker_id || ""}
              onChange={(e) =>
                setAttForm((f) => ({ ...f, worker_id: Number(e.target.value) }))
              }
              className="form-input"
            >
              <option value="">Select worker…</option>
              {(workers ?? []).map((w) => (
                <option key={w.id} value={w.id}>
                  {w.full_name} ({w.worker_code})
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Date *</label>
              <input
                type="date"
                required
                value={attForm.attendance_date}
                onChange={(e) =>
                  setAttForm((f) => ({ ...f, attendance_date: e.target.value }))
                }
                className="form-input"
              />
            </div>
            <div>
              <label className="form-label">Status *</label>
              <select
                value={attForm.status}
                onChange={(e) =>
                  setAttForm((f) => ({
                    ...f,
                    status: e.target.value as AttendanceManual["status"],
                  }))
                }
                className="form-input"
              >
                <option value="present">Present</option>
                <option value="absent">Absent</option>
                <option value="half_day">Half Day</option>
                <option value="leave">Leave</option>
              </select>
            </div>
          </div>
          <div>
            <label className="form-label">Overtime Hours</label>
            <input
              type="number"
              min={0}
              step={0.5}
              value={attForm.overtime_hours ?? ""}
              onChange={(e) =>
                setAttForm((f) => ({
                  ...f,
                  overtime_hours: e.target.value ? Number(e.target.value) : undefined,
                }))
              }
              placeholder="0"
              className="form-input"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-stone-100">
            <button
              type="button"
              onClick={() => setAttModal(false)}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={markAtt.isPending}
              className="btn-primary"
            >
              {markAtt.isPending && (
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              Save
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
