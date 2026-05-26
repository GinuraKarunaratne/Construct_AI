"use client";

import { useAuth } from "@/features/auth/AuthContext";
import { useActiveProject } from "@/hooks/useActiveProject";
import { formatDate, formatCurrency } from "@/lib/utils";
import { Info, User, FolderOpen, Server } from "lucide-react";

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
    <div className="space-y-8 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">Account and project configuration</p>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Left column */}
        <div className="space-y-6">

          {/* User Profile */}
          <div className="card">
            <div className="card-header">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-ink-500" strokeWidth={2} />
                <h2 className="card-title">Your Account</h2>
              </div>
            </div>
            <div className="p-6">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 rounded-full bg-ink-900 flex items-center justify-center text-lg font-bold text-white flex-shrink-0">
                  {initials}
                </div>
                <div>
                  <p className="font-semibold text-ink-900 text-base">{user?.name}</p>
                  <p className="text-sm text-ink-500 mt-0.5">{user?.email}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-5 border-t border-surface-divider">
                <div>
                  <p className="text-xs text-ink-500 font-medium mb-1.5">Role</p>
                  <p className="font-semibold text-ink-900 text-sm">
                    {ROLE_LABELS[user?.role ?? ""] ?? user?.role}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-ink-500 font-medium mb-1.5">Status</p>
                  <span className="status-badge status-badge-success">
                    <span className="status-dot bg-success-500" />
                    Active
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* System info */}
          <div className="card">
            <div className="card-header">
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4 text-ink-500" strokeWidth={2} />
                <h2 className="card-title">System Information</h2>
              </div>
            </div>
            <div className="p-6 space-y-1">
              {[
                { label: "API",         value: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000" },
                { label: "Stack",       value: "Next.js 15 + FastAPI + PostgreSQL" },
                { label: "Cost Model",  value: "GradientBoosting ML (R²=0.92)" },
                { label: "Version",     value: "1.0.0-demo" },
              ].map((row) => (
                <div key={row.label} className="flex justify-between items-center py-2.5 border-b border-surface-divider last:border-0">
                  <span className="text-sm text-ink-500">{row.label}</span>
                  <span className="font-medium font-mono text-xs text-ink-700">{row.value}</span>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Right column */}
        <div className="space-y-6">

          {/* Project Info */}
          {project && (
            <div className="card">
              <div className="card-header">
                <div className="flex items-center gap-2">
                  <FolderOpen className="w-4 h-4 text-ink-500" strokeWidth={2} />
                  <h2 className="card-title">Active Project</h2>
                </div>
              </div>
              <div className="p-6 space-y-1">
                {[
                  { label: "Project ID",   value: `PROJ-${String(project.id).padStart(4, "0")}` },
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
                  <div key={row.label} className="flex justify-between items-center py-2.5 border-b border-surface-divider last:border-0">
                    <span className="text-sm text-ink-500">{row.label}</span>
                    <span className="font-semibold text-ink-900 text-sm capitalize text-right">{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Demo notice */}
          <div className="flex items-start gap-3 p-5 bg-white border border-surface-border rounded-xl">
            <Info className="w-4 h-4 text-ink-500 flex-shrink-0 mt-0.5" strokeWidth={2} />
            <div>
              <p className="font-semibold text-ink-900 mb-1.5 text-sm">Demo Mode</p>
              <p className="text-ink-600 leading-relaxed text-sm">
                This is a demonstration build of ConstructAI pre-populated with a sample
                Two-Storey House Construction project in Colombo, Sri Lanka (LKR 12,000,000
                budget, 120 days). Three test accounts are available — use the login screen
                for credentials.
              </p>
              <div className="mt-3 space-y-1 font-mono text-xs text-ink-500">
                <p>pm@constructai.lk · ••••••••</p>
                <p>supervisor@constructai.lk · ••••••••</p>
                <p>finance@constructai.lk · ••••••••</p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
