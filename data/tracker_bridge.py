#!/usr/bin/env python
"""Local-only bridge for click-time Siddhi tracker refreshes.

Binds to 127.0.0.1 only. OAuth stays inside the existing Google API helper;
no credential or token is exposed to the roadmap HTML.
"""
import json
import subprocess
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

BASE = Path(__file__).resolve().parent
SYNC = BASE / "sync_tracker.py"
LIVE = BASE / "tracker-live.json"
HOST = "127.0.0.1"
PORT = 8765


class Handler(BaseHTTPRequestHandler):
    def _headers(self, status=200, content_type="application/json"):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()

    def do_OPTIONS(self):
        self._headers()

    def do_GET(self):
        if urlparse(self.path).path != "/tracker-live.json":
            self._headers(404)
            self.wfile.write(b'{"error":"not found"}')
            return
        try:
            result = subprocess.run(
                [sys.executable, str(SYNC)],
                capture_output=True,
                text=True,
                timeout=45,
                check=False,
            )
            if result.returncode != 0:
                raise RuntimeError(result.stderr.strip() or "tracker sync failed")
            payload = LIVE.read_bytes()
            self._headers()
            self.wfile.write(payload)
        except Exception as exc:
            self._headers(502)
            self.wfile.write(json.dumps({"error": str(exc)}).encode())

    def log_message(self, *_args):
        pass


if __name__ == "__main__":
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"Tracker bridge listening on http://{HOST}:{PORT}/tracker-live.json", flush=True)
    server.serve_forever()
