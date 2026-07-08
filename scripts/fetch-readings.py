#!/usr/bin/env python3
"""Fetch Catholic mass readings from USCCB and write static JSON files."""

import asyncio
import datetime
import json
import os
import sys
from pathlib import Path

try:
    from catholic_mass_readings import USCCB
except ImportError:
    print("ERROR: catholic-mass-readings not installed. Run: pip install catholic-mass-readings")
    sys.exit(1)

OUT_DIR = Path(__file__).parent.parent / "public" / "readings"
OUT_DIR.mkdir(parents=True, exist_ok=True)

today = datetime.date.today()
dates = [today + datetime.timedelta(days=i) for i in range(-7, 22)]


async def fetch_one(usccb: USCCB, date: datetime.date) -> None:
    compact = date.strftime("%Y%m%d")
    out_file = OUT_DIR / f"{compact}.json"

    try:
        mass = await usccb.get_mass_from_date(date)
        if mass is None:
            print(f"  ~ {date}: no mass returned")
            return

        sections = []
        for sec in mass.sections:
            for reading in sec.readings:
                ref = ", ".join(v.text for v in reading.verses) if reading.verses else ""
                text = reading.text or ""
                if not text.strip():
                    continue
                sections.append({
                    "heading": sec.header or "",
                    "ref": ref,
                    "body": text,
                })

        if sections:
            payload = {
                "longname": mass.title or "",
                "date": date.isoformat(),
                "sections": sections,
            }
            out_file.write_text(json.dumps(payload))
            print(f"  ✓ {date} — {len(sections)} sections — \"{mass.title[:50]}\"")
        else:
            print(f"  ~ {date}: 0 sections")
    except Exception as e:
        print(f"  ✗ {date}: {e}")


async def main() -> None:
    print(f"Fetching {len(dates)} days from USCCB…")
    async with USCCB() as usccb:
        await asyncio.gather(*(fetch_one(usccb, d) for d in dates))

    written = len(list(OUT_DIR.glob("*.json")))
    print(f"Done. {written} files written to {OUT_DIR}")


asyncio.run(main())
