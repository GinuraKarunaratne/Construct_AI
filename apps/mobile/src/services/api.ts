/**
 * API client built on React Native's native fetch.
 * Does NOT use axios — avoids DOMException / browser-global issues in Hermes.
 * Exposes the same .get() / .post() interface so all screens work unchanged.
 *
 * ── HOW TO CHANGE THE SERVER IP ──────────────────────────────────────────────
 * Run this in PowerShell/CMD on your PC:  ipconfig
 * Find the IPv4 address of your WiFi adapter (e.g. 192.168.x.x)
 * Update API_BASE below to match.
 * Both PC and phone must be on the SAME WiFi network.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

export const API_BASE = "http://192.168.1.4:8000/api/v1";
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

// Network-level error (no response received — server unreachable)
export class NetworkError extends Error {
  constructor(cause?: string) {
    super(cause ?? "Network request failed");
    this.name = "NetworkError";
  }
}

// ── Fetch with timeout ────────────────────────────────────────────────────────
async function fetchWithTimeout(url: string, options: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err: unknown) {
    // Convert fetch/network failures into a typed NetworkError so callers
    // can distinguish "server rejected" from "couldn't reach server at all".
    const msg = (err instanceof Error) ? err.message : String(err);
    if (msg.includes("aborted") || msg.includes("timed out") || msg.includes("Aborted")) {
      throw new NetworkError(`Request timed out after ${TIMEOUT_MS / 1000}s — is the server running at ${API_BASE}?`);
    }
    throw new NetworkError(msg);
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
