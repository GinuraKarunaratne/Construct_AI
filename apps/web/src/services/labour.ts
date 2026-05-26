import { apiClient } from "./api";

export interface WorkerOut {
  id: number;
  project_id: number;
  full_name: string;
  worker_code: string;
  skill_type: string;
  daily_rate: number;
  overtime_rate: number;
  phone?: string | null;
  is_active: boolean;
}

export interface AttendanceOut {
  id: number;
  project_id: number;
  worker_id: number;
  attendance_date: string;
  check_in_time?: string | null;
  check_out_time?: string | null;
  status: string;
  overtime_hours: number;
  method: string;
}

export interface AttendanceManual {
  worker_id: number;
  attendance_date: string;
  status: "present" | "absent" | "half_day" | "leave";
  check_in_time?: string;
  check_out_time?: string;
  overtime_hours?: number;
  notes?: string;
}

export interface PayrollRunOut {
  id: number;
  project_id: number;
  period_start: string;
  period_end: string;
  status: string;
  lines?: PayrollLineOut[];
}

export interface PayrollLineOut {
  id: number;
  worker_id: number;
  days_worked: number;
  overtime_hours: number;
  gross_pay: number;
  advances: number;
  deductions: number;
  net_pay: number;
}

export interface WorkerCreate {
  full_name: string;
  worker_code: string;
  skill_type?: string;
  daily_rate?: number;
  overtime_rate?: number;
  phone?: string | null;
}

export const labourApi = {
  workers: (projectId: number) =>
    apiClient
      .get<WorkerOut[]>(`/projects/${projectId}/workers`)
      .then((r) => r.data),
  createWorker: (projectId: number, data: WorkerCreate) =>
    apiClient
      .post<WorkerOut>(`/projects/${projectId}/workers`, data)
      .then((r) => r.data),
  attendance: (projectId: number, date?: string) => {
    const params = date ? `?attendance_date=${date}` : "";
    return apiClient
      .get<AttendanceOut[]>(`/projects/${projectId}/attendance${params}`)
      .then((r) => r.data);
  },
  markAttendance: (projectId: number, data: AttendanceManual) =>
    apiClient
      .post<AttendanceOut>(`/projects/${projectId}/attendance/manual`, data)
      .then((r) => r.data),
  payrollRuns: (projectId: number) =>
    apiClient
      .get<PayrollRunOut[]>(`/projects/${projectId}/payroll-runs`)
      .then((r) => r.data),
  generatePayroll: (
    projectId: number,
    period_start: string,
    period_end: string
  ) =>
    apiClient
      .post<PayrollRunOut>(`/projects/${projectId}/payroll/generate`, {
        period_start,
        period_end,
      })
      .then((r) => r.data),
  getPayrollRun: (runId: number) =>
    apiClient.get<PayrollRunOut>(`/payroll-runs/${runId}`).then((r) => r.data),
  approvePayrollRun: (runId: number) =>
    apiClient
      .post<PayrollRunOut>(`/payroll-runs/${runId}/approve`)
      .then((r) => r.data),
};
