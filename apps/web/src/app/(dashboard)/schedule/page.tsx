"use client";

import { useQuery } from "@tanstack/react-query";
import { useActiveProject } from "@/hooks/useActiveProject";
import { tasksApi, GanttTask } from "@/services/tasks";
import { weatherApi, WeatherImpact, ForecastDay } from "@/services/weather";
import { LoadingSpinner, EmptyState } from "@/components/ui/LoadingSpinner";
import { Badge } from "@/components/ui/Badge";
import {
  CalendarDays, CloudRain, Wind, Droplets, AlertTriangle,
  CheckCircle2, Info, Sun, Cloud, CloudLightning, Snowflake,
} from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_COLORS: Record<string, string> = {
  completed:   "bg-green-500",
  in_progress: "bg-info-500",
  delayed:     "bg-red-500",
  not_started: "bg-gray-300",
};

const LEGEND = [
  { label: "Completed",   color: "bg-green-500"  },
  { label: "In Progress", color: "bg-info-500"  },
  { label: "Delayed",     color: "bg-red-500"    },
  { label: "Not Started", color: "bg-gray-300"  },
];

function daysBetween(a: string, b: string) {
  return Math.round(
    (new Date(b).getTime() - new Date(a).getTime()) / 86_400_000
  );
}

// ── Risk badge style ──────────────────────────────────────────────────────────
const RISK_BADGE: Record<string, string> = {
  high:     "bg-red-100 text-red-700",
  moderate: "bg-amber-100 text-amber-700",
  low:      "bg-sky-100 text-sky-700",
  none:     "bg-emerald-100 text-emerald-700",
};

// ── Condition → visual config ─────────────────────────────────────────────────
interface CondCfg {
  Icon: React.ElementType;
  iconClass: string;
  labelColor: string;
  label: string;
  gradient: string; // inline CSS gradient
}

function getConditionConfig(condition: string): CondCfg {
  const c = condition.toLowerCase();
  if (c.includes("thunder") || c.includes("storm")) {
    return {
      Icon: CloudLightning, iconClass: "text-indigo-500", labelColor: "text-indigo-700",
      label: "Thunderstorm",
      gradient: "linear-gradient(to bottom, #eef2ff, #e0e7ff)",
    };
  }
  if (c.includes("snow") || c.includes("sleet") || c.includes("hail")) {
    return {
      Icon: Snowflake, iconClass: "text-blue-400", labelColor: "text-blue-700",
      label: "Snow",
      gradient: "linear-gradient(to bottom, #eff6ff, #dbeafe)",
    };
  }
  if (c.includes("rain") || c.includes("drizzle") || c.includes("shower")) {
    return {
      Icon: CloudRain, iconClass: "text-sky-500", labelColor: "text-sky-700",
      label: condition || "Rain",
      gradient: "linear-gradient(to bottom, #f0f9ff, #bae6fd)",
    };
  }
  if (c.includes("clear") || c.includes("sun")) {
    return {
      Icon: Sun, iconClass: "text-amber-500", labelColor: "text-amber-700",
      label: "Clear",
      gradient: "linear-gradient(to bottom, #fffbeb, #fde68a)",
    };
  }
  if (c.includes("cloud") || c.includes("overcast")) {
    return {
      Icon: Cloud, iconClass: "text-gray-400", labelColor: "text-gray-600",
      label: condition || "Cloudy",
      gradient: "linear-gradient(to bottom, #f9fafb, #e5e7eb)",
    };
  }
  // mist / fog / haze / default
  return {
    Icon: CloudRain, iconClass: "text-gray-400", labelColor: "text-gray-500",
    label: condition || "—",
    gradient: "linear-gradient(to bottom, #f9fafb, #f1f5f9)",
  };
}

// ── iOS-style weather day card ────────────────────────────────────────────────
function WeatherDayCard({ day, flagged }: { day: ForecastDay; flagged: boolean }) {
  const pop = Math.round(day.max_pop * 100);
  const isRisky = day.max_pop >= 0.60 || day.max_wind_ms >= 10;
  const cfg = getConditionConfig(day.conditions[0] ?? "");

  const dateObj = new Date(day.date + "T12:00:00");
  const dayName  = dateObj.toLocaleDateString("en-GB", { weekday: "short" });
  const dateName = dateObj.toLocaleDateString("en-GB", { day: "numeric", month: "short" });

  const hasTemp = day.temp_max != null && day.temp_min != null;

  return (
    <div
      className={cn(
        "bg-white rounded-2xl border overflow-hidden flex flex-col transition-all",
        flagged ? "border-amber-300 ring-1 ring-amber-200" : "border-gray-100"
      )}
    >
      {/* Top — date + primary stat */}
      <div className="px-4 pt-4 pb-3 flex-1">
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">{dayName}</p>
        <p className="text-[11px] text-gray-300 mb-3 leading-none">{dateName}</p>

        {hasTemp ? (
          <>
            <p className="text-3xl font-bold text-gray-900 leading-none tabular-nums">
              {Math.round(day.temp_max!)}°
            </p>
            <p className="text-xs text-gray-400 mt-1.5 tabular-nums">
              H: {Math.round(day.temp_max!)}° · L: {Math.round(day.temp_min!)}°
            </p>
          </>
        ) : (
          <>
            <p className={cn("text-3xl font-bold leading-none tabular-nums",
              pop >= 60 ? "text-sky-600" : "text-gray-700")}>
              {pop}%
            </p>
            <p className="text-xs text-gray-400 mt-1.5">Precipitation</p>
          </>
        )}

        <div className="flex items-center gap-1 mt-3">
          <Wind className="w-3 h-3 text-gray-300 flex-shrink-0" strokeWidth={1.75} />
          <span className="text-[11px] text-gray-400 tabular-nums">
            {day.max_wind_ms.toFixed(0)} m/s
          </span>
          {hasTemp && pop > 0 && (
            <>
              <Droplets className="w-3 h-3 text-sky-300 flex-shrink-0 ml-1" strokeWidth={1.75} />
              <span className="text-[11px] text-sky-400 tabular-nums">{pop}%</span>
            </>
          )}
        </div>
      </div>

      {/* Bottom — gradient strip with condition */}
      <div
        className="px-4 py-3 flex items-center gap-2"
        style={{ background: cfg.gradient }}
      >
        <cfg.Icon className={cn("w-5 h-5 flex-shrink-0", cfg.iconClass)} strokeWidth={1.75} />
        <p className={cn("text-xs font-semibold truncate flex-1", cfg.labelColor)}>
          {cfg.label}
        </p>
        {isRisky && (
          <span className="text-[9px] font-bold text-amber-600 uppercase tracking-wider flex-shrink-0">
            Risk
          </span>
        )}
      </div>
    </div>
  );
}

function WeatherPanel({ weather, projectHasCoords }: { weather: WeatherImpact | null; projectHasCoords: boolean }) {
  if (!projectHasCoords) {
    return (
      <div className="flex items-start gap-3 p-4 bg-sky-50/60 border border-sky-100 rounded-xl text-sm">
        <CloudRain className="w-4 h-4 text-sky-400 mt-0.5 flex-shrink-0" strokeWidth={1.75} />
        <div>
          <p className="font-semibold text-gray-700">Weather forecast unavailable</p>
          <p className="text-xs text-gray-500 mt-0.5">
            Add project coordinates to enable 5-day weather risk for weather-sensitive tasks.
          </p>
        </div>
      </div>
    );
  }

  if (!weather || !weather.available) {
    return (
      <div className="flex items-start gap-3 p-4 bg-gray-50 border border-gray-200 rounded-xl text-sm">
        <Info className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" strokeWidth={1.75} />
        <p className="text-gray-500">Weather forecast unavailable — check API configuration.</p>
      </div>
    );
  }

  const { forecast_days, flagged_tasks, overall_weather_risk } = weather;
  const riskLabel = overall_weather_risk.charAt(0).toUpperCase() + overall_weather_risk.slice(1);

  // Set of dates with flagged tasks for highlighting
  const flaggedDates = new Set(flagged_tasks.map((ft) => ft.risk_date));

  return (
    <div className="card border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3.5 flex items-center justify-between gap-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <CloudRain className="w-4 h-4 text-sky-500" strokeWidth={1.75} />
          <h2 className="text-sm font-semibold text-gray-800">5-Day Weather Forecast</h2>
        </div>
        <span className={cn("text-[11px] font-semibold px-2.5 py-0.5 rounded-full", RISK_BADGE[overall_weather_risk])}>
          {riskLabel} risk
        </span>
      </div>

      <div className="p-5 space-y-5">
        {/* Day cards grid */}
        {forecast_days.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {forecast_days.slice(0, 5).map((day: ForecastDay) => (
              <WeatherDayCard
                key={day.date}
                day={day}
                flagged={flaggedDates.has(day.date)}
              />
            ))}
          </div>
        )}

        {/* At-risk tasks */}
        {flagged_tasks.length > 0 ? (
          <div>
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
              At-risk tasks
            </p>
            <div className="space-y-1.5">
              {flagged_tasks.map((ft, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border px-4 py-3",
                    ft.risk_level === "high"
                      ? "bg-red-50 border-red-200"
                      : "bg-amber-50 border-amber-200"
                  )}
                >
                  <AlertTriangle
                    className={cn("w-4 h-4 flex-shrink-0", ft.risk_level === "high" ? "text-red-500" : "text-amber-500")}
                    strokeWidth={2}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{ft.task_name}</p>
                    <p className="text-[11px] text-gray-400">{ft.risk_date} · {ft.reason}</p>
                  </div>
                  <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize flex-shrink-0", RISK_BADGE[ft.risk_level])}>
                    {ft.risk_level}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-emerald-700">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" strokeWidth={2} />
            <p className="text-sm font-medium">No weather-sensitive tasks at risk in the next 5 days.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SchedulePage() {
  const { projectId, project, isLoading: projLoading } = useActiveProject();

  const { data: ganttData, isLoading } = useQuery({
    queryKey: ["gantt", projectId],
    queryFn: () => tasksApi.gantt(projectId!),
    enabled: !!projectId,
  });

  const { data: weather } = useQuery({
    queryKey: ["weather-impact", projectId],
    queryFn: () => weatherApi.impact(projectId!),
    enabled: !!projectId,
    staleTime: 60 * 60 * 1000,   // 1 hour — matches OWM cache TTL
    retry: false,
  });

  const projectHasCoords =
    project?.latitude != null && project?.longitude != null;

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
            <span key={leg.label} className="flex items-center gap-1.5 text-gray-500">
              <span className={cn("w-3 h-3 rounded-sm flex-shrink-0", leg.color)} />
              {leg.label}
            </span>
          ))}
        </div>
      </div>

      {/* Filter chips (Untitled UI style) */}
      <div className="flex gap-2 flex-wrap">
        <span className="filter-chip">
          Total <span className="font-semibold text-ink-900 ml-1">{tasks.length}</span>
        </span>
        <span className="filter-chip">
          <span className="status-dot bg-success-500" />
          {completed} completed
        </span>
        {inProgress > 0 && (
          <span className="filter-chip">
            <span className="status-dot bg-info-500" />
            {inProgress} in progress
          </span>
        )}
        {delayed > 0 && (
          <span className="filter-chip">
            <span className="status-dot bg-danger-500" />
            {delayed} delayed
          </span>
        )}
      </div>

      {/* Weather risk panel — always shown (adapts to missing coords/key) */}
      <WeatherPanel weather={weather ?? null} projectHasCoords={projectHasCoords} />

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
              <div className="w-[160px] sm:w-[260px] lg:w-[300px] flex-shrink-0 border-r border-gray-200">
                <div className="h-10 px-4 flex items-center border-b border-gray-200 bg-gray-50">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Task
                  </span>
                </div>
                {tasks.map((task, i) => (
                  <div
                    key={task.id}
                    className={cn(
                      "h-11 px-4 flex items-center gap-2 border-b border-gray-100",
                      i % 2 === 0 ? "bg-white" : "bg-gray-50/50"
                    )}
                  >
                    <span
                      className="text-sm text-gray-700 flex-1 min-w-0 leading-tight"
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
                  <div className="h-10 flex border-b border-gray-200 bg-gray-50">
                    {months.map((m, i) => (
                      <div
                        key={i}
                        className="flex-shrink-0 px-2 flex items-center justify-center border-r border-gray-200 text-xs font-medium text-gray-500"
                        style={{ width: `${(m.days / totalDays) * 100}%` }}
                      >
                        {m.label}
                      </div>
                    ))}
                  </div>

                  {/* Task rows */}
                  {tasks.map((task, i) => {
                    const style = barStyle(task);
                    const color = STATUS_COLORS[task.status] ?? "bg-gray-300";
                    return (
                      <div
                        key={task.id}
                        className={cn(
                          "h-11 relative flex items-center border-b border-gray-100",
                          i % 2 === 0 ? "bg-white" : "bg-gray-50/50"
                        )}
                      >
                        {/* Grid lines */}
                        <div className="absolute inset-0 flex pointer-events-none">
                          {months.map((m, j) => (
                            <div
                              key={j}
                              className="border-r border-gray-100 flex-shrink-0"
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
                        <span className="font-semibold text-gray-800">{task.name}</span>
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
                      <td className="text-gray-500 tabular-nums">
                        {task.planned_start_date ?? "—"}
                      </td>
                      <td className="text-gray-500 tabular-nums">
                        {task.planned_end_date ?? "—"}
                      </td>
                      <td className="td-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-20 progress-track h-1.5">
                            <div
                              className={cn("progress-bar h-1.5", STATUS_COLORS[task.status] ?? "bg-gray-300")}
                              style={{ width: `${task.progress_percentage}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500 w-8 text-right tabular-nums">
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
