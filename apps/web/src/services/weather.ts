import { apiClient } from "./api";

export interface ForecastDay {
  date: string;            // "YYYY-MM-DD"
  max_pop: number;         // Probability of precipitation 0.0–1.0
  max_wind_ms: number;     // m/s
  total_rain_mm: number;   // mm accumulated
  conditions: string[];    // e.g. ["Rain", "Clouds"]
  temp_min?: number | null; // °C daily low
  temp_max?: number | null; // °C daily high
}

export interface FlaggedTask {
  task_id: number;
  task_name: string;
  risk_date: string;
  risk_level: "high" | "moderate";
  reason: string;
  pop: number;
  wind_ms: number;
  conditions: string[];
}

export type WeatherRisk = "none" | "low" | "moderate" | "high";

export interface WeatherImpact {
  available: boolean;
  source: string;
  location: { lat: number | null; lon: number | null };
  forecast_days: ForecastDay[];
  flagged_tasks: FlaggedTask[];
  overall_weather_risk: WeatherRisk;
  api_docs: string;
  unavailable_reason?: string;
}

export const weatherApi = {
  impact: (projectId: number) =>
    apiClient
      .get<WeatherImpact>(`/projects/${projectId}/weather-impact`)
      .then((r) => r.data)
      .catch(() => null),
};
