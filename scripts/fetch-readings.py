#!/usr/bin/env python3
"""Fetch Catholic mass readings from USCCB with inline verse markers."""

import asyncio
import datetime
import json
import re
import sys
from pathlib import Path

try:
    import httpx
    from bs4 import BeautifulSoup, NavigableString, Tag
except ImportError:
    print("ERROR: run: pip install httpx beautifulsoup4")
    sys.exit(1)

OUT_DIR = Path(__file__).parent.parent / "public" / "readings"
OUT_DIR.mkdir(parents=True, exist_ok=True)

today = datetime.date.today()
dates = [today + datetime.timedelta(days=i) for i in range(-7, 22)]

SUPERSCRIPTS = str.maketrans("0123456789", "⁰¹²³⁴⁵⁶⁷⁸⁹")


def to_sup(n: str) -> str:
    return n.translate(SUPERSCRIPTS)


def extract_text_with_verses(element: Tag) -> str:
    """Walk the element tree, converting <sup> to superscript Unicode markers."""
    parts = []
    for node in element.descendants:
        if isinstance(node, NavigableString):
            parent = node.parent
            # Skip if inside a <sup> — we handle those separately
            if parent and parent.name == "sup":
                continue
            parts.append(str(node))
        elif isinstance(node, Tag) and node.name == "sup":
            num = node.get_text(strip=True)
            if num.isdigit():
                # Add a thin space before the superscript so it sits cleanly
                parts.append(f" {to_sup(num)}")
    text = "".join(parts)
    # Collapse whitespace but preserve paragraph breaks
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r" {2,}", " ", text)
    return text.strip()


async def fetch_one(client: httpx.AsyncClient, date: datetime.date) -> None:
    compact = date.strftime("%Y%m%d")
    mmddyy = date.strftime("%m%d%y")
    out_file = OUT_DIR / f"{compact}.json"
    url = f"https://bible.usccb.org/bible/readings/{mmddyy}.cfm"

    try:
        r = await client.get(url, follow_redirects=True, timeout=15)
        if r.status_code != 200:
            print(f"  ✗ {date}: HTTP {r.status_code}")
            return

        soup = BeautifulSoup(r.text, "html.parser")

        # Page title / liturgical name
        longname = ""
        title_el = soup.select_one("h1.name, h1.page-title, .readings-nav h1, h1")
        if title_el:
            longname = title_el.get_text(strip=True)

        sections = []
        # Each reading is wrapped in a div with class "container" at the readings level
        for container in soup.select("div.container"):
            heading_el = container.select_one(".name")
            address_el = container.select_one(".address")
            body_el = container.select_one(".content-body")

            if not body_el:
                continue

            heading = heading_el.get_text(strip=True) if heading_el else ""
            ref = address_el.get_text(strip=True) if address_el else ""
            body = extract_text_with_verses(body_el)

            if body:
                sections.append({"heading": heading, "ref": ref, "body": body})

        if sections:
            payload = {"longname": longname, "date": date.isoformat(), "sections": sections}
            out_file.write_text(json.dumps(payload))
            print(f"  ✓ {date} — {len(sections)} sections — \"{longname[:50]}\"")
        else:
            print(f"  ~ {date}: 0 sections (check HTML structure at {url})")
    except Exception as e:
        print(f"  ✗ {date}: {e}")


async def main() -> None:
    print(f"Fetching {len(dates)} days from USCCB…")
    headers = {"User-Agent": "Mozilla/5.0 (compatible; running-page-readings/1.0)"}
    async with httpx.AsyncClient(headers=headers) as client:
        await asyncio.gather(*(fetch_one(client, d) for d in dates))

    written = len(list(OUT_DIR.glob("*.json")))
    print(f"Done. {written} files written to {OUT_DIR}")


asyncio.run(main())
