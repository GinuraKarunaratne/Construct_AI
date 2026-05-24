"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useActiveProject } from "@/hooks/useActiveProject";
import { alertsApi } from "@/services/alerts";
import { LoadingSpinner, EmptyState } from "@/components/ui/LoadingSpinner";
import { Badge } from "@/components/ui/Badge";
import { formatDate } from "@/lib/utils";
import { AlertTriangle, Info, CheckCircle2, X } from "lucide-react";
import { cn } from "@/lib/utils";

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

  const unread = (alerts ?? []).filter((a) => !a.is_read);
  const criticalCount = (alerts ?? []).filter(
    (a) => a.severity === "critical" && !a.is_read
  ).length;
  const warningCount = (alerts ?? []).filter(
    (a) => a.severity === "warning" && !a.is_read
  ).length;

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
      {(criticalCount > 0 || warningCount > 0) && (
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
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="font-semibold text-stone-900 text-sm">
                      {alert.title}
                    </p>
                    <Badge label={alert.severity} variant={alert.severity} />
                    {!alert.is_read && (
                      <span className="w-1.5 h-1.5 rounded-full bg-brand-500 flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-sm text-stone-600">{alert.message}</p>
                  {alert.created_at && (
                    <p className="text-xs text-stone-400 mt-1">
                      {formatDate(alert.created_at)}
                    </p>
                  )}
                </div>

                {!alert.is_read && (
                  <button
                    onClick={() => markRead.mutate(alert.id)}
                    disabled={markRead.isPending}
                    aria-label="Dismiss alert"
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

      {/* Alert type legend */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Alert Types</h2>
        </div>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          {[
            { type: "low_stock",      label: "Low Stock",      desc: "Material stock below reorder level" },
            { type: "task_delayed",   label: "Task Delayed",   desc: "Task behind schedule" },
            { type: "budget_overrun", label: "Budget Risk",    desc: "Predicted final cost exceeds budget" },
            { type: "weather_risk",   label: "Weather Alert",  desc: "High rain probability for sensitive tasks" },
          ].map((item) => (
            <div key={item.type} className="flex items-start gap-2.5">
              <span className="w-2 h-2 rounded-full bg-stone-300 mt-1.5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-stone-700">{item.label}</p>
                <p className="text-xs text-stone-400 mt-0.5">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
