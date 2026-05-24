"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useActiveProject } from "@/hooks/useActiveProject";
import { alertsApi } from "@/services/alerts";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Badge } from "@/components/ui/Badge";
import { formatDate } from "@/lib/utils";

const SEVERITY_ICONS: Record<string, string> = {
  critical: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z",
  warning:  "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z",
  info:     "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
};

const SEVERITY_BG: Record<string, string> = {
  critical: "bg-red-50 border-red-200",
  warning:  "bg-amber-50 border-amber-200",
  info:     "bg-blue-50 border-blue-200",
};
const SEVERITY_ICON_COLOR: Record<string, string> = {
  critical: "text-red-500",
  warning:  "text-amber-500",
  info:     "text-blue-500",
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Alerts</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {unread.length} unread · {alerts?.length ?? 0} total
          </p>
        </div>
        {unread.length > 0 && (
          <button
            onClick={() => markAllRead.mutate()}
            disabled={markAllRead.isPending}
            className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 border border-slate-300 rounded-lg transition-colors disabled:opacity-60"
          >
            Mark all as read
          </button>
        )}
      </div>

      {/* Summary chips */}
      {(criticalCount > 0 || warningCount > 0) && (
        <div className="flex gap-3 flex-wrap">
          {criticalCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 border border-red-200 rounded-lg">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-sm text-red-700 font-medium">
                {criticalCount} critical
              </span>
            </div>
          )}
          {warningCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="text-sm text-amber-700 font-medium">
                {warningCount} warning{warningCount !== 1 ? "s" : ""}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Alert list */}
      {(alerts ?? []).length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="font-medium">No alerts</p>
          <p className="text-sm mt-1">All clear — no issues detected.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {(alerts ?? []).map((alert) => (
            <div
              key={alert.id}
              className={`flex items-start gap-4 p-4 rounded-xl border transition-opacity ${
                SEVERITY_BG[alert.severity] ?? "bg-slate-50 border-slate-200"
              } ${alert.is_read ? "opacity-50" : ""}`}
            >
              {/* Icon */}
              <svg
                className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                  SEVERITY_ICON_COLOR[alert.severity] ?? "text-slate-400"
                }`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.75}
                  d={SEVERITY_ICONS[alert.severity] ?? SEVERITY_ICONS.info}
                />
              </svg>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="font-semibold text-slate-900 text-sm">
                    {alert.title}
                  </p>
                  <Badge label={alert.severity} variant={alert.severity} />
                  {!alert.is_read && (
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                  )}
                </div>
                <p className="text-sm text-slate-600">{alert.message}</p>
                {alert.created_at && (
                  <p className="text-xs text-slate-400 mt-1">
                    {formatDate(alert.created_at)}
                  </p>
                )}
              </div>

              {/* Actions */}
              {!alert.is_read && (
                <button
                  onClick={() => markRead.mutate(alert.id)}
                  disabled={markRead.isPending}
                  className="flex-shrink-0 text-xs text-slate-500 hover:text-slate-800 transition-colors disabled:opacity-50 px-2 py-1 rounded hover:bg-white/50"
                >
                  Dismiss
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Alert type legend */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">
          Alert Types
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-slate-600">
          {[
            { type: "low_stock",      label: "Low Stock",      desc: "Material stock below reorder level" },
            { type: "task_delayed",   label: "Task Delayed",   desc: "Task behind schedule, successors rescheduled" },
            { type: "budget_overrun", label: "Budget Risk",    desc: "Predicted final cost exceeds budget" },
            { type: "weather_risk",   label: "Weather Alert",  desc: "High rain probability for weather-sensitive tasks" },
          ].map((item) => (
            <div key={item.type} className="flex items-start gap-2">
              <span className="w-2 h-2 rounded-full bg-slate-300 mt-1.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-slate-700">{item.label}</p>
                <p className="text-xs text-slate-400">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
