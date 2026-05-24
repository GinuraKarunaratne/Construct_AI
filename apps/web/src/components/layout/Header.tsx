"use client";

import { useQuery } from "@tanstack/react-query";
import { useActiveProject } from "@/hooks/useActiveProject";
import { alertsApi } from "@/services/alerts";
import Link from "next/link";

export function Header() {
  const { project } = useActiveProject();
  const projectId = project?.id;

  const { data: alerts } = useQuery({
    queryKey: ["alerts", projectId, "unread"],
    queryFn: () => alertsApi.list(projectId!, true),
    enabled: !!projectId,
    refetchInterval: 60_000,
  });

  const unreadCount = alerts?.length ?? 0;

  return (
    <header className="h-14 flex-shrink-0 bg-white border-b border-slate-200 flex items-center px-6 gap-4">
      {/* Project name */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800 truncate">
          {project?.name ?? "Loading…"}
        </p>
        {project?.location_name && (
          <p className="text-xs text-slate-400 truncate">
            {project.location_name}
          </p>
        )}
      </div>

      {/* Status chip */}
      {project?.status && (
        <span className="hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 capitalize">
          {project.status}
        </span>
      )}

      {/* Alerts bell */}
      <Link
        href="/alerts"
        className="relative p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </Link>
    </header>
  );
}
