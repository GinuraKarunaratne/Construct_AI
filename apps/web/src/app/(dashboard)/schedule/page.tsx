"use client";

import { useQuery } from "@tanstack/react-query";
import { useActiveProject } from "@/hooks/useActiveProject";
import { tasksApi, GanttTask } from "@/services/tasks";
import { LoadingSpinner, EmptyState } from "@/components/ui/LoadingSpinner";
import { Badge } from "@/components/ui/Badge";
import { CalendarDays, CloudRain } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_COLORS: Record<string, string> = {
  completed:   "bg-green-500",
  in_progress: "bg-brand-500",
  delayed:     "bg-red-500",
  not_started: "bg-stone-300",
};

const LEGEND = [
  { label: "Completed",   color: "bg-green-500"  },
  { label: "In Progress", color: "bg-brand-500"  },
  { label: "Delayed",     color: "bg-red-500"    },
  { label: "Not Started", color: "bg-stone-300"  },
];

function daysBetween(a: string, b: string) {
  return Math.round(
    (new Date(b).getTime() - new Date(a).getTime()) / 86_400_000
  );
}

export default function SchedulePage() {
  const { projectId, project, isLoading: projLoading } = useActiveProject();

  const { data: ganttData, isLoading } = useQuery({
    queryKey: ["gantt", projectId],
    queryFn: () => tasksApi.gantt(projectId!),
    enabled: !!projectId,
  });

  if (projLoading || isLoading) return <LoadingSpinner message="Loading schedule…" />;

  const tasks: GanttTask[] = ganttData?.tasks ?? [];

  // Compute timeline bounds from project dates
  const projectStart =
    project?.planned_start_date ?? tasks.find((t) => t.planned_start_date)?.planned_start_date ?? "";
  const projectEnd =
    project?.planned_end_date ??
    tasks.reduce<string>((max, t) => {
      const d = t.planned_end_date ?? "";
      return d > max ? d : max;
    }, "");

  const totalDays = projectStart && projectEnd ? daysBetween(projectStart, projectEnd) : 120;

  // Build month labels for header
  const months: { label: string; days: number }[] = [];
  if (projectStart && totalDays > 0) {
    let cur = new Date(projectStart);
    const end = new Date(projectEnd);
    while (cur < end) {
      const monthStart = new Date(cur.getFullYear(), cur.getMonth(), 1);
      const monthEnd = new Date(cur.getFullYear(), cur.getMonth() + 1, 0);
      const clampedEnd = monthEnd < end ? monthEnd : end;
      const clampedStart = monthStart < new Date(projectStart) ? new Date(projectStart) : monthStart;
      const days =
        Math.round((clampedEnd.getTime() - clampedStart.getTime()) / 86_400_000) + 1;
      months.push({
        label: cur.toLocaleDateString("en-GB", { month: "short", year: "2-digit" }),
        days,
      });
      cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
    }
  }

  // Task bar position computation
  function barStyle(task: GanttTask) {
    if (!task.planned_start_date || !task.planned_end_date || !projectStart) {
      return { left: "0%", width: "0%" };
    }
    const offsetDays = daysBetween(projectStart, task.planned_start_date);
    const durationDays = daysBetween(task.planned_start_date, task.planned_end_date);
    const left = Math.max(0, (offsetDays / totalDays) * 100);
    const width = Math.max(0.5, (durationDays / totalDays) * 100);
    return {
      left: `${left.toFixed(2)}%`,
      width: `${Math.min(width, 100 - left).toFixed(2)}%`,
    };
  }

  // Stats
  const completed  = tasks.filter((t) => t.status === "completed").length;
  const delayed    = tasks.filter((t) => t.status === "delayed").length;
  const inProgress = tasks.filter((t) => t.status === "in_progress").length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="page-title">Schedule</h1>
          <p className="page-subtitle">
            {tasks.length} tasks · {completed} completed · {delayed} delayed
          </p>
        </div>
        {/* Legend */}
        <div className="hidden sm:flex items-center gap-3 text-xs flex-wrap justify-end">
          {LEGEND.map((leg) => (
            <span key={leg.label} className="flex items-center gap-1.5 text-stone-500">
              <span className={cn("w-3 h-3 rounded-sm flex-shrink-0", leg.color)} />
              {leg.label}
            </span>
          ))}
        </div>
      </div>

      {/* Summary chips */}
      <div className="flex gap-2 flex-wrap">
        <div className="px-3 py-1.5 bg-white rounded-lg border border-stone-200 text-sm">
          <span className="text-stone-500">Total: </span>
          <span className="font-semibold text-stone-800">{tasks.length}</span>
        </div>
        <div className="px-3 py-1.5 bg-green-50 rounded-lg border border-green-200 text-sm">
          <span className="text-green-700 font-semibold">{completed} completed</span>
        </div>
        {inProgress > 0 && (
          <div className="px-3 py-1.5 bg-brand-50 rounded-lg border border-brand-200 text-sm">
            <span className="text-brand-700 font-semibold">{inProgress} in progress</span>
          </div>
        )}
        {delayed > 0 && (
          <div className="px-3 py-1.5 bg-red-50 rounded-lg border border-red-200 text-sm">
            <span className="text-red-600 font-semibold">{delayed} delayed</span>
          </div>
        )}
      </div>

      {tasks.length === 0 ? (
        <EmptyState
          icon={<CalendarDays className="w-5 h-5" />}
          title="No tasks scheduled"
          description="Tasks will appear here once added to the project."
        />
      ) : (
        <>
          {/* Gantt Chart */}
          <div className="card overflow-hidden">
            <div className="flex">
              {/* Left: task names */}
              <div className="w-[300px] flex-shrink-0 border-r border-stone-200">
                <div className="h-10 px-4 flex items-center border-b border-stone-200 bg-stone-50">
                  <span className="text-xs font-semibold text-stone-500 uppercase tracking-wide">
                    Task
                  </span>
                </div>
                {tasks.map((task, i) => (
                  <div
                    key={task.id}
                    className={cn(
                      "h-11 px-4 flex items-center gap-2 border-b border-stone-100",
                      i % 2 === 0 ? "bg-white" : "bg-stone-50/50"
                    )}
                  >
                    <span
                      className="text-sm text-stone-700 flex-1 min-w-0 leading-tight"
                      title={task.name}
                    >
                      {task.name}
                    </span>
                    <Badge label={task.status} variant={task.status} className="text-[10px] flex-shrink-0" />
                  </div>
                ))}
              </div>

              {/* Right: scrollable timeline */}
              <div className="flex-1 overflow-x-auto">
                <div style={{ minWidth: "700px" }}>
                  {/* Month header */}
                  <div className="h-10 flex border-b border-stone-200 bg-stone-50">
                    {months.map((m, i) => (
                      <div
                        key={i}
                        className="flex-shrink-0 px-2 flex items-center justify-center border-r border-stone-200 text-xs font-medium text-stone-500"
                        style={{ width: `${(m.days / totalDays) * 100}%` }}
                      >
                        {m.label}
                      </div>
                    ))}
                  </div>

                  {/* Task rows */}
                  {tasks.map((task, i) => {
                    const style = barStyle(task);
                    const color = STATUS_COLORS[task.status] ?? "bg-stone-300";
                    return (
                      <div
                        key={task.id}
                        className={cn(
                          "h-11 relative flex items-center border-b border-stone-100",
                          i % 2 === 0 ? "bg-white" : "bg-stone-50/50"
                        )}
                      >
                        {/* Grid lines */}
                        <div className="absolute inset-0 flex pointer-events-none">
                          {months.map((m, j) => (
                            <div
                              key={j}
                              className="border-r border-stone-100 flex-shrink-0"
                              style={{ width: `${(m.days / totalDays) * 100}%` }}
                            />
                          ))}
                        </div>

                        {/* Task bar */}
                        <div
                          className="absolute h-6 rounded flex items-center overflow-hidden"
                          style={style}
                          title={`${task.name} — ${task.planned_start_date} → ${task.planned_end_date}`}
                        >
                          <div className={cn("absolute inset-0 rounded opacity-25", color)} />
                          <div
                            className={cn("absolute left-0 top-0 bottom-0 rounded", color)}
                            style={{ width: `${task.progress_percentage}%` }}
                          />
                          <span className="relative px-2 text-[10px] font-medium text-white truncate whitespace-nowrap">
                            {task.progress_percentage > 0 ? `${task.progress_percentage}%` : ""}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Task list table */}
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Task Details</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Task</th>
                    <th>Status</th>
                    <th>Priority</th>
                    <th>Start</th>
                    <th>End</th>
                    <th className="th-right">Progress</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((task) => (
                    <tr key={task.id}>
                      <td>
                        <span className="font-semibold text-stone-800">{task.name}</span>
                        {task.is_weather_sensitive && (
                          <span title="Weather sensitive">
                            <CloudRain
                              className="w-3.5 h-3.5 inline ml-2 text-sky-400"
                              strokeWidth={1.75}
                            />
                          </span>
                        )}
                      </td>
                      <td>
                        <Badge label={task.status} variant={task.status} />
                      </td>
                      <td>
                        <Badge label={task.priority} variant={task.priority} />
                      </td>
                      <td className="text-stone-500 tabular-nums">
                        {task.planned_start_date ?? "—"}
                      </td>
                      <td className="text-stone-500 tabular-nums">
                        {task.planned_end_date ?? "—"}
                      </td>
                      <td className="td-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-20 bg-stone-100 rounded-full h-1.5">
                            <div
                              className={cn("h-1.5 rounded-full", STATUS_COLORS[task.status] ?? "bg-stone-300")}
                              style={{ width: `${task.progress_percentage}%` }}
                            />
                          </div>
                          <span className="text-xs text-stone-500 w-8 text-right tabular-nums">
                            {task.progress_percentage}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
