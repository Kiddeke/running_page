"""
Sync activities straight from Garmin Connect into Palma's Supabase.

This is deliberately separate from the running_page site pipeline (which
stays on RUN_TYPE strava with its own data.db): Palma cannot use
Strava-API data with its AI coach (Strava's API agreement forbids it),
but the same runs pulled from Garmin Connect — where the watch recorded
them — carry no such restriction. Rows written here get source='garmin'
so the app knows the difference.

Incremental: each run asks Supabase for the newest garmin-sourced row and
only walks the Garmin activity list back to (a day before) it, so the
first run backfills everything and the twice-daily cron after that only
touches new activities. Upserts are idempotent on the activity id.

Usage:
    python run_page/garmin_to_palma.py SECRET_STRING SUPABASE_URL SERVICE_ROLE_KEY \
        --user-id UUID --owner-name "Grant Deker"

Make the secret string with:
    python run_page/get_garmin_secret.py EMAIL PASSWORD
"""

import argparse
import datetime as dt
import os

os.environ.setdefault("GARTH_TELEMETRY_ENABLED", "false")

import garth
import httpx
import polyline as polyline_codec

MODERN_URL = "https://connectapi.garmin.com"
PAGE_SIZE = 50
# Palma thins recorded tracks to ~300 points; match it.
MAX_TRACK_POINTS = 300

# Garmin activityType.typeKey → Palma activity type. Garmin's keys are
# specific ("treadmill_running"); match on the broad family. Anything
# unrecognized lands as a generic workout, which Palma renders fine.
TYPE_FAMILIES = [
    ("running", "run"),
    ("walking", "walk"),
    ("hiking", "hike"),
    ("cycling", "ride"),
    ("biking", "ride"),
    ("swimming", "swim"),
    ("rowing", "rowing"),
    ("paddling", "standup_paddling"),
    ("kayaking", "kayaking"),
    ("golf", "golf"),
    ("tennis", "tennis"),
    ("yoga", "yoga"),
    ("strength", "weight_training"),
    ("elliptical", "elliptical"),
]


def palma_type(type_key: str) -> str:
    key = (type_key or "").lower()
    for family, palma in TYPE_FAMILIES:
        if family in key:
            return palma
    return "workout"


def garmin_headers() -> dict:
    if garth.client.oauth2_token.expired:
        garth.client.refresh_oauth2()
    return {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        "nk": "NT",
        "Authorization": str(garth.client.oauth2_token),
    }


def latest_synced_start(client: httpx.Client, supabase_url: str, key: str) -> str | None:
    response = client.get(
        f"{supabase_url.rstrip('/')}/rest/v1/activities",
        headers={"apikey": key, "Authorization": f"Bearer {key}"},
        params={
            "source": "eq.garmin",
            "select": "start_date_local",
            "order": "start_date_local.desc",
            "limit": 1,
        },
    )
    response.raise_for_status()
    rows = response.json()
    return rows[0]["start_date_local"] if rows else None


def fetch_track(client: httpx.Client, activity_id: int) -> list | None:
    """The GPS track as Palma stores it: [secondsFromStart, lat, lng] triples."""
    response = client.get(
        f"{MODERN_URL}/activity-service/activity/{activity_id}/details",
        headers=garmin_headers(),
        params={"maxChartSize": 1, "maxPolylineSize": 2000},
    )
    response.raise_for_status()
    points = (response.json().get("geoPolylineDTO") or {}).get("polyline") or []
    parsed = []
    for p in points:
        lat = p.get("lat", p.get("latitude"))
        lon = p.get("lon", p.get("longitude"))
        t = p.get("time")
        if lat is None or lon is None or t is None:
            continue
        parsed.append((t, lat, lon))
    if len(parsed) < 2:
        return None
    start_ms = parsed[0][0]
    track = [[round((t - start_ms) / 1000), lat, lon] for t, lat, lon in parsed]
    if len(track) > MAX_TRACK_POINTS:
        step = (len(track) - 1) / (MAX_TRACK_POINTS - 1)
        track = [track[round(i * step)] for i in range(MAX_TRACK_POINTS)]
    return track


def to_row(activity: dict, track: list | None, user_id: str, owner_name: str) -> dict:
    # Identical key sets on every row: PostgREST rejects heterogeneous bulk
    # upserts (PGRST102), so optional fields are null, never omitted.
    start_local = activity["startTimeLocal"].split(".")[0].replace(" ", "T")
    moving = activity.get("movingDuration") or activity.get("duration") or 0
    encoded = (
        polyline_codec.encode([(lat, lon) for _, lat, lon in track]) if track else None
    )
    return {
        "id": activity["activityId"],
        "type": palma_type((activity.get("activityType") or {}).get("typeKey", "")),
        "name": activity.get("activityName") or "Workout",
        "distance": activity.get("distance") or 0,
        "moving_time": round(moving),
        "start_date_local": start_local,
        "elevation_gain": activity.get("elevationGain"),
        "average_heartrate": activity.get("averageHR"),
        "summary_polyline": encoded,
        "route_track": track,
        "source": "garmin",
        "user_id": user_id,
        "owner_name": owner_name,
    }


def sync(secret_string: str, supabase_url: str, key: str, user_id: str, owner_name: str) -> None:
    garth.client.loads(secret_string)
    with httpx.Client(timeout=60.0) as client:
        newest = latest_synced_start(client, supabase_url, key)
        # Re-walk a day past the newest synced row so an activity that
        # uploaded late (watch was offline) still gets picked up; the
        # upsert makes the overlap free. Date-only string compare — the
        # list is ordered newest-first, so the first older day ends it.
        cutoff = (
            (dt.date.fromisoformat(newest[:10]) - dt.timedelta(days=1)).isoformat()
            if newest
            else None
        )
        print(f"Syncing Garmin activities newer than: {cutoff or 'everything'}")

        fresh = []
        start = 0
        walked_past_cutoff = False
        while not walked_past_cutoff:
            response = client.get(
                f"{MODERN_URL}/activitylist-service/activities/search/activities",
                headers=garmin_headers(),
                params={"start": start, "limit": PAGE_SIZE},
            )
            response.raise_for_status()
            page = response.json()
            if not page:
                break
            for activity in page:
                if cutoff and activity["startTimeLocal"][:10] < cutoff:
                    walked_past_cutoff = True
                    break
                fresh.append(activity)
            start += PAGE_SIZE

        if not fresh:
            print("Nothing new.")
            return

        rows = []
        for activity in fresh:
            track = fetch_track(client, activity["activityId"])
            rows.append(to_row(activity, track, user_id, owner_name))

        response = client.post(
            f"{supabase_url.rstrip('/')}/rest/v1/activities",
            headers={
                "apikey": key,
                "Authorization": f"Bearer {key}",
                "Content-Type": "application/json",
                "Prefer": "resolution=merge-duplicates,return=minimal",
            },
            json=rows,
        )
        if response.is_error:
            print(f"Supabase rejected the sync ({response.status_code}): {response.text}")
        response.raise_for_status()
        with_gps = sum(1 for r in rows if r["summary_polyline"])
        print(f"Synced {len(rows)} Garmin activities to Palma ({with_gps} with GPS).")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("secret_string", help="Garmin secret (get_garmin_secret.py)")
    parser.add_argument("supabase_url", help="Supabase project URL")
    parser.add_argument("service_role_key", help="Supabase service_role key")
    parser.add_argument("--user-id", required=True, help="Palma (Supabase Auth) user UUID")
    parser.add_argument("--owner-name", required=True, help="Display name for the rows")
    options = parser.parse_args()
    sync(
        options.secret_string,
        options.supabase_url,
        options.service_role_key,
        options.user_id,
        options.owner_name,
    )
