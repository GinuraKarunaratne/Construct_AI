"use client";

import { useAuth } from "@/features/auth/AuthContext";
import { useActiveProject } from "@/hooks/useActiveProject";
import { formatDate, formatCurrency } from "@/lib/utils";
import { Info } from "lucide-react";

const ROLE_LABELS: Record<string, string> = {
  project_manager: "Project Manager",
  site_supervisor: "Site Supervisor",
  finance_officer: "Finance Officer",
  viewer:          "Viewer",
};

export default function SettingsPage() {
  const { user } = useAuth();
  const { project } = useActiveProject();

  const initials = user?.name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() ?? "?";

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">Account and project configuration</p>
      </div>

      {/* User Profile */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Your Account</h2>
        </div>
        <div className="p-5">
          <div className="flex items-center gap-4 mb-5">
            <div className="w-12 h-12 rounded-full bg-brand-600 flex items-center justify-center text-base font-bold text-white flex-shrink-0 shadow-sm">
              {initials}
            </div>
            <div>
              <p className="font-semibold text-stone-900">{user?.name}</p>
              <p className="text-sm text-stone-500">{user?.email}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm pt-4 border-t border-stone-100">
            <div>
              <p className="text-[11px] text-stone-400 uppercase font-semibold tracking-wide mb-1">
                Role
              </p>
              <p className="font-medium text-stone-700">
                {ROLE_LABELS[user?.role ?? ""] ?? user?.role}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-stone-400 uppercase font-semibold tracking-wide mb-1">
                Status
              </p>
              <span className="inline-flex items-center gap-1.5 text-green-700 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                Active
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Project Info */}
      {project && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Active Project</h2>
          </div>
          <div className="p-5 space-y-3 text-sm">
            {[
              { label: "Project Name", value: project.name },
              { label: "Location",     value: project.location_name ?? "—" },
              {
                label: "Start Date",
                value: project.planned_start_date ? formatDate(project.planned_start_date) : "—",
              },
              {
                label: "End Date",
                value: project.planned_end_date ? formatDate(project.planned_end_date) : "—",
              },
              {
                label: "Total Budget",
                value: formatCurrency(project.total_budget),
              },
              { label: "Status", value: project.status },
            ].map((row) => (
              <div key={row.label} className="flex justify-between items-center py-1 border-b border-stone-50 last:border-0">
                <span className="text-stone-500">{row.label}</span>
                <span className="font-medium text-stone-800 capitalize">{row.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Demo notice */}
      <div className="flex items-start gap-3 p-4 bg-brand-50 border border-brand-200 rounded-xl text-sm text-brand-800">
        <Info className="w-4 h-4 text-brand-600 flex-shrink-0 mt-0.5" strokeWidth={2} />
        <div>
          <p className="font-semibold mb-1">Demo Mode</p>
          <p className="text-brand-700 leading-relaxed">
            This is a demonstration build of ConstructAI. Data is pre-populated
            with a sample Two-Storey House Construction project in Colombo, Sri
            Lanka (LKR 12,000,000 budget, 120 days).
          </p>
          <div className="mt-3 space-y-1 font-mono text-xs text-brand-600">
            <p>pm@constructai.lk / demo1234</p>
            <p>supervisor@constructai.lk / demo1234</p>
            <p>finance@constructai.lk / demo1234</p>
          </div>
        </div>
      </div>

      {/* System info */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">System Information</h2>
        </div>
        <div className="p-5 space-y-2.5 text-sm">
          {[
            { label: "API",         value: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000" },
            { label: "Stack",       value: "Next.js 15 + FastAPI + PostgreSQL" },
            { label: "Cost Model",  value: "Rule-based v1" },
            { label: "Version",     value: "1.0.0-demo" },
          ].map((row) => (
            <div key={row.label} className="flex justify-between items-center">
              <span className="text-stone-400">{row.label}</span>
              <span className="font-medium font-mono text-xs text-stone-600">{row.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
