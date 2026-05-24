"use client";

import { useAuth } from "@/features/auth/AuthContext";
import { useActiveProject } from "@/hooks/useActiveProject";
import { formatDate } from "@/lib/utils";

const ROLE_LABELS: Record<string, string> = {
  project_manager:  "Project Manager",
  site_supervisor:  "Site Supervisor",
  finance_officer:  "Finance Officer",
  viewer:           "Viewer",
};

export default function SettingsPage() {
  const { user } = useAuth();
  const { project } = useActiveProject();

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Account and project configuration
        </p>
      </div>

      {/* User Profile */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">
          Your Account
        </h2>
        <div className="flex items-center gap-4 mb-5">
          <div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center text-lg font-bold text-white flex-shrink-0">
            {user?.name
              .split(" ")
              .map((w) => w[0])
              .slice(0, 2)
              .join("")
              .toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-slate-900">{user?.name}</p>
            <p className="text-sm text-slate-500">{user?.email}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-slate-400 text-xs uppercase font-semibold mb-1">
              Role
            </p>
            <p className="font-medium text-slate-700">
              {ROLE_LABELS[user?.role ?? ""] ?? user?.role}
            </p>
          </div>
          <div>
            <p className="text-slate-400 text-xs uppercase font-semibold mb-1">
              Status
            </p>
            <span className="inline-flex items-center gap-1.5 text-green-700 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              Active
            </span>
          </div>
        </div>
      </div>

      {/* Project Info */}
      {project && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">
            Active Project
          </h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Project Name</span>
              <span className="font-medium text-slate-800">{project.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Location</span>
              <span className="font-medium text-slate-800">
                {project.location_name ?? "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Start Date</span>
              <span className="font-medium text-slate-800">
                {project.planned_start_date
                  ? formatDate(project.planned_start_date)
                  : "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">End Date</span>
              <span className="font-medium text-slate-800">
                {project.planned_end_date
                  ? formatDate(project.planned_end_date)
                  : "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Total Budget</span>
              <span className="font-medium text-slate-800">
                LKR {project.total_budget.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Status</span>
              <span className="font-medium text-slate-800 capitalize">
                {project.status}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Demo notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700">
        <p className="font-semibold mb-1">Demo Mode</p>
        <p className="text-blue-600">
          This is a demonstration build of ConstructAI. Data is pre-populated
          with a sample Two-Storey House Construction project in Colombo, Sri
          Lanka (LKR 12,000,000 budget, 120 days).
        </p>
        <div className="mt-3 space-y-1 font-mono text-xs">
          <p>pm@constructai.lk / demo1234</p>
          <p>supervisor@constructai.lk / demo1234</p>
          <p>finance@constructai.lk / demo1234</p>
        </div>
      </div>

      {/* System info */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">
          System Information
        </h2>
        <div className="space-y-2 text-sm text-slate-600">
          {[
            { label: "API", value: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000" },
            { label: "Stack", value: "Next.js 15 + FastAPI + PostgreSQL" },
            { label: "Cost Model", value: "Rule-based v1" },
            { label: "Version", value: "1.0.0-demo" },
          ].map((row) => (
            <div key={row.label} className="flex justify-between">
              <span className="text-slate-400">{row.label}</span>
              <span className="font-medium font-mono text-xs">{row.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
