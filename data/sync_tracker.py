#!/usr/bin/env python
"""Refresh the local Siddhi Platform RoadMap snapshot used by roadmap modals."""
import json, subprocess, sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent
GAPI = Path.home() / ".hermes/profiles/professional/skills/productivity/google-workspace/scripts/google_api.py"
SHEET_ID = "1ApSkZwwTdeUfaYvmsOWM5nVd6fBnXkz4EYm92orlGq4"
RANGE = "Platform RoadMap!A1:Z200"
cmd = [sys.executable, str(GAPI), "sheets", "get", SHEET_ID, RANGE]
proc = subprocess.run(cmd, capture_output=True, text=True)
if proc.returncode != 0:
    raise SystemExit(proc.stderr.strip() or proc.stdout.strip() or "Google Sheets read failed")
rows = json.loads(proc.stdout)
if not rows or len(rows) < 2:
    raise SystemExit("Platform RoadMap returned no data rows")
headers = [str(x).strip() for x in rows[0]]
records = []
for row in rows[1:]:
    values = list(row) + [""] * (len(headers) - len(row))
    record = {headers[i]: values[i] for i in range(len(headers))}
    records.append(record)
payload = {
    "spreadsheet_id": SHEET_ID,
    "sheet_range": RANGE,
    "synced_at": datetime.now(timezone.utc).isoformat(),
    "row_count": len(records),
    "records": records,
}
out = ROOT / "tracker-live.json"
out.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n")
print(json.dumps({"status":"synced", "path":str(out), "row_count":len(records), "synced_at":payload["synced_at"]}))
