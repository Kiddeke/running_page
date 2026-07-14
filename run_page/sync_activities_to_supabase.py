import argparse
import json

import httpx

from config import JSON_FILE

TYPE_MAP = {"Run": "run", "Walk": "walk", "Ride": "ride", "Hike": "hike"}


def parse_moving_time(value: str) -> int:
    # running_page stores this as an "H:MM:SS" string, not seconds.
    parts = [int(p) for p in value.split(":")]
    if len(parts) == 3:
        hours, minutes, seconds = parts
    elif len(parts) == 2:
        hours, (minutes, seconds) = 0, parts
    else:
        raise ValueError(f"unexpected moving_time: {value!r}")
    return hours * 3600 + minutes * 60 + seconds


def to_supabase_row(activity: dict) -> dict:
    row = {
        "id": activity["run_id"],
        "type": TYPE_MAP.get(activity["type"], "run"),
        "name": activity["name"],
        "distance": activity["distance"],
        "moving_time": parse_moving_time(activity["moving_time"]),
        # running_page uses a space between date and time; Postgres accepts
        # either, but normalize to "T" to match what both apps expect.
        "start_date_local": activity["start_date_local"].replace(" ", "T"),
    }
    if activity.get("elevation_gain") is not None:
        row["elevation_gain"] = activity["elevation_gain"]
    if activity.get("average_heartrate") is not None:
        row["average_heartrate"] = activity["average_heartrate"]
    return row


def sync_activities_to_supabase(supabase_url: str, service_role_key: str) -> None:
    with open(JSON_FILE) as f:
        activities = json.load(f)

    rows = [to_supabase_row(a) for a in activities]

    # Upsert on the id (Strava/running_page run_id) primary key, so re-runs
    # are idempotent. Only the service_role key can write here — see
    # supabase/schema.sql for why the RLS policy only allows anon/
    # authenticated to read, never write.
    response = httpx.post(
        f"{supabase_url.rstrip('/')}/rest/v1/activities",
        headers={
            "apikey": service_role_key,
            "Authorization": f"Bearer {service_role_key}",
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates,return=minimal",
        },
        json=rows,
        timeout=30.0,
    )
    response.raise_for_status()
    print(f"Synced {len(rows)} activities to Supabase.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("supabase_url", help="Supabase project URL")
    parser.add_argument("service_role_key", help="Supabase service_role key")
    options = parser.parse_args()
    sync_activities_to_supabase(options.supabase_url, options.service_role_key)
