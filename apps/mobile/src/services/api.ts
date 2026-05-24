/**
 * API client built on React Native's native fetch.
 * Does NOT use axios — avoids DOMException / browser-global issues in Hermes.
 * Exposes the same .get() / .post() interface so all screens work unchanged.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

const API_BASE = "http://192.168.1.4:8000/api/v1";
const TIMEOUT_MS = 15_000;

// ── Error shape that matches what app screens already expect ──────────────────
export class ApiError extends Error {
  response: { data: { detail?: string }; status: number };
  constructor(status: number, detail?: string) {
    super(detail ?? `HTTP ${status}`);
    this.name = "ApiError";
    this.response = { data: { detail }, status };
  }
}

// ── Fetch with timeout ────────────────────────────────────────────────────────
async function fetchWithTimeout(url: string, options: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// ── Auth header helper ────────────────────────────────────────────────────────
async function authHeader(): Promise<Record<string, string>> {
  const token = await AsyncStorage.getItem("access_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ── Base request ──────────────────────────────────────────────────────────────
async function request<T>(
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  body?: unknown
): Promise<{ data: T }> {
  const url = `${API_BASE}${path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(await authHeader()),
  };

  const res = await fetchWithTimeout(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  // Try to parse JSON regardless of status so error details are available
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    json = {};
  }

  if (!res.ok) {
    const detail = (json as { detail?: string })?.detail;
    throw new ApiError(res.status, detail);
  }

  return { data: json as T };
}

// ── Public client — matches the axios interface used throughout the app ────────
export const apiClient = {
  get<T>(path: string)                     { return request<T>("GET",    path);        },
  post<T>(path: string, body?: unknown)    { return request<T>("POST",   path, body);  },
  put<T>(path: string, body?: unknown)     { return request<T>("PUT",    path, body);  },
  patch<T>(path: string, body?: unknown)   { return request<T>("PATCH",  path, body);  },
  delete<T>(path: string)                  { return request<T>("DELETE", path);        },
};
