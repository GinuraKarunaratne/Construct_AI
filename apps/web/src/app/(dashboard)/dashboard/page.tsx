"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useActiveProject } from "@/hooks/useActiveProject";
import { projectsApi } from "@/services/projects";
import { alertsApi } from "@/services/alerts";
import { costsApi } from "@/services/costs";
import { StatCard } from "@/components/ui/StatCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";

const SEVERITY_STYLES = {
  critical: "bg-red-50 border-red-200 text-red-800",
  warning:  "bg-amber-50 border-amber-200 text-amber-800",
  info:     "bg-blue-50 border-blue-200 text-blue-700",
};
const SEVERITY_DOT = {
  critical: "bg-red-500",
  warning:  "bg-amber-400",
  info:     "bg-blue-500",
};

export default function DashboardPage() {
  const qc = useQueryClient();
  const { projectId, isLoading: projLoading } = useActiveProject();

  const { data: dash, isLoading: dashLoading } = useQuery({
    queryKey: ["dashboard", projectId],
    queryFn: () => projectsApi.dashboard(projectId!),
    enabled: !!projectId,
  });

  const { data: alerts } = useQuery({
    queryKey: ["alerts", projectId],
    queryFn: () => alertsApi.list(projectId!),
    enabled: !!projectId,
  });

  const { data: pred } = useQuery({
    queryKey: ["prediction", projectId],
    queryFn: () => costsApi.latestPrediction(projectId!),
    enabled: !!projectId,
  });

  const markRead = useMutation({
    mutationFn: alertsApi.markRead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["alerts", projectId] });
    },
  });

  if (projLoading || dashLoading) return <LoadingSpinner message="Loading dashboard…" />;
  if (!dash) return null;

  const p = dash.project;
  const totalDays =
    p.planned_start_date && p.planned_end_date
      ? Math.round(
          (new Date(p.planned_end_date).getTime() -
            new Date(p.planned_start_date).getTime()) /
            86_400_000
        )
      : 120;

  const daysPassed = p.planned_start_date
    ? Math.max(
        0,
        Math.round(
          (Date.now() - new Date(p.planned_start_date).getTime()) / 86_400_000
        )
      )
    : 0;

  const stats = [
    {
      label: "Total Budget",
      value: formatCurrency(dash.total_budget),
      sub: p.name,
      icon: "budget",
      color: "blue" as const,
    },
    {
      label: "Actual Cost to Date",
      value: formatCurrency(dash.actual_cost_to_date),
      sub: `${dash.budget_used_pct.toFixed(1)}% of budget used`,
      icon: "cost",
      color: dash.budget_used_pct > 80 ? ("red" as const) : ("green" as const),
    },
    {
      label: "Schedule Progress",
      value: `${dash.progress_pct.toFixed(0)}%`,
      sub: `Day ${Math.min(daysPassed, totalDays)} of ${totalDays}`,
      icon: "schedule",
      color: "purple" as const,
    },
    {
      label: "Open Alerts",
      value: String(dash.open_alerts),
      sub: `${alerts?.filter((a) => a.severity === "critical").length ?? 0} critical`,
      icon: "alert",
      color: dash.open_alerts > 0 ? ("red" as const) : ("green" as const),
    },
    {
      label: "Today's Attendance",
      value: `${dash.today_attendance} / ${dash.workers_count}`,
      sub: `${dash.workers_count - dash.today_attendance} absent today`,
      icon: "labour",
      color: "indigo" as const,
    },
    {
      label: "Low Stock Materials",
      value: String(dash.low_stock_count),
      sub: dash.low_stock_count > 0 ? "Reorder required" : "Stock OK",
      icon: "material",
      color: dash.low_stock_count > 0 ? ("amber" as const) : ("green" as const),
    },
  ];

  const unreadAlerts = (alerts ?? []).filter((a) => !a.is_read).slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Project Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {p.location_name ?? p.name}
          </p>
        </div>
        <Link
          href="/alerts"
          className="text-sm text-blue-600 hover:text-blue-800 font-medium"
        >
          View all alerts →
        </Link>
      </div>

      {/* Unread alerts */}
      {unreadAlerts.length > 0 && (
        <div className="space-y-2">
          {unreadAlerts.map((a) => (
            <div
              key={a.id}
              className={`flex items-start gap-3 px-4 py-3 rounded-lg border text-sm ${
                SEVERITY_STYLES[a.severity] ?? SEVERITY_STYLES.info
              }`}
            >
              <span
                className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${
                  SEVERITY_DOT[a.severity] ?? SEVERITY_DOT.info
                }`}
              />
              <div className="flex-1 min-w-0">
                <p className="font-semibold">{a.title}</p>
                <p className="opacity-80 mt-0.5">{a.message}</p>
              </div>
              <button
                onClick={() => markRead.mutate(a.id)}
                className="text-xs opacity-60 hover:opacity-100 flex-shrink-0"
              >
                Dismiss
              </button>
            </div>
          ))}
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {stats.map((s) => (
          <StatCard key={s.label} {...s} />
        ))}
      </div>

      {/* Tasks + Cost breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Task Progress */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-700">
              Task Progress
            </h2>
            <Link
              href="/schedule"
              className="text-xs text-blue-600 hover:text-blue-800"
            >
              View Gantt →
            </Link>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">Completed</span>
              <span className="font-medium text-green-600">
                {dash.completed_tasks} / {dash.task_count}
              </span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2">
              <div
                className="bg-green-500 h-2 rounded-full"
                style={{
                  width: `${
                    dash.task_count
                      ? (dash.completed_tasks / dash.task_count) * 100
                      : 0
                  }%`,
                }}
              />
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
                {dash.delayed_tasks} delayed
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-slate-300 inline-block" />
                {dash.task_count - dash.completed_tasks - dash.delayed_tasks}{" "}
                pending
              </span>
            </div>
          </div>
        </div>

        {/* Cost Breakdown */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-700">
              Cost Breakdown
            </h2>
            <Link
              href="/costs"
              className="text-xs text-blue-600 hover:text-blue-800"
            >
              Full report →
            </Link>
          </div>
          <div className="space-y-2.5">
            {[
              { label: "Materials", value: dash.material_cost, color: "bg-blue-400" },
              { label: "Labour",    value: dash.labour_cost,   color: "bg-purple-400" },
              { label: "Other",     value: dash.other_cost,    color: "bg-orange-400" },
            ].map((row) => (
              <div key={row.label}>
                <div className="flex justify-between text-xs text-slate-600 mb-1">
                  <span>{row.label}</span>
                  <span className="font-medium">{formatCurrency(row.value)}</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-1.5">
                  <div
                    className={`${row.color} h-1.5 rounded-full`}
                    style={{
                      width: `${
                        dash.actual_cost_to_date
                          ? Math.min(
                              (row.value / dash.actual_cost_to_date) * 100,
                              100
                            )
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
          {pred && (
            <div
              className={`mt-4 px-3 py-2 rounded-lg text-xs ${
                pred.overrun_risk
                  ? "bg-red-50 text-red-700"
                  : "bg-green-50 text-green-700"
              }`}
            >
              <span className="font-medium">
                {pred.overrun_risk ? "⚠ Budget overrun risk" : "✓ On budget"}
              </span>
              {" — "}Predicted final:{" "}
              <span className="font-semibold">
                {formatCurrency(pred.predicted_final_cost)}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
