// Core domain types — kept in sync with packages/shared/src/types/models.ts

export interface Project {
  id: number;
  name: string;
  location_name: string;
  planned_start_date: string;
  planned_end_date: string;
  total_budget: number;
  status: "active" | "completed" | "on_hold";
}

export interface Task {
  id: number;
  project_id: number;
  name: string;
  planned_start_date: string;
  planned_end_date: string;
  progress_percentage: number;
  status: "not_started" | "in_progress" | "completed" | "delayed" | "blocked";
  priority: "low" | "medium" | "high" | "critical";
}

export interface Worker {
  id: number;
  project_id: number;
  full_name: string;
  worker_code: string;
  skill_type: string;
  daily_rate: number;
  is_active: boolean;
}

export interface Material {
  id: number;
  project_id: number;
  name: string;
  unit: string;
  current_stock: number;
  reorder_level: number;
}

export interface Alert {
  id: number;
  project_id: number;
  alert_type: string;
  severity: "info" | "warning" | "critical";
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export interface ScanResult {
  type: string;
  data: string;
}
