"use client";

import { useState, FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { projectsApi, ProjectCreate } from "@/services/projects";
import { LoadingSpinner, EmptyState } from "@/components/ui/LoadingSpinner";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Plus, MapPin, FolderOpen, AlertTriangle, CalendarClock, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

function formatProjectId(id: number): string {
  return `PROJ-${String(id).padStart(4, "0")}`;
}

function daysRemaining(endDate: string | null | undefined): number | null {
  if (!endDate) return null;
  return Math.round(
    (new Date(endDate).getTime() - Date.now()) / 86_400_000
  );
}

export default function ProjectsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ProjectCreate>({
    name: "",
    description: "",
    location_name: "",
    planned_start_date: "",
    planned_end_date: "",
    total_budget: 0,
  });
  const [err, setErr] = useState<string | null>(null);

  const { data: projects, isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: projectsApi.list,
  });

  const create = useMutation({
    mutationFn: projectsApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      setOpen(false);
      setForm({
        name: "",
        description: "",
        location_name: "",
        planned_start_date: "",
        planned_end_date: "",
        total_budget: 0,
      });
      setErr(null);
    },
    onError: (e: unknown) => {
      setErr(
        (e as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? "Failed to create project"
      );
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    create.mutate(form);
  }

  if (isLoading) return <LoadingSpinner message="Loading projects…" />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="page-title">Projects</h1>
          <p className="page-subtitle">
            {projects?.length ?? 0} project{projects?.length !== 1 ? "s" : ""} in your workspace
          </p>
        </div>
        <button onClick={() => { setErr(null); setOpen(true); }} className="btn-primary">
          <Plus className="w-4 h-4" strokeWidth={2.5} />
          New Project
        </button>
      </div>

      {/* Project cards */}
      {(projects ?? []).length === 0 ? (
        <EmptyState
          icon={<FolderOpen className="w-5 h-5" />}
          title="No projects yet"
          description='Click "New Project" to get started.'
          action={
            <button onClick={() => { setErr(null); setOpen(true); }} className="btn-primary">
              <Plus className="w-4 h-4" strokeWidth={2.5} />
              New Project
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {(projects ?? []).map((p) => {
            const totalDays =
              p.planned_start_date && p.planned_end_date
                ? Math.round(
                    (new Date(p.planned_end_date).getTime() -
                      new Date(p.planned_start_date).getTime()) /
                      86_400_000
                  )
                : null;

            const remaining = daysRemaining(p.planned_end_date);
            const isOverdue = remaining !== null && remaining < 0;
            const isDueSoon = remaining !== null && remaining >= 0 && remaining <= 14;

            return (
              <div
                key={p.id}
                className={cn(
                  "card hover:shadow-md transition-shadow duration-150",
                  isOverdue && "border-red-200 bg-red-50/30"
                )}
              >
                <div className="p-5">
                  {/* Top row: ID + status */}
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono text-[11px] text-stone-400 bg-stone-100 px-1.5 py-0.5 rounded flex-shrink-0">
                        {formatProjectId(p.id)}
                      </span>
                      <Badge label={p.status} variant={p.status} />
                    </div>
                    {isOverdue && (
                      <span className="flex items-center gap-1 text-[11px] text-red-600 font-semibold flex-shrink-0">
                        <AlertTriangle className="w-3 h-3" strokeWidth={2.5} />
                        Overdue
                      </span>
                    )}
                    {isDueSoon && !isOverdue && (
                      <span className="flex items-center gap-1 text-[11px] text-amber-600 font-semibold flex-shrink-0">
                        <Clock className="w-3 h-3" strokeWidth={2.5} />
                        Due in {remaining}d
                      </span>
                    )}
                  </div>

                  {/* Name + location */}
                  <div className="mb-3">
                    <h2 className="font-bold text-stone-900 text-base leading-tight">{p.name}</h2>
                    {p.location_name && (
                      <p className="flex items-center gap-1 text-xs text-stone-500 mt-1">
                        <MapPin className="w-3 h-3 flex-shrink-0" strokeWidth={2} />
                        {p.location_name}
                      </p>
                    )}
                  </div>

                  {p.description && (
                    <p className="text-sm text-stone-500 mb-3 leading-relaxed line-clamp-2">
                      {p.description}
                    </p>
                  )}

                  {/* Metrics grid */}
                  <div className="grid grid-cols-4 gap-2 pt-3 border-t border-stone-100 text-sm">
                    <div>
                      <p className="text-[11px] text-stone-400 mb-0.5">Budget</p>
                      <p className="font-semibold text-stone-800 text-xs">
                        {formatCurrency(p.total_budget)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-stone-400 mb-0.5">Start</p>
                      <p className="font-medium text-stone-600 text-xs">
                        {p.planned_start_date ? formatDate(p.planned_start_date) : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-stone-400 mb-0.5">End</p>
                      <p className={cn("font-medium text-xs", isOverdue ? "text-red-600" : "text-stone-600")}>
                        {p.planned_end_date ? formatDate(p.planned_end_date) : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-stone-400 mb-0.5">Duration</p>
                      <p className="font-medium text-stone-600 text-xs flex items-center gap-1">
                        <CalendarClock className="w-3 h-3 text-stone-400" strokeWidth={2} />
                        {totalDays != null ? `${totalDays}d` : "—"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create modal */}
      <Modal open={open} onClose={() => setOpen(false)} title="Create New Project">
        <form onSubmit={handleSubmit} className="space-y-4">
          {err && (
            <div role="alert" className="flex items-start gap-2 px-3.5 py-2.5 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" strokeWidth={2} />
              {err}
            </div>
          )}
          <div>
            <label className="form-label">Project Name *</label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Two-Storey House Construction"
              className="form-input"
            />
          </div>
          <div>
            <label className="form-label">Location</label>
            <input
              value={form.location_name}
              onChange={(e) =>
                setForm((f) => ({ ...f, location_name: e.target.value }))
              }
              placeholder="e.g. Colombo 7, Sri Lanka"
              className="form-input"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Start Date</label>
              <input
                type="date"
                value={form.planned_start_date}
                onChange={(e) =>
                  setForm((f) => ({ ...f, planned_start_date: e.target.value }))
                }
                className="form-input"
              />
            </div>
            <div>
              <label className="form-label">End Date</label>
              <input
                type="date"
                value={form.planned_end_date}
                onChange={(e) =>
                  setForm((f) => ({ ...f, planned_end_date: e.target.value }))
                }
                className="form-input"
              />
            </div>
          </div>
          <div>
            <label className="form-label">Total Budget (LKR) *</label>
            <input
              type="number"
              required
              min={0}
              value={form.total_budget || ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, total_budget: Number(e.target.value) }))
              }
              placeholder="12000000"
              className="form-input"
            />
          </div>
          <div>
            <label className="form-label">Description</label>
            <textarea
              rows={2}
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
              placeholder="Brief project description…"
              className="form-input resize-none"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-stone-100">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={create.isPending}
              className="btn-primary"
            >
              {create.isPending && (
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              Create Project
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
