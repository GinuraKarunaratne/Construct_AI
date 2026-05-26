"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useActiveProject } from "@/hooks/useActiveProject";
import { projectsApi } from "@/services/projects";
import { alertsApi } from "@/services/alerts";
import { costsApi } from "@/services/costs";
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
  ArrowUpRight,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const SEVERITY_CONFIG = {
  critical: { Icon: AlertTriangle, color: "text-danger-500"  },
  warning:  { Icon: AlertTriangle, color: "text-warning-500" },
  info:     { Icon: Info,          color: "text-info-500"    },
};

const ALERT_QUICK_ACTIONS: Record<string, { label: string; href: string }> = {
  low_stock:      { label: "Materials", href: "/materials" },
  task_delayed:   { label: "Schedule",  href: "/schedule"  },
  budget_overrun: { label: "Costs",     href: "/costs"     },
  weather_risk:   { label: "Schedule",  href: "/schedule"  },
};

// ── KPI Tile ──────────────────────────────────────────────────────────────
interface KpiTileProps {
  label: string;
  value: string;
  sub?: string;
  trend?: { value: string; up: boolean };
  Icon: React.ElementType;
  href?: string;
  highlighted?: boolean;
}

function KpiTile({ label, value, sub, trend, Icon, href, highlighted }: KpiTileProps) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className={cn(
          "w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0",
          highlighted ? "bg-white/10" : "bg-surface-subtle"
        )}>
          <Icon className={cn("w-4.5 h-4.5", highlighted ? "text-white" : "text-ink-700")} strokeWidth={1.75} />
        </div>
        {href && (
          <ArrowUpRight
            className={cn(
              "w-4 h-4 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity",
              highlighted ? "text-white" : "text-ink-500"
            )}
            strokeWidth={2}
          />
        )}
      </div>

      <div>
        <p className={cn("kpi-label", highlighted && "text-ink-300")}>{label}</p>
        <div className="flex items-baseline gap-2 mt-1.5">
          <p className={cn("kpi-value", highlighted && "text-white")}>{value}</p>
          {trend && (
            <span className={cn(
              "inline-flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded-full",
              trend.up
                ? highlighted ? "bg-white/15 text-white" : "bg-success-50 text-success-700"
                : highlighted ? "bg-white/15 text-white" : "bg-danger-50 text-danger-700"
            )}>
              {trend.up ? "↑" : "↓"} {trend.value}
            </span>
          )}
        </div>
        {sub && (
          <p className={cn(
            "text-sm mt-1.5",
            highlighted ? "text-ink-300" : "text-ink-500"
          )}>{sub}</p>
        )}
      </div>
    </>
  );

  const base = highlighted
    ? "kpi-tile-dark group transition-colors"
    : "kpi-tile group transition-colors hover:border-ink-300";

  if (href) {
    return (
      <Link href={href} className={cn(base, "cursor-pointer")}>
        {content}
      </Link>
    );
  }
  return <div className={base}>{content}</div>;
}

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

  const isOverdue = p.planned_end_date
    ? Date.now() > new Date(p.planned_end_date).getTime() && dash.progress_pct < 99
    : false;

  const attendanceRecorded = dash.today_attendance > 0;
  const attendanceSub = attendanceRecorded
    ? `${dash.workers_count - dash.today_attendance} absent today`
    : "Not yet recorded";

  const unreadAlerts = (alerts ?? []).filter((a) => !a.is_read).slice(0, 3);
  const overrunAmount = pred ? pred.predicted_final_cost - dash.total_budget : 0;
  const criticalCount = (alerts ?? []).filter((a) => a.severity === "critical" && !a.is_read).length;

  return (
    <div className="space-y-8">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">
            Welcome back · Here&apos;s what&apos;s happening with {p.name}
          </p>
        </div>
        <Link
          href="/alerts"
          className="btn-secondary btn-sm sm:btn-secondary"
        >
          <Bell className="w-4 h-4" strokeWidth={2} />
          <span className="hidden sm:inline">View all alerts</span>
        </Link>
      </div>

      {/* ── Overdue banner ──────────────────────────────────────────── */}
      {isOverdue && (
        <div className="banner-error">
          <AlertTriangle className="w-5 h-5 text-danger-600 flex-shrink-0 mt-0.5" strokeWidth={2} />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-danger-700 text-sm">
              Schedule Overdue
            </p>
            <p className="text-sm text-danger-600 mt-0.5">
              Past planned end date · {dash.progress_pct.toFixed(0)}% complete
              {dash.delayed_tasks > 0 && ` · ${dash.delayed_tasks} task${dash.delayed_tasks !== 1 ? "s" : ""} delayed`}
            </p>
          </div>
          <Link
            href="/schedule"
            className="flex-shrink-0 text-sm font-semibold text-danger-700 hover:text-danger-800 transition-colors flex items-center gap-1"
          >
            Review <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* ── Unread alerts strip ─────────────────────────────────────── */}
      {unreadAlerts.length > 0 && (
        <div className="space-y-2">
          {unreadAlerts.map((a) => {
            const cfg = SEVERITY_CONFIG[a.severity as keyof typeof SEVERITY_CONFIG] ?? SEVERITY_CONFIG.info;
            const AlertIcon = cfg.Icon;
            const action = ALERT_QUICK_ACTIONS[a.alert_type];
            return (
              <div
                key={a.id}
                className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white border border-surface-border"
              >
                <AlertIcon
                  className={cn("w-4 h-4 flex-shrink-0", cfg.color)}
                  strokeWidth={2}
                />
                <p className="flex-1 min-w-0 text-sm font-medium text-ink-900 truncate">
                  {a.title}
                </p>
                {action && (
                  <Link
                    href={action.href}
                    className="text-xs font-semibold text-ink-700 hover:text-ink-900 transition-colors flex items-center gap-1 flex-shrink-0"
                  >
                    {action.label} <ArrowRight className="w-3 h-3" />
                  </Link>
                )}
                <button
                  onClick={() => markRead.mutate(a.id)}
                  aria-label="Dismiss"
                  className="flex-shrink-0 p-1 rounded-md text-ink-400 hover:text-ink-700 hover:bg-surface-subtle transition-colors"
                >
                  <X className="w-3.5 h-3.5" strokeWidth={2.5} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* ── KPI grid — dark highlight first, then standard tiles ───── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* Featured / dark KPI — the most important one (budget) */}
        <KpiTile
          label="Total Budget"
          value={formatCompact(dash.total_budget)}
          sub="Project budget"
          Icon={Wallet}
          href="/costs"
          highlighted
        />
        <KpiTile
          label="Cost to Date"
          value={formatCompact(dash.actual_cost_to_date)}
          sub={`${dash.budget_used_pct.toFixed(1)}% used`}
          trend={dash.budget_used_pct > 80
            ? { value: `${dash.budget_used_pct.toFixed(0)}%`, up: true }
            : undefined}
          Icon={TrendingUp}
          href="/costs"
        />
        <KpiTile
          label="Progress"
          value={`${dash.progress_pct.toFixed(0)}%`}
          sub={isOverdue ? "Overdue" : `Day ${Math.min(daysPassed, totalDays)} / ${totalDays}`}
          Icon={CalendarClock}
          href="/schedule"
        />
        <KpiTile
          label="Open Alerts"
          value={String(dash.open_alerts)}
          sub={`${criticalCount} critical`}
          Icon={Bell}
          href="/alerts"
        />
        <KpiTile
          label="Attendance"
          value={`${dash.today_attendance}/${dash.workers_count}`}
          sub={attendanceSub}
          Icon={HardHat}
          href="/labour"
        />
        <KpiTile
          label="Low Stock"
          value={String(dash.low_stock_count)}
          sub={dash.low_stock_count > 0 ? "Reorder needed" : "Stock OK"}
          Icon={PackageX}
          href="/materials"
        />
      </div>

      {/* ── Bottom: Task Progress + Cost Breakdown ──────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Task Progress */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Task Progress</h2>
            <Link href="/schedule" className="section-link">View all →</Link>
          </div>
          <div className="p-6 space-y-5">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-3xl font-bold text-ink-900 leading-none tabular-nums tracking-tight">
                  {dash.completed_tasks}
                  <span className="text-lg font-medium text-ink-400 ml-1.5">
                    / {dash.task_count}
                  </span>
                </p>
                <p className="text-sm text-ink-500 mt-2">Tasks completed</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-ink-900 tabular-nums">
                  {dash.task_count
                    ? ((dash.completed_tasks / dash.task_count) * 100).toFixed(0)
                    : 0}%
                </p>
                <p className="text-xs text-ink-500 mt-0.5">Complete</p>
              </div>
            </div>
            <div className="progress-track h-2">
              <div
                className="progress-bar bg-success-500 h-2"
                style={{
                  width: `${dash.task_count ? (dash.completed_tasks / dash.task_count) * 100 : 0}%`,
                }}
              />
            </div>
            <div className="flex items-center gap-5 text-sm pt-1">
              <Link
                href="/schedule"
                className={cn(
                  "flex items-center gap-2 transition-colors",
                  dash.delayed_tasks > 0
                    ? "text-danger-600 hover:text-danger-700 font-semibold"
                    : "text-ink-500"
                )}
              >
                <span className="status-dot bg-danger-500" />
                {dash.delayed_tasks} delayed
              </Link>
              <span className="flex items-center gap-2 text-ink-500">
                <span className="status-dot bg-ink-400" />
                {Math.max(0, dash.task_count - dash.completed_tasks - dash.delayed_tasks)} pending
              </span>
            </div>
          </div>
        </div>

        {/* Cost Breakdown */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Cost Breakdown</h2>
            <Link href="/costs" className="section-link">Full report →</Link>
          </div>
          <div className="p-6 space-y-4">
            {[
              { label: "Materials", value: dash.material_cost, color: "bg-ink-900"  },
              { label: "Labour",    value: dash.labour_cost,   color: "bg-ink-500" },
              { label: "Other",     value: dash.other_cost,    color: "bg-ink-300" },
            ].map((row) => (
              <div key={row.label}>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-ink-700 font-medium">{row.label}</span>
                  <span className="font-semibold text-ink-900 tabular-nums">
                    {formatCurrency(row.value)}
                  </span>
                </div>
                <div className="progress-track h-2">
                  <div
                    className={cn("progress-bar h-2", row.color)}
                    style={{
                      width: `${
                        dash.actual_cost_to_date
                          ? Math.min((row.value / dash.actual_cost_to_date) * 100, 100)
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
                  "flex items-start gap-3 mt-4 px-4 py-3 rounded-xl text-sm font-medium border",
                  pred.overrun_risk
                    ? "bg-danger-50 text-danger-700 border-danger-100"
                    : "bg-success-50 text-success-700 border-success-100"
                )}
              >
                {pred.overrun_risk ? (
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" strokeWidth={2} />
                ) : (
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" strokeWidth={2} />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold">
                    {pred.overrun_risk ? "Overrun risk detected" : "On budget"} · Forecast{" "}
                    <span className="tabular-nums">{formatCompact(pred.predicted_final_cost)}</span>
                  </p>
                  {pred.overrun_risk && overrunAmount > 0 && (
                    <p className="mt-1 opacity-90 text-xs">
                      +{formatCompact(overrunAmount)} over budget
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
