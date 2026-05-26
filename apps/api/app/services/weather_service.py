"""
ConstructAI — Weather Impact Service (Real OpenWeatherMap API)
==============================================================

Uses the OpenWeatherMap Free Tier 5-Day / 3-Hour Forecast endpoint:
  https://openweathermap.org/forecast5

API documentation:
  https://openweathermap.org/api/hourly-forecast  (5-day, free tier)

Endpoint:
  GET https://api.openweathermap.org/data/2.5/forecast
      ?lat={lat}&lon={lon}&appid={key}&units=metric&cnt=40

Response structure (per forecast entry):
  dt          — UNIX timestamp
  weather[0]  — main/description (e.g. "Rain", "Drizzle", "Thunderstorm")
  pop         — Probability of Precipitation (0.0–1.0)
  wind.speed  — m/s
  rain.3h     — mm in last 3 h (optional key, present only when raining)

Risk thresholds (construction industry practice):
  RAIN_RISK_THRESHOLD  = 0.60  (60% PoP — moderate-high risk day)
  WIND_RISK_THRESHOLD  = 10.0  m/s (~Beaufort 5 — "Fresh breeze", unsafe for scaffolding)
  HEAVY_RAIN_MM        = 5.0   mm/3h — significant ponding risk on site

Sign up for a FREE API key at:
  https://home.openweathermap.org/users/sign_up
Then add it to apps/api/.env:
  WEATHER_API_KEY=your_key_here

If the key is missing or the API call fails, the service returns an empty list
(graceful degradation — predictions still run via ML without weather adjustment).
"""

import logging
import os
from datetime import datetime, timezone, timedelta
from typing import Optional

import requests  # type: ignore

logger = logging.getLogger(__name__)

_OWM_FORECAST_URL = "https://api.openweathermap.org/data/2.5/forecast"

# In-memory cache: (lat_round, lon_round) → (fetched_at, forecast_days)
# Avoids hammering OWM API on every page refresh (free tier: 60 calls/min)
_CACHE: dict[tuple, tuple] = {}
_CACHE_TTL_SECONDS = 3600   # 1 hour — OWM updates every 3h anyway

# Risk thresholds
RAIN_RISK_THRESHOLD = 0.60   # Probability of Precipitation (0.0-1.0)
WIND_RISK_THRESHOLD = 10.0   # m/s
HEAVY_RAIN_MM       = 5.0    # mm per 3-hour slot


def _parse_forecast(raw: dict) -> list[dict]:
    """
    Parse the raw OWM /forecast response into a flat list of day-level risk summaries.
    Aggregates 3-hourly slots → daily max PoP, max wind, total rain.
    """
    from collections import defaultdict

    days: dict[str, dict] = defaultdict(lambda: {
        "date": "",
        "max_pop": 0.0,
        "max_wind_ms": 0.0,
        "total_rain_mm": 0.0,
        "conditions": [],
        "temp_min": None,
        "temp_max": None,
    })

    for entry in raw.get("list", []):
        dt_utc = datetime.fromtimestamp(entry["dt"], tz=timezone.utc)
        day_key = dt_utc.strftime("%Y-%m-%d")
        d = days[day_key]
        d["date"] = day_key

        pop = float(entry.get("pop", 0))
        wind_ms = float(entry.get("wind", {}).get("speed", 0))
        rain_mm = float(entry.get("rain", {}).get("3h", 0))
        condition = entry.get("weather", [{}])[0].get("main", "")
        temp_min = entry.get("main", {}).get("temp_min")
        temp_max = entry.get("main", {}).get("temp_max")

        d["max_pop"] = max(d["max_pop"], pop)
        d["max_wind_ms"] = max(d["max_wind_ms"], wind_ms)
        d["total_rain_mm"] += rain_mm
        if condition and condition not in d["conditions"]:
            d["conditions"].append(condition)
        # Track daily low/high temperatures (°C)
        if temp_min is not None:
            d["temp_min"] = temp_min if d["temp_min"] is None else min(d["temp_min"], temp_min)
        if temp_max is not None:
            d["temp_max"] = temp_max if d["temp_max"] is None else max(d["temp_max"], temp_max)

    return list(days.values())


def get_weather_forecast(lat: float, lon: float, api_key: str) -> list[dict]:  # noqa: C901
    """
    Fetch 5-day forecast from OpenWeatherMap and return parsed daily summaries.

    Returns list of dicts:
      { date, max_pop, max_wind_ms, total_rain_mm, conditions }

    Raises RuntimeError on API failure (caller should catch).
    """
    if not api_key:
        raise RuntimeError("WEATHER_API_KEY not configured")

    # Check in-memory cache first
    import time
    cache_key = (round(lat, 2), round(lon, 2))
    if cache_key in _CACHE:
        fetched_at, cached_data = _CACHE[cache_key]
        if time.time() - fetched_at < _CACHE_TTL_SECONDS:
            logger.debug("Weather cache HIT for %s", cache_key)
            return cached_data

    params = {
        "lat": lat,
        "lon": lon,
        "appid": api_key,
        "units": "metric",
        "cnt": 40,   # 5 days × 8 slots/day
    }
    resp = requests.get(_OWM_FORECAST_URL, params=params, timeout=10)

    if resp.status_code == 401:
        raise RuntimeError("Invalid OpenWeatherMap API key (401 Unauthorized). "
                           "Get a free key at https://openweathermap.org/api")
    if resp.status_code == 429:
        raise RuntimeError("OpenWeatherMap rate limit exceeded — free tier: 60 calls/min")
    if not resp.ok:
        raise RuntimeError(f"OpenWeatherMap API error {resp.status_code}: {resp.text[:200]}")

    result = _parse_forecast(resp.json())
    _CACHE[cache_key] = (time.time(), result)
    logger.info("Weather cache SET for %s (%d days)", cache_key, len(result))
    return result


def assess_weather_impact(
    lat: Optional[float],
    lon: Optional[float],
    api_key: str,
    weather_sensitive_tasks: list[dict],
) -> dict:
    """
    Main entry point called by the prediction pipeline.

    Args:
        lat / lon            — project coordinates (can be None → no weather check)
        api_key              — OpenWeatherMap API key
        weather_sensitive_tasks — list of tasks with is_weather_sensitive=True,
                                  each as dict with keys: id, name, planned_start_date, planned_end_date

    Returns:
      {
        "available": bool,
        "source": "OpenWeatherMap Free Tier (5-day)",
        "location": { lat, lon },
        "forecast_days": [ { date, max_pop, max_wind_ms, total_rain_mm, conditions } ],
        "flagged_tasks": [
            {
              "task_id":    int,
              "task_name":  str,
              "risk_date":  "YYYY-MM-DD",
              "risk_level": "high" | "moderate",
              "reason":     str,
              "pop":        float,  # probability of precipitation
              "wind_ms":    float,
            }
        ],
        "overall_weather_risk": "none" | "low" | "moderate" | "high",
        "api_docs": "https://openweathermap.org/forecast5",
      }
    """
    base_result = {
        "available": False,
        "source": "OpenWeatherMap Free Tier (5-day)",
        "location": {"lat": lat, "lon": lon},
        "forecast_days": [],
        "flagged_tasks": [],
        "overall_weather_risk": "none",
        "api_docs": "https://openweathermap.org/forecast5",
    }

    if lat is None or lon is None:
        base_result["unavailable_reason"] = "Project has no coordinates set"
        return base_result

    if not api_key:
        base_result["unavailable_reason"] = (
            "WEATHER_API_KEY not configured. "
            "Get a free key at https://home.openweathermap.org/users/sign_up"
        )
        return base_result

    try:
        forecast_days = get_weather_forecast(lat, lon, api_key)
    except RuntimeError as exc:
        logger.warning("Weather API failed: %s", exc)
        base_result["unavailable_reason"] = str(exc)
        return base_result
    except Exception as exc:
        logger.error("Unexpected weather error: %s", exc)
        base_result["unavailable_reason"] = "Weather API temporarily unavailable"
        return base_result

    # Build a date→risk_day lookup
    risky_days: dict[str, dict] = {}
    for day in forecast_days:
        is_rain_risky = day["max_pop"] >= RAIN_RISK_THRESHOLD
        is_wind_risky = day["max_wind_ms"] >= WIND_RISK_THRESHOLD
        is_heavy_rain  = day["total_rain_mm"] >= HEAVY_RAIN_MM

        if is_rain_risky or is_wind_risky or is_heavy_rain:
            reasons = []
            if is_rain_risky:
                reasons.append(f"Rain PoP {day['max_pop']*100:.0f}%")
            if is_heavy_rain:
                reasons.append(f"Heavy rain {day['total_rain_mm']:.1f}mm")
            if is_wind_risky:
                reasons.append(f"Wind {day['max_wind_ms']:.1f} m/s")

            risk_level = "high" if (day["max_pop"] >= 0.80 or day["max_wind_ms"] >= 14.0) else "moderate"
            risky_days[day["date"]] = {
                "risk_level": risk_level,
                "reason": ", ".join(reasons),
                "pop": round(day["max_pop"], 2),
                "wind_ms": round(day["max_wind_ms"], 1),
                "conditions": day["conditions"],
            }

    # Match weather-sensitive tasks to risky forecast days
    flagged_tasks = []
    today = datetime.now(timezone.utc).date()
    forecast_end = today + timedelta(days=5)

    for task in weather_sensitive_tasks:
        task_start = task.get("planned_start_date")
        task_end   = task.get("planned_end_date")

        # If no dates, assume task could be active in the next 5 days
        if task_start is None and task_end is None:
            date_range = [today + timedelta(days=i) for i in range(5)]
        else:
            # Generate each day the task spans within our 5-day window
            t0 = task_start if task_start else today
            t1 = task_end   if task_end   else (t0 + timedelta(days=7))
            date_range = []
            cur = max(t0, today)
            while cur <= min(t1, forecast_end):
                date_range.append(cur)
                cur += timedelta(days=1)

        for d in date_range:
            day_str = d.strftime("%Y-%m-%d")
            if day_str in risky_days:
                risk = risky_days[day_str]
                flagged_tasks.append({
                    "task_id":   task.get("id"),
                    "task_name": task.get("name", "Unnamed task"),
                    "risk_date": day_str,
                    "risk_level": risk["risk_level"],
                    "reason":    risk["reason"],
                    "pop":       risk["pop"],
                    "wind_ms":   risk["wind_ms"],
                    "conditions": risk["conditions"],
                })
                break   # one flag per task is enough

    # Overall risk level
    if any(f["risk_level"] == "high" for f in flagged_tasks):
        overall = "high"
    elif flagged_tasks:
        overall = "moderate"
    elif risky_days:
        overall = "low"
    else:
        overall = "none"

    return {
        "available": True,
        "source": "OpenWeatherMap Free Tier (5-day)",
        "location": {"lat": lat, "lon": lon},
        "forecast_days": forecast_days,
        "flagged_tasks": flagged_tasks,
        "overall_weather_risk": overall,
        "api_docs": "https://openweathermap.org/forecast5",
    }
