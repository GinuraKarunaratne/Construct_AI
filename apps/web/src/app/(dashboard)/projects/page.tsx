"use client";

import { useState, FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { projectsApi, ProjectCreate } from "@/services/projects";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { formatCurrency, formatDate } from "@/lib/utils";

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Projects</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {projects?.length ?? 0} project{projects?.length !== 1 ? "s" : ""}{" "}
            in your workspace
          </p>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Project
        </button>
      </div>

      {/* Project cards */}
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

          return (
            <div
              key={p.id}
              className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <h2 className="font-semibold text-slate-900">{p.name}</h2>
                  {p.location_name && (
                    <p className="text-xs text-slate-500 mt-0.5">
                      📍 {p.location_name}
                    </p>
                  )}
                </div>
                <Badge label={p.status} variant={p.status} />
              </div>

              {p.description && (
                <p className="text-sm text-slate-600 mb-3">{p.description}</p>
              )}

              <div className="grid grid-cols-3 gap-3 text-sm">
                <div>
                  <p className="text-xs text-slate-400">Budget</p>
                  <p className="font-medium text-slate-800">
                    {formatCurrency(p.total_budget)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Start</p>
                  <p className="font-medium text-slate-800">
                    {p.planned_start_date
                      ? formatDate(p.planned_start_date)
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Duration</p>
                  <p className="font-medium text-slate-800">
                    {totalDays != null ? `${totalDays} days` : "—"}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {projects?.length === 0 && (
        <div className="text-center py-20 text-slate-400">
          <p className="text-lg font-medium">No projects yet</p>
          <p className="text-sm mt-1">Click "New Project" to get started.</p>
        </div>
      )}

      {/* Create modal */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Create New Project"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {err && (
            <div className="px-3 py-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
              {err}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Project Name *
            </label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Two-Storey House Construction"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Location
            </label>
            <input
              value={form.location_name}
              onChange={(e) =>
                setForm((f) => ({ ...f, location_name: e.target.value }))
              }
              placeholder="e.g. Colombo 7, Sri Lanka"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={form.planned_start_date}
                onChange={(e) =>
                  setForm((f) => ({ ...f, planned_start_date: e.target.value }))
                }
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                End Date
              </label>
              <input
                type="date"
                value={form.planned_end_date}
                onChange={(e) =>
                  setForm((f) => ({ ...f, planned_end_date: e.target.value }))
                }
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Total Budget (LKR) *
            </label>
            <input
              type="number"
              required
              min={0}
              value={form.total_budget || ""}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  total_budget: Number(e.target.value),
                }))
              }
              placeholder="12000000"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Description
            </label>
            <textarea
              rows={2}
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
              placeholder="Brief project description…"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={create.isPending}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg transition-colors flex items-center gap-2"
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
