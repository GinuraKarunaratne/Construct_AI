"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useActiveProject } from "@/hooks/useActiveProject";
import { projectsApi } from "@/services/projects";
import { alertsApi } from "@/services/alerts";
import { costsApi } from "@/services/costs";
import { StatCard } from "@/components/ui/StatCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { formatCurrency, formatCompact } from "@/lib/utils";
import {
  Wallet,
  TrendingUp,
  CalendarClock,
  Bell,
  HardHat,
  PackageX,
  X,
  AlertTriangle,
  Info,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const SEVERITY_CONFIG = {
  critical: {
    bar:  "bg-red-500",
    card: "bg-red-50 border-red-200 text-red-900",
    icon: AlertTriangle,
    dot:  "bg-red-500",
    iconColor: "text-red-500",
  },
  warning: {
    bar:  "bg-amber-500",
    card: "bg-amber-50 border-amber-200 text-amber-900",
    icon: AlertTriangle,
    dot:  "bg-amber-500",
    iconColor: "text-amber-500",
  },
  info: {
    bar:  "bg-sky-500",
    card: "bg-sky-50 border-sky-200 text-sky-900",
    icon: Info,
    dot:  "bg-sky-500",
    iconColor: "text-sky-500",
  },
};

/** Per-alert-type quick action */
const ALERT_QUICK_ACTIONS: Record<string, { label: string; href: string }> = {
  low_stock:      { label: "View Materials", href: "/materials" },
  task_delayed:   { label: "View Schedule",  href: "/schedule"  },
  budget_overrun: { label: "View Costs",     href: "/costs"     },
  weather_risk:   { label: "View Schedule",  href: "/schedule"  },
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

  /** Project is past its end date but not complete */
  const isOverdue = p.planned_end_date
    ? Date.now() > new Date(p.planned_end_date).getTime() && dash.progress_pct < 99
    : false;

  /** Attendance not yet recorded vs genuinely absent */
  const attendanceRecorded = dash.today_attendance > 0;
  const attendanceSub = attendanceRecorded
    ? `${dash.workers_count - dash.today_attendance} absent today`
    : "Attendance not yet recorded";
  const attendanceTone = attendanceRecorded
    ? dash.today_attendance < dash.workers_count
      ? ("amber" as const)
      : ("green" as const)
    : ("neutral" as const);

  const stats = [
    {
      label: "Total Budget",
      value: formatCurrency(dash.total_budget),
      sub: p.name,
      tone: "orange" as const,
      Icon: Wallet,
    },
    {
      label: "Actual Cost to Date",
      value: formatCurrency(dash.actual_cost_to_date),
      sub: `${dash.budget_used_pct.toFixed(1)}% of budget used`,
      tone: dash.budget_used_pct > 80 ? ("red" as const) : ("green" as const),
      Icon: TrendingUp,
    },
    {
      label: "Schedule Progress",
      value: `${dash.progress_pct.toFixed(0)}%`,
      sub: isOverdue
        ? `Project overdue — only ${dash.progress_pct.toFixed(0)}% complete`
        : `Day ${Math.min(daysPassed, totalDays)} of ${totalDays}`,
      tone: isOverdue ? ("red" as const) : ("violet" as const),
      Icon: CalendarClock,
    },
    {
      label: "Open Alerts",
      value: String(dash.open_alerts),
      sub: `${alerts?.filter((a) => a.severity === "critical").length ?? 0} critical`,
      tone: dash.open_alerts > 0 ? ("red" as const) : ("green" as const),
      Icon: Bell,
    },
    {
      label: "Today's Attendance",
      value: `${dash.today_attendance} / ${dash.workers_count}`,
      sub: attendanceSub,
      tone: attendanceTone,
      Icon: HardHat,
    },
    {
      label: "Low Stock Materials",
      value: String(dash.low_stock_count),
      sub: dash.low_stock_count > 0 ? "Reorder required" : "Stock OK",
      tone: dash.low_stock_count > 0 ? ("amber" as const) : ("green" as const),
      Icon: PackageX,
    },
  ];

  const unreadAlerts = (alerts ?? []).filter((a) => !a.is_read).slice(0, 4);

  // Overrun amount for prediction
  const overrunAmount = pred ? pred.predicted_final_cost - dash.total_budget : 0;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="page-title">Project Dashboard</h1>
          <p className="page-subtitle">{p.location_name ?? p.name}</p>
        </div>
        <Link href="/alerts" className="section-link mt-1 whitespace-nowrap">
          View all alerts →
        </Link>
      </div>

      {/* Overdue critical banner */}
      {isOverdue && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-300 rounded-xl">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" strokeWidth={2} />
          <div>
            <p className="font-bold text-red-800 text-sm">Critical Schedule Delay</p>
            <p className="text-sm text-red-600 mt-0.5">
              This project has passed its planned end date with only{" "}
              <span className="font-semibold">{dash.progress_pct.toFixed(0)}%</span> completion.{" "}
              {dash.delayed_tasks > 0 && `${dash.delayed_tasks} task${dash.delayed_tasks > 1 ? "s are" : " is"} delayed.`}
            </p>
            <Link href="/schedule" className="inline-flex items-center gap-1 mt-2 text-xs font-semibold text-red-700 hover:text-red-900 transition-colors">
              Review schedule <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      )}

      {/* Active alerts */}
      {unreadAlerts.length > 0 && (
        <div className="space-y-2">
          {unreadAlerts.map((a) => {
            const cfg = SEVERITY_CONFIG[a.severity] ?? SEVERITY_CONFIG.info;
            const AlertIcon = cfg.icon;
            const action = ALERT_QUICK_ACTIONS[a.alert_type];
            return (
              <div
                key={a.id}
                className={cn(
                  "flex items-start gap-3 px-4 py-3 rounded-xl border text-sm",
                  cfg.card
                )}
              >
                <AlertIcon
                  className={cn("w-4 h-4 flex-shrink-0 mt-0.5", cfg.iconColor)}
                  strokeWidth={2}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold">{a.title}</p>
                  <p className="opacity-80 text-xs mt-0.5 leading-relaxed">
                    {a.message}
                  </p>
                  {action && (
                    <Link
                      href={action.href}
                      className="inline-flex items-center gap-1 mt-1.5 text-xs font-semibold opacity-70 hover:opacity-100 transition-opacity"
                    >
                      {action.label} <ArrowRight className="w-3 h-3" />
                    </Link>
                  )}
                </div>
                <button
                  onClick={() => markRead.mutate(a.id)}
                  aria-label="Dismiss alert"
                  className="flex-shrink-0 p-1 rounded-md opacity-50 hover:opacity-100 transition-opacity"
                >
                  <X className="w-3.5 h-3.5" strokeWidth={2.5} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* KPI grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {stats.map((s) => (
          <StatCard key={s.label} {...s} />
        ))}
      </div>

      {/* Task + Cost panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Task Progress */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Task Progress</h2>
            <Link href="/schedule" className="section-link">
              View Gantt →
            </Link>
          </div>
          <div className="p-5 space-y-4">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-2xl font-bold text-stone-900 leading-none">
                  {dash.completed_tasks}
                  <span className="text-base font-normal text-stone-400 ml-1">
                    / {dash.task_count}
                  </span>
                </p>
                <p className="text-xs text-stone-400 mt-1">tasks completed</p>
              </div>
              <p className="text-sm font-semibold text-stone-700">
                {dash.task_count
                  ? ((dash.completed_tasks / dash.task_count) * 100).toFixed(0)
                  : 0}
                %
              </p>
            </div>
            <div className="w-full bg-stone-100 rounded-full h-2">
              <div
                className="bg-green-500 h-2 rounded-full transition-all duration-500"
                style={{
                  width: `${
                    dash.task_count
                      ? (dash.completed_tasks / dash.task_count) * 100
                      : 0
                  }%`,
                }}
              />
            </div>
            <div className="flex items-center gap-5 text-xs text-stone-500">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-sm bg-red-400 inline-block" />
                {dash.delayed_tasks} delayed
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-sm bg-brand-400 inline-block" />
                {Math.max(0, dash.task_count - dash.completed_tasks - dash.delayed_tasks)} pending
              </span>
            </div>
          </div>
        </div>

        {/* Cost Breakdown */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Cost Breakdown</h2>
            <Link href="/costs" className="section-link">
              Full report →
            </Link>
          </div>
          <div className="p-5 space-y-3">
            {[
              { label: "Materials", value: dash.material_cost, color: "bg-brand-500" },
              { label: "Labour",    value: dash.labour_cost,   color: "bg-violet-400" },
              { label: "Other",     value: dash.other_cost,    color: "bg-stone-300"  },
            ].map((row) => (
              <div key={row.label}>
                <div className="flex justify-between text-xs text-stone-600 mb-1.5">
                  <span>{row.label}</span>
                  <span className="font-semibold text-stone-800">
                    {formatCurrency(row.value)}
                  </span>
                </div>
                <div className="w-full bg-stone-100 rounded-full h-1.5">
                  <div
                    className={cn("h-1.5 rounded-full transition-all duration-500", row.color)}
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

            {/* Prediction banner */}
            {pred && (
              <div
                className={cn(
                  "flex items-start gap-2.5 mt-2 px-3.5 py-2.5 rounded-lg text-xs font-medium",
                  pred.overrun_risk
                    ? "bg-red-50 text-red-700 border border-red-200"
                    : "bg-green-50 text-green-700 border border-green-200"
                )}
              >
                {pred.overrun_risk ? (
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" strokeWidth={2} />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" strokeWidth={2} />
                )}
                <div>
                  <span>
                    {pred.overrun_risk ? "Budget overrun risk" : "On budget"} — Predicted:{" "}
                    <span className="font-bold">{formatCompact(pred.predicted_final_cost)}</span>
                  </span>
                  {pred.overrun_risk && overrunAmount > 0 && (
                    <p className="mt-0.5 opacity-80">
                      +{formatCompact(overrunAmount)} projected over budget
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
