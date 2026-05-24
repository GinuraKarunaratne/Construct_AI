import { apiClient } from "./api";

export interface AlertOut {
  id: number;
  project_id: number;
  alert_type: string;
  severity: "info" | "warning" | "critical";
  title: string;
  message: string;
  related_entity_type?: string | null;
  related_entity_id?: number | null;
  is_read: boolean;
  created_at?: string | null;
}

export const alertsApi = {
  list: (projectId: number, unreadOnly = false) =>
    apiClient
      .get<AlertOut[]>(
        `/projects/${projectId}/alerts${unreadOnly ? "?unread_only=true" : ""}`
      )
      .then((r) => r.data),
  markRead: (alertId: number) =>
    apiClient.patch<AlertOut>(`/alerts/${alertId}/read`).then((r) => r.data),
  markAllRead: (projectId: number) =>
    apiClient
      .post<{ marked: number }>(`/projects/${projectId}/alerts/mark-all-read`)
      .then((r) => r.data),
};
