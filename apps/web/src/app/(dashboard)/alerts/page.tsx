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
    bg:        "bg-red-50 border-red-200",
    iconColor: "text-red-500",
    Icon:      AlertTriangle,
  },
  warning: {
    bg:        "bg-amber-50 border-amber-200",
    iconColor: "text-amber-500",
    Icon:      AlertTriangle,
  },
  info: {
    bg:        "bg-sky-50 border-sky-200",
    iconColor: "text-sky-500",
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
              <span className="w-3.5 h-3.5 border-2 border-stone-400 border-t-transparent rounded-full animate-spin" />
            )}
            Mark all as read
          </button>
        )}
      </div>

      {/* Summary chips */}
      {(criticalCount > 0 || warningCount > 0 || infoCount > 0) && (
        <div className="flex gap-3 flex-wrap">
          {criticalCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 border border-red-200 rounded-lg">
              <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
              <span className="text-sm text-red-700 font-semibold">
                {criticalCount} critical
              </span>
            </div>
          )}
          {warningCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg">
              <span className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" />
              <span className="text-sm text-amber-700 font-semibold">
                {warningCount} warning{warningCount !== 1 ? "s" : ""}
              </span>
            </div>
          )}
          {infoCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-sky-50 border border-sky-200 rounded-lg">
              <span className="w-2 h-2 rounded-full bg-sky-400 flex-shrink-0" />
              <span className="text-sm text-sky-700 font-semibold">
                {infoCount} info
              </span>
            </div>
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
                  alert.is_read ? "opacity-50" : ""
                )}
              >
                <AlertIcon
                  className={cn("w-5 h-5 flex-shrink-0 mt-0.5", cfg.iconColor)}
                  strokeWidth={2}
                />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <p className="font-semibold text-stone-900 text-sm">
                      {alert.title}
                    </p>
                    <Badge label={alert.severity} variant={alert.severity} />
                    {!alert.is_read && (
                      <span className="w-1.5 h-1.5 rounded-full bg-brand-500 flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-sm text-stone-600 leading-relaxed">{alert.message}</p>
                  {alert.created_at && (
                    <p className="text-xs text-stone-400 mt-1">
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
                    className="flex-shrink-0 p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-white/60 transition-colors disabled:opacity-50"
                  >
                    <X className="w-3.5 h-3.5" strokeWidth={2.5} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Alert rules reference */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Alert Rules</h2>
        </div>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          {[
            {
              type: "low_stock",
              label: "Low Stock",
              desc: "Material stock falls below its reorder level",
              href: "/materials",
            },
            {
              type: "task_delayed",
              label: "Task Delayed",
              desc: "A task is behind schedule; successors may be affected",
              href: "/schedule",
            },
            {
              type: "budget_overrun",
              label: "Budget Risk",
              desc: "AI forecast predicts final cost exceeds total budget",
              href: "/costs",
            },
            {
              type: "weather_risk",
              label: "Weather Alert",
              desc: "High rain probability for weather-sensitive tasks",
              href: "/schedule",
            },
          ].map((item) => (
            <Link
              key={item.type}
              href={item.href}
              className="flex items-start gap-2.5 p-3 rounded-lg hover:bg-stone-50 transition-colors group"
            >
              <span className="w-2 h-2 rounded-full bg-stone-300 mt-1.5 flex-shrink-0 group-hover:bg-brand-400 transition-colors" />
              <div>
                <p className="font-semibold text-stone-700 group-hover:text-brand-700 transition-colors">
                  {item.label}
                </p>
                <p className="text-xs text-stone-400 mt-0.5">{item.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
