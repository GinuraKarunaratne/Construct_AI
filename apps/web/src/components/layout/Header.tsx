"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useActiveProject } from "@/hooks/useActiveProject";
import { useProjectContext } from "@/context/ProjectContext";
import { alertsApi, AlertOut } from "@/services/alerts";
import { useSidebar } from "@/context/SidebarContext";
import {
  Bell,
  Menu,
  MapPin,
  ChevronDown,
  CheckCircle2,
  AlertTriangle,
  Info,
  ExternalLink,
  Check,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

function AlertIcon({ severity }: { severity: AlertOut["severity"] }) {
  if (severity === "critical")
    return <AlertTriangle className="w-4 h-4 text-danger-500 flex-shrink-0 mt-0.5" strokeWidth={2} />;
  if (severity === "warning")
    return <AlertTriangle className="w-4 h-4 text-warning-500 flex-shrink-0 mt-0.5" strokeWidth={2} />;
  return <Info className="w-4 h-4 text-info-500 flex-shrink-0 mt-0.5" strokeWidth={2} />;
}

function relativeTime(iso?: string | null): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function statusBadgeClass(status?: string | null): string {
  if (status === "active")    return "status-badge status-badge-success";
  if (status === "completed") return "status-badge status-badge-info";
  if (status === "on_hold")   return "status-badge status-badge-warning";
  return "status-badge status-badge-neutral";
}

export function Header() {
  const { project, allProjects } = useActiveProject();
  const { setSelectedProjectId } = useProjectContext();
  const projectId = project?.id;
  const { toggleMobile } = useSidebar();
  const qc = useQueryClient();

  const [projOpen, setProjOpen] = useState(false);
  const projRef = useRef<HTMLDivElement>(null);
  const [alertOpen, setAlertOpen] = useState(false);
  const alertRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (projRef.current && !projRef.current.contains(e.target as Node)) {
        setProjOpen(false);
      }
      if (alertRef.current && !alertRef.current.contains(e.target as Node)) {
        setAlertOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const { data: alerts = [] } = useQuery({
    queryKey: ["alerts", projectId, "unread"],
    queryFn: () => alertsApi.list(projectId!, true),
    enabled: !!projectId,
    refetchInterval: 60_000,
  });

  const markRead = useMutation({
    mutationFn: alertsApi.markRead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["alerts", projectId, "unread"] });
      qc.invalidateQueries({ queryKey: ["alerts", projectId] });
    },
  });

  const markAllRead = useMutation({
    mutationFn: () => alertsApi.markAllRead(projectId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["alerts", projectId, "unread"] });
      qc.invalidateQueries({ queryKey: ["alerts", projectId] });
    },
  });

  const unreadCount = alerts.length;

  function handleProjectSelect(id: number) {
    setSelectedProjectId(id);
    setProjOpen(false);
  }

  return (
    <header className="h-[72px] flex-shrink-0 bg-white border-b border-surface-border flex items-center px-4 sm:px-6 gap-4 relative z-30">
      {/* Mobile hamburger */}
      <button
        onClick={toggleMobile}
        aria-label="Toggle navigation"
        className="p-2 rounded-lg text-ink-600 hover:text-ink-900 hover:bg-surface-subtle transition-colors md:hidden flex-shrink-0"
      >
        <Menu className="w-5 h-5" strokeWidth={1.75} />
      </button>

      {/* Project switcher */}
      <div className="flex-1 min-w-0 relative" ref={projRef}>
        {allProjects.length > 1 ? (
          <button
            onClick={() => setProjOpen((o) => !o)}
            className="flex items-center gap-3 min-w-0 group rounded-lg px-2 py-1.5 -ml-2 hover:bg-surface-subtle transition-colors"
            aria-label="Switch active project"
          >
            <div className="min-w-0 text-left">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-base font-semibold text-ink-900 truncate tracking-tight">
                  {project?.name ?? "Select project"}
                </p>
                {project?.status && (
                  <span className={cn("hidden sm:inline-flex capitalize", statusBadgeClass(project.status))}>
                    <span className={cn(
                      "status-dot",
                      project.status === "active"     ? "bg-success-500" :
                      project.status === "completed"  ? "bg-info-500"    :
                      project.status === "on_hold"    ? "bg-warning-500" :
                      "bg-ink-400"
                    )} />
                    {project.status}
                  </span>
                )}
                <ChevronDown
                  className={cn(
                    "w-4 h-4 text-ink-500 transition-transform flex-shrink-0",
                    projOpen && "rotate-180"
                  )}
                  strokeWidth={2}
                />
              </div>
              {project?.location_name && (
                <p className="hidden sm:flex items-center gap-1 text-xs text-ink-500 mt-0.5">
                  <MapPin className="w-3 h-3 flex-shrink-0" strokeWidth={1.75} />
                  {project.location_name}
                </p>
              )}
            </div>
          </button>
        ) : (
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-base font-semibold text-ink-900 truncate tracking-tight">
                {project?.name ?? "ConstructAI"}
              </p>
              {project?.status && (
                <span className={cn("hidden sm:inline-flex capitalize", statusBadgeClass(project.status))}>
                  <span className={cn(
                    "status-dot",
                    project.status === "active"     ? "bg-success-500" :
                    project.status === "completed"  ? "bg-info-500"    :
                    project.status === "on_hold"    ? "bg-warning-500" :
                    "bg-ink-400"
                  )} />
                  {project.status}
                </span>
              )}
            </div>
            {project?.location_name && (
              <p className="hidden sm:flex items-center gap-1 text-xs text-ink-500 mt-0.5">
                <MapPin className="w-3 h-3 flex-shrink-0" strokeWidth={1.75} />
                {project.location_name}
              </p>
            )}
          </div>
        )}

        {/* Project dropdown */}
        {projOpen && (
          <div className="absolute top-full mt-2 left-0 z-50 w-80 bg-white border border-surface-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-surface-divider">
              <p className="text-xs font-semibold text-ink-500 uppercase tracking-wider">
                Switch Project
              </p>
            </div>
            <ul className="py-1 max-h-72 overflow-y-auto">
              {allProjects.map((p) => (
                <li key={p.id}>
                  <button
                    onClick={() => handleProjectSelect(p.id)}
                    className="w-full flex items-start gap-3 px-4 py-3 hover:bg-surface-subtle transition-colors text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-ink-900 truncate">
                        {p.name}
                      </p>
                      {p.location_name && (
                        <p className="text-xs text-ink-500 truncate mt-0.5">
                          {p.location_name}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
                      <span className={cn("capitalize", statusBadgeClass(p.status))}>
                        <span className={cn(
                          "status-dot",
                          p.status === "active"    ? "bg-success-500" :
                          p.status === "completed" ? "bg-info-500"    :
                          "bg-ink-400"
                        )} />
                        {p.status}
                      </span>
                      {p.id === project?.id && (
                        <Check className="w-4 h-4 text-ink-900" strokeWidth={2.5} />
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
            <div className="px-4 py-3 border-t border-surface-divider">
              <Link
                href="/projects"
                onClick={() => setProjOpen(false)}
                className="flex items-center gap-1.5 text-sm font-semibold text-ink-900 hover:text-ink-700"
              >
                <ExternalLink className="w-3.5 h-3.5" strokeWidth={2} />
                Manage projects
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Alert bell */}
      <div className="relative flex-shrink-0" ref={alertRef}>
        <button
          onClick={() => setAlertOpen((o) => !o)}
          aria-label={`Alerts${unreadCount > 0 ? ` — ${unreadCount} unread` : ""}`}
          className={cn(
            "relative p-2.5 rounded-lg transition-colors",
            alertOpen
              ? "bg-surface-subtle text-ink-900"
              : "text-ink-600 hover:text-ink-900 hover:bg-surface-subtle"
          )}
        >
          <Bell className="w-5 h-5" strokeWidth={1.75} />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 bg-danger-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>

        {/* Alert popover */}
        {alertOpen && (
          <div className="absolute top-full mt-2 right-0 z-50 w-[360px] max-w-[calc(100vw-2rem)] bg-white border border-surface-border rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-surface-divider">
              <p className="text-sm font-bold text-ink-900">
                Notifications
                {unreadCount > 0 && (
                  <span className="ml-2 inline-flex items-center justify-center px-1.5 py-0.5 bg-ink-900 text-white text-[10px] font-bold rounded-full">
                    {unreadCount}
                  </span>
                )}
              </p>
              {unreadCount > 0 && (
                <button
                  onClick={() => markAllRead.mutate()}
                  disabled={markAllRead.isPending}
                  className="text-xs font-semibold text-ink-700 hover:text-ink-900 disabled:opacity-50"
                >
                  Mark all read
                </button>
              )}
            </div>

            <ul className="max-h-80 overflow-y-auto divide-y divide-surface-divider">
              {alerts.length === 0 ? (
                <li className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                  <CheckCircle2 className="w-6 h-6 text-success-500" strokeWidth={1.75} />
                  <p className="text-sm font-semibold text-ink-900">All clear</p>
                  <p className="text-xs text-ink-500">No unread notifications</p>
                </li>
              ) : (
                alerts.map((alert) => (
                  <li
                    key={alert.id}
                    className="flex items-start gap-3 px-4 py-3.5 hover:bg-surface-subtle transition-colors"
                  >
                    <AlertIcon severity={alert.severity} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-ink-900 leading-tight">
                        {alert.title}
                      </p>
                      <p className="text-xs text-ink-500 mt-1 line-clamp-2 leading-relaxed">
                        {alert.message}
                      </p>
                      <p className="text-xs text-ink-400 mt-1.5">
                        {relativeTime(alert.created_at)}
                      </p>
                    </div>
                    <button
                      onClick={() => markRead.mutate(alert.id)}
                      disabled={markRead.isPending}
                      aria-label="Mark as read"
                      className="p-1.5 rounded-lg text-ink-400 hover:text-success-600 hover:bg-success-50 transition-colors flex-shrink-0"
                    >
                      <Check className="w-3.5 h-3.5" strokeWidth={2.5} />
                    </button>
                  </li>
                ))
              )}
            </ul>

            <div className="px-4 py-3 border-t border-surface-divider">
              <Link
                href="/alerts"
                onClick={() => setAlertOpen(false)}
                className="flex items-center gap-1.5 text-sm font-semibold text-ink-900 hover:text-ink-700"
              >
                <ExternalLink className="w-3.5 h-3.5" strokeWidth={2} />
                View all notifications
              </Link>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
