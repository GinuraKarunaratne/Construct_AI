"use client";

import { useQuery } from "@tanstack/react-query";
import { useActiveProject } from "@/hooks/useActiveProject";
import { alertsApi } from "@/services/alerts";
import { useSidebar } from "@/context/SidebarContext";
import { Bell, Menu } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function Header() {
  const { project } = useActiveProject();
  const projectId = project?.id;
  const { toggle } = useSidebar();

  const { data: alerts } = useQuery({
    queryKey: ["alerts", projectId, "unread"],
    queryFn: () => alertsApi.list(projectId!, true),
    enabled: !!projectId,
    refetchInterval: 60_000,
  });

  const unreadCount = alerts?.length ?? 0;

  return (
    <header className="h-14 flex-shrink-0 bg-white border-b border-stone-200 flex items-center px-4 gap-3">
      {/* Mobile sidebar toggle */}
      <button
        onClick={toggle}
        aria-label="Toggle navigation"
        className="p-1.5 rounded-lg text-stone-500 hover:text-stone-800 hover:bg-stone-100 transition-colors lg:hidden"
      >
        <Menu className="w-5 h-5" strokeWidth={1.75} />
      </button>

      {/* Project context */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-stone-800 truncate">
            {project?.name ?? "Loading project…"}
          </p>
          {project?.status && (
            <span
              className={cn(
                "hidden sm:inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold capitalize",
                project.status === "active"
                  ? "bg-green-100 text-green-700"
                  : "bg-stone-100 text-stone-600"
              )}
            >
              {project.status}
            </span>
          )}
        </div>
        {project?.location_name && (
          <p className="text-xs text-stone-400 truncate leading-tight">
            {project.location_name}
          </p>
        )}
      </div>

      {/* Alert bell */}
      <Link
        href="/alerts"
        aria-label={`Alerts${unreadCount > 0 ? ` — ${unreadCount} unread` : ""}`}
        className="relative p-2 rounded-lg text-stone-500 hover:text-stone-800 hover:bg-stone-100 transition-colors"
      >
        <Bell className="w-5 h-5" strokeWidth={1.75} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </Link>
    </header>
  );
}
