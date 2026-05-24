import { apiClient } from "./api";

export interface ProjectOut {
  id: number;
  name: string;
  description?: string | null;
  location_name?: string | null;
  planned_start_date?: string | null;
  planned_end_date?: string | null;
  total_budget: number;
  status: string;
  created_at?: string | null;
}

export interface ProjectDashboard {
  project: ProjectOut;
  total_budget: number;
  actual_cost_to_date: number;
  budget_used_pct: number;
  task_count: number;
  completed_tasks: number;
  delayed_tasks: number;
  progress_pct: number;
  workers_count: number;
  today_attendance: number;
  low_stock_count: number;
  open_alerts: number;
  material_cost: number;
  labour_cost: number;
  other_cost: number;
}

export interface ProjectCreate {
  name: string;
  description?: string;
  location_name?: string;
  planned_start_date?: string;
  planned_end_date?: string;
  total_budget: number;
}

export const projectsApi = {
  list: () => apiClient.get<ProjectOut[]>("/projects").then((r) => r.data),
  get: (id: number) =>
    apiClient.get<ProjectOut>(`/projects/${id}`).then((r) => r.data),
  create: (data: ProjectCreate) =>
    apiClient.post<ProjectOut>("/projects", data).then((r) => r.data),
  dashboard: (id: number) =>
    apiClient
      .get<ProjectDashboard>(`/projects/${id}/dashboard`)
      .then((r) => r.data),
};
