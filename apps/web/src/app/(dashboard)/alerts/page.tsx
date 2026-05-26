"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useActiveProject } from "@/hooks/useActiveProject";
import { alertsApi } from "@/services/alerts";
import { LoadingSpinner, EmptyState } from "@/components/ui/LoadingSpinner";
import { Badge } from "@/components/ui/Badge";
import { formatDate } from "@/lib/utils";
import { AlertTriangle, Info, CheckCircle2, X, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

const SEVERITY_CONFIG = {
  critical: {
    bg:        "bg-white border-danger-100",
    iconColor: "text-danger-500",
    Icon:      AlertTriangle,
  },
  warning: {
    bg:        "bg-white border-warning-100",
    iconColor: "text-warning-500",
    Icon:      AlertTriangle,
  },
  info: {
    bg:        "bg-white border-surface-border",
    iconColor: "text-info-500",
    Icon:      Info,
  },
};

/** Quick action per alert_type */
const ALERT_ACTIONS: Record<string, { label: string; href: string }[]> = {
  low_stock:      [{ label: "View Materials", href: "/materials" }],
  task_delayed:   [{ label: "View Schedule",  href: "/schedule"  }],
  budget_overrun: [{ label: "View Costs",     href: "/costs"     }],
  weather_risk:   [{ label: "View Schedule",  href: "/schedule"  }],
};

export default function AlertsPage() {
  const qc = useQueryClient();
  const { projectId, isLoading: projLoading } = useActiveProject();

  const { data: alerts, isLoading } = useQuery({
    queryKey: ["alerts", projectId, "all"],
    queryFn: () => alertsApi.list(projectId!),
    enabled: !!projectId,
  });

  const markRead = useMutation({
    mutationFn: alertsApi.markRead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["alerts", projectId] });
    },
  });

  const markAllRead = useMutation({
    mutationFn: () => alertsApi.markAllRead(projectId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["alerts", projectId] });
    },
  });

  if (projLoading || isLoading) return <LoadingSpinner message="Loading alerts…" />;

  const unread        = (alerts ?? []).filter((a) => !a.is_read);
  const criticalCount = unread.filter((a) => a.severity === "critical").length;
  const warningCount  = unread.filter((a) => a.severity === "warning").length;
  const infoCount     = unread.filter((a) => a.severity === "info").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="page-title">Alerts</h1>
          <p className="page-subtitle">
            {unread.length} unread · {alerts?.length ?? 0} total
          </p>
        </div>
        {unread.length > 0 && (
          <button
            onClick={() => markAllRead.mutate()}
            disabled={markAllRead.isPending}
            className="btn-secondary"
          >
            {markAllRead.isPending && (
              <span className="w-3.5 h-3.5 border-2 border-gray-400 border-t-transparent rounded-lg animate-spin" />
            )}
            Mark all as read
          </button>
        )}
      </div>

      {/* Summary filter chips */}
      {(criticalCount > 0 || warningCount > 0 || infoCount > 0) && (
        <div className="flex gap-2 flex-wrap">
          {criticalCount > 0 && (
            <span className="filter-chip">
              <span className="status-dot bg-danger-500" />
              {criticalCount} critical
            </span>
          )}
          {warningCount > 0 && (
            <span className="filter-chip">
              <span className="status-dot bg-warning-500" />
              {warningCount} warning{warningCount !== 1 ? "s" : ""}
            </span>
          )}
          {infoCount > 0 && (
            <span className="filter-chip">
              <span className="status-dot bg-info-500" />
              {infoCount} info
            </span>
          )}
        </div>
      )}

      {/* Alert list */}
      {(alerts ?? []).length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 className="w-5 h-5" />}
          title="No alerts"
          description="All clear — no issues detected."
        />
      ) : (
        <div className="space-y-3">
          {(alerts ?? []).map((alert) => {
            const cfg = SEVERITY_CONFIG[alert.severity as keyof typeof SEVERITY_CONFIG] ?? SEVERITY_CONFIG.info;
            const AlertIcon = cfg.Icon;
            const actions = ALERT_ACTIONS[alert.alert_type] ?? [];
            return (
              <div
                key={alert.id}
                className={cn(
                  "flex items-start gap-4 p-4 rounded-xl border transition-opacity",
                  cfg.bg,
                  alert.is_read ? "opacity-40" : ""
                )}
              >
                <AlertIcon
                  className={cn("w-5 h-5 flex-shrink-0 mt-0.5", cfg.iconColor)}
                  strokeWidth={2}
                />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <p className="font-semibold text-ink-900 text-sm">
                      {alert.title}
                    </p>
                    <Badge label={alert.severity} variant={alert.severity} />
                    {!alert.is_read && (
                      <span className="status-dot bg-ink-900 flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-sm text-ink-600 leading-relaxed">{alert.message}</p>
                  {alert.created_at && (
                    <p className="text-xs text-ink-500 mt-1.5">
                      {formatDate(alert.created_at)}
                    </p>
                  )}
                  {/* Action buttons */}
                  {actions.length > 0 && !alert.is_read && (
                    <div className="flex gap-2 mt-2.5">
                      {actions.map((action) => (
                        <Link
                          key={action.href}
                          href={action.href}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg border border-current opacity-70 hover:opacity-100 transition-opacity"
                        >
                          {action.label}
                          <ArrowRight className="w-3 h-3" />
                        </Link>
                      ))}
                    </div>
                  )}
                </div>

                {!alert.is_read && (
                  <button
                    onClick={() => markRead.mutate(alert.id)}
                    disabled={markRead.isPending}
                    aria-label="Mark as read"
                    className="flex-shrink-0 p-1.5 rounded-lg text-ink-400 hover:text-ink-900 hover:bg-surface-subtle transition-colors disabled:opacity-50"
                  >
                    <X className="w-4 h-4" strokeWidth={2.5} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Alert rules reference — single-row list */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Alert Rules</h2>
          <span className="text-xs text-ink-500">Automatically generated</span>
        </div>
        <ul className="divide-y divide-surface-divider">
          {[
            {
              type: "low_stock",
              label: "Low Stock",
              desc: "Material stock falls below its reorder level",
              href: "/materials",
              color: "bg-warning-500",
            },
            {
              type: "task_delayed",
              label: "Task Delayed",
              desc: "A task is behind schedule; successors may be affected",
              href: "/schedule",
              color: "bg-danger-500",
            },
            {
              type: "budget_overrun",
              label: "Budget Risk",
              desc: "AI forecast predicts final cost will exceed the total budget",
              href: "/costs",
              color: "bg-danger-600",
            },
            {
              type: "weather_risk",
              label: "Weather Alert",
              desc: "High rain probability coincides with weather-sensitive tasks",
              href: "/schedule",
              color: "bg-info-500",
            },
          ].map((item) => (
            <li key={item.type}>
              <Link
                href={item.href}
                className="flex items-center gap-4 px-6 py-3.5 hover:bg-surface-subtle transition-colors group"
              >
                <span className={`status-dot ${item.color} flex-shrink-0`} />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-semibold text-ink-900 group-hover:text-ink-900 transition-colors">
                    {item.label}
                  </span>
                  <span className="text-xs text-ink-500 ml-3">{item.desc}</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-ink-400 group-hover:text-ink-900 transition-colors flex-shrink-0" strokeWidth={2} />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
