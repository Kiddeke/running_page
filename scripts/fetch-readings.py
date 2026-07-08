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
            if parent and parent.name == "sup":
                continue
            parts.append(str(node))
        elif isinstance(node, Tag) and node.name == "sup":
            num = node.get_text(strip=True)
            if num.isdigit():
                parts.append(f" {to_sup(num)}")
    text = "".join(parts)
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r" {2,}", " ", text)
    return text.strip()


async def fetch_one(client: httpx.AsyncClient, date: datetime.date) -> None:
    compact = date.strftime("%Y%m%d")
    mmddyy = date.strftime("%m%d%y")
    out_file = OUT_DIR / f"{compact}.json"
    url = f"https://bible.usccb.org/bible/readings/{mmddyy}.cfm"

    for attempt in range(4):
        try:
            if attempt > 0:
                await asyncio.sleep(2**attempt)
            r = await client.get(url, follow_redirects=True, timeout=20)
            if r.status_code == 403:
                if attempt < 3:
                    print(f"  ~ {date}: 403, retrying ({attempt + 1}/3)…")
                    continue
                print(f"  ✗ {date}: HTTP 403 after retries")
                return
            if r.status_code != 200:
                print(f"  ✗ {date}: HTTP {r.status_code}")
                return

            soup = BeautifulSoup(r.text, "html.parser")

            # Liturgical name — USCCB puts it in a <h1 class="name"> inside content,
            # or a <div class="name"> at the top of the readings section.
            longname = ""
            for sel in [
                "div.page-title h1",
                "h1.lectionary",
                ".views-field-title span",
                ".field-name-title h2",
                "h2.name",
                ".reading-container h1",
                ".node-title",
            ]:
                el = soup.select_one(sel)
                if el:
                    longname = el.get_text(strip=True)
                    break
            # Fallback: look for the <h1> that isn't "Daily Readings"
            if not longname or longname == "Daily Readings":
                for h in soup.find_all("h1"):
                    txt = h.get_text(strip=True)
                    if txt and txt != "Daily Readings":
                        longname = txt
                        break
            if not longname:
                longname = "Daily Readings"

            sections = []
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
                payload = {
                    "longname": longname,
                    "date": date.isoformat(),
                    "sections": sections,
                }
                out_file.write_text(json.dumps(payload))
                print(f'  ✓ {date} — {len(sections)} sections — "{longname[:60]}"')
            else:
                # Debug: print first 500 chars of HTML to understand structure
                print(
                    f"  ~ {date}: 0 sections. HTML snippet: {r.text[:300].replace(chr(10), ' ')}"
                )
            return
        except Exception as e:
            if attempt < 3:
                print(f"  ~ {date}: {e}, retrying…")
            else:
                print(f"  ✗ {date}: {e}")


async def main() -> None:
    print(f"Fetching {len(dates)} days from USCCB…")
    headers = {
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
    }
    # Sequential with small delay to avoid rate limiting
    async with httpx.AsyncClient(headers=headers) as client:
        for date in dates:
            await fetch_one(client, date)
            await asyncio.sleep(0.5)

    written = len(list(OUT_DIR.glob("*.json")))
    print(f"Done. {written} files written to {OUT_DIR}")


asyncio.run(main())
