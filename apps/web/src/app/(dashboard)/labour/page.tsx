"use client";

import { useState, FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useActiveProject } from "@/hooks/useActiveProject";
import { labourApi, AttendanceManual } from "@/services/labour";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { formatCurrency } from "@/lib/utils";

const today = new Date().toISOString().slice(0, 10);

export default function LabourPage() {
  const qc = useQueryClient();
  const { projectId, isLoading: projLoading } = useActiveProject();
  const [selectedDate, setSelectedDate] = useState(today);
  const [attModal, setAttModal] = useState(false);
  const [attForm, setAttForm] = useState<AttendanceManual>({
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

  // Build attendance map: worker_id -> attendance record
  const attMap = new Map(
    (attendance ?? []).map((a) => [a.worker_id, a])
  );

  const presentCount = [...attMap.values()].filter(
    (a) => a.status === "present" || a.status === "half_day"
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Labour</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {workers?.length ?? 0} workers registered
          </p>
        </div>
        <button
          onClick={() => {
            setAttForm({ worker_id: 0, attendance_date: selectedDate, status: "present" });
            setAttErr(null);
            setAttModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Mark Attendance
        </button>
      </div>

      {/* Workers table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-200">
          <h2 className="text-sm font-semibold text-slate-700">Registered Workers</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-500 uppercase">Worker</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Code</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Skill</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Daily Rate</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Phone</th>
              </tr>
            </thead>
            <tbody>
              {(workers ?? []).map((w) => (
                <tr key={w.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700 flex-shrink-0">
                        {w.full_name.charAt(0)}
                      </div>
                      <span className="font-medium text-slate-800">{w.full_name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">{w.worker_code}</td>
                  <td className="px-4 py-3">
                    <Badge label={w.skill_type} variant="default" />
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-slate-800">
                    {formatCurrency(w.daily_rate)}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{w.phone ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Attendance section */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-700">
              Attendance — {selectedDate}
            </h2>
            {attendance && (
              <p className="text-xs text-slate-500 mt-0.5">
                {presentCount} present / {workers?.length ?? 0} total
              </p>
            )}
          </div>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {attLoading ? (
          <div className="py-8 flex justify-center">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-500 uppercase">Worker</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Skill</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Status</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Check In</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">OT Hours</th>
                  <th className="text-right px-5 py-2.5 text-xs font-semibold text-slate-500 uppercase">Action</th>
                </tr>
              </thead>
              <tbody>
                {(workers ?? []).map((w) => {
                  const att = attMap.get(w.id);
                  return (
                    <tr key={w.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-5 py-3 font-medium text-slate-800">{w.full_name}</td>
                      <td className="px-4 py-3 text-slate-600">{w.skill_type}</td>
                      <td className="px-4 py-3">
                        {att ? (
                          <Badge label={att.status} variant={att.status} />
                        ) : (
                          <span className="text-slate-400 text-xs">Not marked</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {att?.check_in_time?.slice(0, 5) ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600">
                        {att ? `${att.overtime_hours}h` : "—"}
                      </td>
                      <td className="px-5 py-3 text-right">
                        {att ? (
                          <span className="text-xs text-slate-400 italic">Recorded</span>
                        ) : (
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => quickMark(w.id, "present")}
                              disabled={markAtt.isPending}
                              className="px-2.5 py-1 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded border border-green-200 transition-colors disabled:opacity-50"
                            >
                              Present
                            </button>
                            <button
                              onClick={() => quickMark(w.id, "absent")}
                              disabled={markAtt.isPending}
                              className="px-2.5 py-1 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded border border-red-200 transition-colors disabled:opacity-50"
                            >
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
            <div className="px-3 py-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
              {attErr}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Worker *
            </label>
            <select
              required
              value={attForm.worker_id || ""}
              onChange={(e) =>
                setAttForm((f) => ({ ...f, worker_id: Number(e.target.value) }))
              }
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Date *
              </label>
              <input
                type="date"
                required
                value={attForm.attendance_date}
                onChange={(e) =>
                  setAttForm((f) => ({ ...f, attendance_date: e.target.value }))
                }
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Status *
              </label>
              <select
                value={attForm.status}
                onChange={(e) =>
                  setAttForm((f) => ({
                    ...f,
                    status: e.target.value as AttendanceManual["status"],
                  }))
                }
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="present">Present</option>
                <option value="absent">Absent</option>
                <option value="half_day">Half Day</option>
                <option value="leave">Leave</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Overtime Hours
            </label>
            <input
              type="number"
              min={0}
              step={0.5}
              value={attForm.overtime_hours ?? ""}
              onChange={(e) =>
                setAttForm((f) => ({
                  ...f,
                  overtime_hours: e.target.value
                    ? Number(e.target.value)
                    : undefined,
                }))
              }
              placeholder="0"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setAttModal(false)}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={markAtt.isPending}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg transition-colors flex items-center gap-2"
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
