"""
Sync stroke-order data from make-me-a-chunom into the characterstrokes table.

Source is chosen by the STROKE_DATA_SOURCE env var:
  - A local filesystem path containing index.json and <CODEPOINT>.json files
    (e.g. a local checkout of make-me-a-chunom/public/stroke-data)
  - An http(s):// URL pointing at the same layout

Defaults to the upstream GitHub Pages deployment.

Idempotent — safe to run on any schedule. Only inserts codepoints that are
missing and updates rows whose upstream data has changed.

Usage:
    python -m backend.scripts.ingest_stroke_data
    STROKE_DATA_SOURCE=C:/path/to/stroke-data python -m backend.scripts.ingest_stroke_data
"""

import json
import os
import sys
import urllib.request
import urllib.error
from pathlib import Path
from typing import Optional

from sqlmodel import Session, select

from backend.database import engine, create_db_and_tables
from backend.models import CharacterStrokes

DEFAULT_SOURCE = "https://aerbote88.github.io/make-me-a-chunom/stroke-data"
BATCH_SIZE = 500


class Source:
    def __init__(self, location: str):
        self.location = location.rstrip("/")
        self.is_url = location.startswith("http://") or location.startswith("https://")
        if not self.is_url:
            self.base_path = Path(location)
            if not self.base_path.exists():
                raise FileNotFoundError(f"stroke data dir does not exist: {self.base_path}")

    def fetch_json(self, name: str) -> Optional[dict]:
        if self.is_url:
            url = f"{self.location}/{name}"
            try:
                with urllib.request.urlopen(url, timeout=30) as resp:
                    return json.loads(resp.read().decode("utf-8"))
            except urllib.error.HTTPError as e:
                if e.code == 404:
                    return None
                raise
        else:
            path = self.base_path / name
            if not path.exists():
                return None
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)

    def __str__(self) -> str:
        return self.location


def main() -> int:
    create_db_and_tables()

    location = os.getenv("STROKE_DATA_SOURCE", DEFAULT_SOURCE)
    try:
        source = Source(location)
    except FileNotFoundError as e:
        print(f"ERROR: {e}", file=sys.stderr)
        return 1

    print(f"Source: {source}")
    print("Loading index…")
    try:
        index = source.fetch_json("index.json")
    except Exception as e:
        print(f"ERROR: could not load index: {e}", file=sys.stderr)
        return 1
    if index is None:
        print("ERROR: index.json not found at source", file=sys.stderr)
        return 1

    characters = index.get("characters", [])
    print(f"Upstream index: {len(characters)} characters")

    added = 0
    updated = 0
    skipped = 0
    missing = 0
    errors = 0

    with Session(engine) as session:
        existing = {
            row.codepoint: row
            for row in session.exec(select(CharacterStrokes)).all()
        }
        print(f"Existing rows in DB: {len(existing)}")

        pending = 0
        for i, character in enumerate(characters, start=1):
            if not character:
                continue
            codepoint = ord(character[0])
            hex_name = f"{codepoint:X}.json"

            try:
                data = source.fetch_json(hex_name)
            except Exception as e:
                errors += 1
                print(f"  [U+{codepoint:X}] {e}")
                continue

            if data is None:
                missing += 1
                continue

            strokes_json = json.dumps(data["strokes"], separators=(",", ":"))
            medians_json = json.dumps(data["medians"], separators=(",", ":"))
            stroke_count = len(data["strokes"])

            row = existing.get(codepoint)
            if row is None:
                session.add(CharacterStrokes(
                    codepoint=codepoint,
                    character=character,
                    strokes_json=strokes_json,
                    medians_json=medians_json,
                    stroke_count=stroke_count,
                ))
                added += 1
                pending += 1
            elif (row.strokes_json != strokes_json
                  or row.medians_json != medians_json
                  or row.character != character):
                row.character = character
                row.strokes_json = strokes_json
                row.medians_json = medians_json
                row.stroke_count = stroke_count
                session.add(row)
                updated += 1
                pending += 1
            else:
                skipped += 1

            if pending >= BATCH_SIZE:
                session.commit()
                pending = 0
                print(f"  progress: {i}/{len(characters)} (added={added} updated={updated} skipped={skipped})")

        if pending:
            session.commit()

    print(f"Done. added={added} updated={updated} skipped={skipped} missing={missing} errors={errors}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
