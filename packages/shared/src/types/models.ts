// Core domain model types shared across web and mobile apps.
// These mirror the backend Pydantic schemas.

export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
}

// ────────────────────────────────────────────────────────────
// Auth
// ────────────────────────────────────────────────────────────

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: "bearer";
  user: UserProfile;
}

export interface UserProfile {
  id: number;
  name: string;
  email: string;
  role: UserRole;
}

export type UserRole =
  | "admin"
  | "project_manager"
  | "site_supervisor"
  | "material_manager"
  | "finance_officer"
  | "viewer";

// ────────────────────────────────────────────────────────────
// Projects
// ────────────────────────────────────────────────────────────

export type ProjectStatus = "planning" | "active" | "on_hold" | "completed" | "cancelled";

export interface Project {
  id: number;
  company_id: number;
  name: string;
  description?: string;
  location_name: string;
  latitude?: number;
  longitude?: number;
  planned_start_date: string;
  planned_end_date: string;
  actual_start_date?: string;
  actual_end_date?: string;
  total_budget: number;
  status: ProjectStatus;
  created_at: string;
  updated_at: string;
}

// ────────────────────────────────────────────────────────────
// Tasks
// ────────────────────────────────────────────────────────────

export type TaskStatus = "not_started" | "in_progress" | "completed" | "delayed" | "blocked";
export type TaskPriority = "low" | "medium" | "high" | "critical";

export interface Task {
  id: number;
  project_id: number;
  parent_task_id?: number;
  name: string;
  description?: string;
  planned_start_date: string;
  planned_end_date: string;
  actual_start_date?: string;
  actual_end_date?: string;
  duration_days: number;
  progress_percentage: number;
  status: TaskStatus;
  priority: TaskPriority;
  is_weather_sensitive: boolean;
  estimated_cost?: number;
  actual_cost?: number;
  assigned_user_id?: number;
  created_at: string;
  updated_at: string;
}

// ────────────────────────────────────────────────────────────
// Materials
// ────────────────────────────────────────────────────────────

export type MaterialTransactionType = "delivery" | "issue" | "return" | "wastage" | "adjustment";

export interface Material {
  id: number;
  project_id: number;
  name: string;
  category: string;
  unit: string;
  estimated_quantity: number;
  reorder_level: number;
  unit_cost_estimate: number;
  current_stock: number;
  created_at: string;
}

export interface MaterialTransaction {
  id: number;
  material_item_id: number;
  project_id: number;
  task_id?: number;
  transaction_type: MaterialTransactionType;
  quantity: number;
  unit_cost?: number;
  supplier_name?: string;
  reference_no?: string;
  qr_code?: string;
  notes?: string;
  transaction_date: string;
  created_by: number;
  created_at: string;
}

// ────────────────────────────────────────────────────────────
// Workers & Attendance
// ────────────────────────────────────────────────────────────

export interface Worker {
  id: number;
  project_id: number;
  full_name: string;
  worker_code: string;
  skill_type: string;
  daily_rate: number;
  overtime_rate: number;
  phone?: string;
  is_active: boolean;
  created_at: string;
}

export type AttendanceStatus = "present" | "absent" | "half_day" | "leave";
export type AttendanceMethod = "qr" | "manual" | "face";

export interface Attendance {
  id: number;
  project_id: number;
  worker_id: number;
  attendance_date: string;
  check_in_time?: string;
  check_out_time?: string;
  status: AttendanceStatus;
  overtime_hours: number;
  marked_by_user_id: number;
  method: AttendanceMethod;
  created_at: string;
}

// ────────────────────────────────────────────────────────────
// Alerts
// ────────────────────────────────────────────────────────────

export type AlertSeverity = "info" | "warning" | "critical";

export interface Alert {
  id: number;
  project_id: number;
  alert_type: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  related_entity_type?: string;
  related_entity_id?: number;
  is_read: boolean;
  created_for_user_id?: number;
  created_at: string;
}
