import { apiClient } from "./api";

export interface TaskOut {
  id: number;
  project_id: number;
  name: string;
  description?: string | null;
  planned_start_date?: string | null;
  planned_end_date?: string | null;
  actual_start_date?: string | null;
  actual_end_date?: string | null;
  duration_days: number;
  progress_percentage: number;
  status: string;
  priority: string;
  is_weather_sensitive: boolean;
  parent_task_id?: number | null;
}

export interface GanttTask {
  id: number;
  name: string;
  planned_start_date?: string | null;
  planned_end_date?: string | null;
  actual_start_date?: string | null;
  actual_end_date?: string | null;
  progress_percentage: number;
  status: string;
  priority: string;
  is_weather_sensitive?: boolean;
  parent_task_id?: number | null;
  dependencies: number[];
}

export interface TaskProgressUpdate {
  progress_percentage: number;
  status?: string;
  actual_start_date?: string;
  actual_end_date?: string;
}

export const tasksApi = {
  list: (projectId: number) =>
    apiClient
      .get<TaskOut[]>(`/projects/${projectId}/tasks`)
      .then((r) => r.data),
  gantt: (projectId: number) =>
    apiClient
      .get<{ tasks: GanttTask[] }>(`/projects/${projectId}/schedule/gantt`)
      .then((r) => r.data),
  updateProgress: (taskId: number, data: TaskProgressUpdate) =>
    apiClient
      .post<TaskOut>(`/tasks/${taskId}/progress`, data)
      .then((r) => r.data),
};
