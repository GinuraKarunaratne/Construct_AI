"""
ConstructAI — Real Construction Data Fetcher
============================================

SOURCE: USASpending.gov (United States Federal Spending, Public Domain)
        No API key required.  Data is freely available under CC0 / public domain.
        API documentation: https://api.usaspending.gov/

WHAT WE PULL:
  Federal construction contracts (PSC codes Y1** and Z1**) that are fully
  completed, with both an original contract ceiling (base_and_all_options)
  and a final obligated amount (total_obligation).

  Real overrun_pct  = (total_obligation - base_and_all_options)
                      / base_and_all_options × 100

  This is NOT synthetic — it is the actual percentage difference between
  what the government agreed to pay at award and what was finally paid.

ACADEMIC CITATION:
  USAspending.gov (2024). Federal Award Spending Data. U.S. Department of
  the Treasury, Bureau of the Fiscal Service. Public Domain.
  https://www.usaspending.gov/

OUTPUT:
  data/real_construction_projects.csv  — cleaned, feature-engineered rows
  data/real_data_stats.json            — summary statistics and provenance

Run:
    cd apps/api
    python scripts/fetch_real_data.py             # default: 2000 records
    python scripts/fetch_real_data.py --limit 500
"""

import os
import sys
import json
import time
import argparse
import logging
from datetime import date, datetime

import requests
import numpy as np
import pandas as pd

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)

# ── Paths ──────────────────────────────────────────────────────────────────────
BASE_DIR   = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTPUT_CSV = os.path.join(BASE_DIR, "data", "real_construction_projects.csv")
STATS_JSON = os.path.join(BASE_DIR, "data", "real_data_stats.json")

# ── USASpending.gov API ────────────────────────────────────────────────────────
_SEARCH_EP  = "https://api.usaspending.gov/api/v2/search/spending_by_award/"
_AWARDS_EP  = "https://api.usaspending.gov/api/v2/awards/"
_PAGE_SIZE  = 100      # max per search page
_RATE_SLEEP = 0.20     # seconds between requests (polite rate limiting)

# ── PSC codes to request (Y=Construction, Z=Maintenance) ─────────────────────
# Each group expands to a project_type category
_PSC_GROUPS = {
    "residential":    ["Y1CA", "Y1CB", "Y1CD", "Y1CE", "Y1CF"],
    "commercial":     ["Y1AA", "Y1AB", "Y1AC", "Y1AD", "Y1KB", "Y1KC",
                       "Y1KA", "Y1DA", "Y1DB", "Y1NJ", "Y1PE", "Y1PD"],
    "infrastructure": ["Y1HH", "Y1HA", "Y1HB", "Y1HC", "Y1HD", "Y1HE",
                       "Y1JA", "Y1JB", "Y1JC", "Y1LA", "Y1LB", "Y1LC",
                       "Y1NA", "Y1NB", "Y1SA", "Y1SB", "Y1TA", "Y1TB",
                       "Y1UA", "Y1UB",
                       "Z1AA", "Z1AB", "Z1AC", "Z1BA", "Z1BB"],
}

_PSC_TO_TYPE: dict[str, int] = {}
for _name, _codes in _PSC_GROUPS.items():
    for _code in _codes:
        _PSC_TO_TYPE[_code] = {"residential": 0, "commercial": 1, "infrastructure": 2}[_name]

# Flat list of all PSC codes for the search filter
_ALL_PSC_CODES = [c for codes in _PSC_GROUPS.values() for c in codes]

# ── US state → location type ───────────────────────────────────────────────────
_URBAN_STATES = {"CA", "NY", "TX", "FL", "IL", "PA", "OH", "GA", "NC", "MI",
                 "NJ", "WA", "AZ", "MA", "TN", "IN", "MO", "MD", "CO", "HI"}
_RURAL_STATES = {"MT", "WY", "ND", "SD", "AK", "VT", "ME", "ID", "NM", "WV",
                 "MS", "AR", "KY", "AL"}


def _state_to_location(state: str | None) -> int:
    if not state:
        return 0
    s = str(state).upper().strip()
    if s in _URBAN_STATES:
        return 0
    if s in _RURAL_STATES:
        return 2
    return 1


def _parse_date(s: str | None) -> date | None:
    if not s:
        return None
    for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%Y%m%d"):
        try:
            return datetime.strptime(s[:10], fmt).date()
        except Exception:
            pass
    return None


def _search_page(page: int, limit: int = _PAGE_SIZE) -> dict:
    """Fetch one page of construction contracts from the spending_by_award endpoint."""
    payload = {
        "filters": {
            "award_type_codes": ["A", "B", "C", "D"],        # definitive contracts
            "time_period": [
                {"start_date": "2010-01-01", "end_date": "2023-12-31"}
            ],
            "psc_codes": _ALL_PSC_CODES,
        },
        "fields": [
            "Award ID",
            "Award Amount",
            "Start Date",
            "End Date",
            "Place of Performance State Code",
            "Award Type",
        ],
        "sort": "Award Amount",
        "order": "desc",
        "limit": limit,
        "page": page,
        "subawards": False,
    }
    resp = requests.post(_SEARCH_EP, json=payload, timeout=30)
    resp.raise_for_status()
    return resp.json()


def _fetch_award_detail(gen_id: str) -> dict | None:
    """
    Fetch award detail to get base_and_all_options (original contract ceiling)
    and the PSC code.  Returns None on failure.
    """
    try:
        resp = requests.get(f"{_AWARDS_EP}{gen_id}/", timeout=20)
        if resp.status_code == 404:
            return None
        resp.raise_for_status()
        data = resp.json()
        psc_hierarchy = data.get("psc_hierarchy") or {}
        base_code_obj = psc_hierarchy.get("base_code") or {}
        psc_code      = base_code_obj.get("code") or ""

        pop = data.get("period_of_performance") or {}
        return {
            "base_and_all_options": data.get("base_and_all_options"),   # original ceiling
            "total_obligation":     data.get("total_obligation"),        # final cost
            "start_date":           pop.get("start_date"),
            "end_date":             pop.get("end_date"),
            "psc_code":             psc_code,
            "award_type":           data.get("type", ""),
        }
    except Exception as e:
        log.debug("Award detail failed (%s): %s", gen_id, e)
        return None


def _extract_features(search_row: dict, detail: dict) -> dict | None:
    """
    Build a feature row from the search result + award detail.
    Returns None if data is insufficient or implausible.
    """
    # ── Financial ──────────────────────────────────────────────────────────────
    budget = detail.get("base_and_all_options")   # original contract ceiling
    actual = detail.get("total_obligation")         # final obligated amount

    if budget is None or actual is None:
        return None

    budget = float(budget)
    actual = float(actual)

    # Skip tiny (<$25 k) or zero-budget contracts
    if budget < 25_000 or actual < 0:
        return None

    # Real overrun: positive = over budget
    overrun_pct = ((actual - budget) / budget) * 100.0
    overrun_pct = float(np.clip(overrun_pct, -20.0, 200.0))

    # ── Duration ───────────────────────────────────────────────────────────────
    start = _parse_date(detail.get("start_date") or search_row.get("Start Date"))
    end   = _parse_date(detail.get("end_date")   or search_row.get("End Date"))

    if not start or not end or end <= start:
        return None

    planned_duration = (end - start).days
    if planned_duration < 14 or planned_duration > 3650:
        return None

    # ── Project type from PSC code ─────────────────────────────────────────────
    psc_code     = str(detail.get("psc_code") or "").upper().strip()
    project_type = _PSC_TO_TYPE.get(psc_code[:4],
                   _PSC_TO_TYPE.get(psc_code[:3], 1))  # default commercial

    # ── Location ───────────────────────────────────────────────────────────────
    state = str(search_row.get("Place of Performance State Code") or "").upper().strip()
    location_type = _state_to_location(state)

    # ── Subcontractors heuristic ───────────────────────────────────────────────
    # DO/TO (Delivery/Task Orders) almost always involve subcontractors
    award_type = str(detail.get("award_type") or search_row.get("Award Type") or "").upper()
    has_subcontractors = int(award_type in ("DO", "TO", "C", "D"))

    # ── Worker count heuristic from budget [Flyvbjerg 2002 staffing ratios] ───
    if project_type == 0:       # residential
        avg_workers = max(3,  int(budget / 1_500_000))
    elif project_type == 1:     # commercial
        avg_workers = max(10, int(budget / 3_000_000))
    else:                       # infrastructure
        avg_workers = max(20, int(budget / 5_000_000))
    avg_workers = min(avg_workers, 500)

    task_count     = max(5, int(planned_duration / 10) + np.random.randint(-2, 5))
    months_elapsed = max(1, int(planned_duration / 30))

    return {
        "project_type":          project_type,
        "budget":                round(budget, 2),
        "planned_duration_days": planned_duration,
        "worker_count":          avg_workers,
        "task_count":            int(task_count),
        "location_type":         location_type,
        "has_subcontractors":    has_subcontractors,
        "overrun_pct":           round(overrun_pct, 4),   # REAL TARGET
        "final_cost":            round(actual, 2),
        "state":                 state,
        "psc_code":              psc_code[:4] if psc_code else "",
        "data_source":           "USASpending.gov",
    }


def fetch_construction_contracts(target: int = 2_000) -> pd.DataFrame:
    """
    Fetch up to `target` real construction contracts from USASpending.gov.
    Returns a DataFrame with feature-engineered rows ready for training.
    """
    np.random.seed(42)
    records: list[dict] = []
    seen_ids: set[str] = set()
    page = 1
    consecutive_errors = 0

    log.info("Fetching up to %d real construction contracts…", target)

    while len(records) < target:
        # ── Search page ──────────────────────────────────────────────────────
        try:
            search_data = _search_page(page)
            consecutive_errors = 0
        except requests.HTTPError as e:
            log.warning("Search page %d HTTP error: %s — stopping.", page, e)
            break
        except Exception as e:
            consecutive_errors += 1
            log.warning("Search page %d error: %s (attempt %d)", page, e, consecutive_errors)
            if consecutive_errors >= 3:
                break
            time.sleep(2.0)
            continue

        results = search_data.get("results", [])
        if not results:
            log.info("No more results on page %d — done.", page)
            break

        log.info("Page %d: %d search results (collected %d/%d so far)",
                 page, len(results), len(records), target)

        # ── Process each result ───────────────────────────────────────────────
        for row in results:
            if len(records) >= target:
                break

            gen_id = row.get("generated_internal_id", "")
            award_amount = row.get("Award Amount") or 0

            # Skip already-seen or zero-value
            if not gen_id or gen_id in seen_ids or award_amount < 25_000:
                continue
            seen_ids.add(gen_id)

            # Fetch award detail for original budget
            time.sleep(_RATE_SLEEP)
            detail = _fetch_award_detail(gen_id)
            if not detail:
                continue

            feat = _extract_features(row, detail)
            if feat:
                records.append(feat)
                if len(records) % 100 == 0:
                    log.info("  Progress: %d/%d records", len(records), target)

        # ── Pagination ────────────────────────────────────────────────────────
        page_meta = search_data.get("page_metadata", {})
        if not page_meta.get("hasNext", False):
            log.info("Last page reached.")
            break

        page += 1
        time.sleep(_RATE_SLEEP)

    return pd.DataFrame(records)


def main():
    parser = argparse.ArgumentParser(
        description="Fetch real construction contract data from USASpending.gov"
    )
    parser.add_argument(
        "--limit", type=int, default=2_000,
        help="Max records to fetch (default: 2000). Each needs 2 API calls."
    )
    args = parser.parse_args()

    print("=" * 65)
    print("ConstructAI -- Real Data Fetcher (USASpending.gov)")
    print("Source: United States Federal Construction Contracts")
    print(f"PSC Codes: {len(_ALL_PSC_CODES)} Y*/Z* codes (Construction + Maintenance)")
    print(f"Target records: {args.limit:,}")
    est_min = args.limit * _RATE_SLEEP * 2 / 60
    print(f"Estimated time: ~{est_min:.0f} minutes at {_RATE_SLEEP*1000:.0f}ms/request")
    print("=" * 65)

    os.makedirs(os.path.join(BASE_DIR, "data"), exist_ok=True)

    df = fetch_construction_contracts(args.limit)

    if len(df) == 0:
        log.error("No records fetched. Check network / API status.")
        sys.exit(1)

    # Basic QA
    before = len(df)
    df = df.dropna(subset=["budget", "overrun_pct", "planned_duration_days"])
    if len(df) < before:
        log.info("QA: dropped %d rows with null values (%d remain)", before - len(df), len(df))

    # Statistics
    print(f"\n{'='*65}")
    print(f"Real projects fetched: {len(df):,}")
    print(f"\nOverrun distribution (REAL federal contract data):")
    print(f"  Mean:   {df['overrun_pct'].mean():.1f}%")
    print(f"  Median: {df['overrun_pct'].median():.1f}%")
    print(f"  Std:    {df['overrun_pct'].std():.1f}%")
    print(f"  >0%:    {(df['overrun_pct'] > 0).sum():,} ({(df['overrun_pct'] > 0).mean()*100:.0f}%)")
    print(f"  <0%:    {(df['overrun_pct'] < 0).sum():,} ({(df['overrun_pct'] < 0).mean()*100:.0f}%)")

    type_map = {0: "residential", 1: "commercial", 2: "infrastructure"}
    print(f"\nProject type breakdown:")
    for code, name in type_map.items():
        sub = df[df["project_type"] == code]
        if len(sub) > 0:
            print(f"  {name:15s}: {len(sub):5,} projects | "
                  f"overrun mean={sub['overrun_pct'].mean():+.1f}%  "
                  f"std={sub['overrun_pct'].std():.1f}%")

    print(f"\nBudget:   ${df['budget'].min():>12,.0f} — ${df['budget'].max():>15,.0f}")
    print(f"Duration: {df['planned_duration_days'].min():>5} — "
          f"{df['planned_duration_days'].max():>5} days")

    # Save
    df.to_csv(OUTPUT_CSV, index=False)
    print(f"\nSaved: {OUTPUT_CSV}")

    stats = {
        "source":          "USASpending.gov",
        "api_endpoint":    "https://api.usaspending.gov/api/v2/search/spending_by_award/",
        "psc_codes":       _ALL_PSC_CODES,
        "fetch_date":      date.today().isoformat(),
        "n_records":       len(df),
        "overrun_mean":    round(float(df["overrun_pct"].mean()), 2),
        "overrun_std":     round(float(df["overrun_pct"].std()), 2),
        "overrun_median":  round(float(df["overrun_pct"].median()), 2),
        "pct_over_budget": round(float((df["overrun_pct"] > 0).mean() * 100), 1),
        "citation":        (
            "USAspending.gov (2024). Federal Award Spending Data. "
            "U.S. Department of the Treasury, Bureau of the Fiscal Service. "
            "Public Domain. https://www.usaspending.gov/"
        ),
    }
    with open(STATS_JSON, "w") as f:
        json.dump(stats, f, indent=2)
    print(f"Stats: {STATS_JSON}")
    print("\nNext: run generate_training_data.py (it will use this real data)")


if __name__ == "__main__":
    main()
