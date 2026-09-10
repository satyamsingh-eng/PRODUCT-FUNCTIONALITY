#!/usr/bin/env python
"""Verify SARVAX roadmap evidence coverage and status semantics.

This validator is intentionally read-only. It checks the local tracker snapshot and
modal data before a roadmap build is reviewed or shared.
"""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "roadmap-modal-data.js"
TRACKER = ROOT / "tracker-live.json"
MODAL = ROOT / "roadmap-modal.js"

EXPECTED_TOTAL = 65
EXPECTED_PLATFORM = 48
GENERIC_PENDING = (
    "Product detail " + "pending verification",
    "The tracker has not supplied a verified " + "business outcome",
    "The tracker has not supplied a verified " + "delivery description",
)


def normalize_status(value: str) -> str:
    value = " ".join(str(value or "").lower().replace("_", " ").split())
    if value in {"delivered", "live", "live in prod", "production"}:
        return "Live"
    if value in {"in progress", "shipping", "shipping now"}:
        return "In Progress"
    if value in {"under discussion", "in discussion"}:
        return "Under Discussion"
    if value in {"committed", "planned"}:
        return "Planned"
    if value in {"in research", "research"}:
        return "Research"
    if value in {"future", "future scope"}:
        return "Future Scope"
    return str(value or "").strip()


def load_features() -> list[dict]:
    raw = DATA.read_text(encoding="utf-8")
    return json.loads(raw.split("=", 1)[1].strip().rstrip(";"))


def load_tracker() -> dict:
    return json.loads(TRACKER.read_text(encoding="utf-8"))


def main() -> int:
    features = load_features()
    tracker = load_tracker()
    modal_text = MODAL.read_text(encoding="utf-8")

    missing = []
    for feature in features:
        copy = feature.get("copy") or {}
        if not str(copy.get("what", "")).strip():
            missing.append({"name": feature["name"], "field": "what"})
        if not copy.get("why"):
            missing.append({"name": feature["name"], "field": "why"})
        if not copy.get("how"):
            missing.append({"name": feature["name"], "field": "how"})

    page_status_drift = []
    normalized_label_matches = []
    conflicts = []
    unmatched = []
    for feature in features:
        truth = feature.get("truth") or {}
        page = normalize_status(feature.get("page_status", ""))
        tracker_status = normalize_status(truth.get("status", ""))
        if truth.get("match") == "unmatched":
            unmatched.append(feature["name"])
        elif page and tracker_status and page == tracker_status and feature.get("page_status") != truth.get("status"):
            normalized_label_matches.append(feature["name"])
        elif page and tracker_status and page != tracker_status:
            page_status_drift.append({"name": feature["name"], "page": feature.get("page_status"), "tracker": truth.get("status")})

        feature_type = str(truth.get("feature_type", "")).strip()
        eta = normalize_status(truth.get("eta", ""))
        if truth.get("status") == "Live" and feature_type and feature_type != "Existing Feature":
            conflicts.append({"name": feature["name"], "reason": f"Live + {feature_type}"})
        elif truth.get("status") == "Planned" and (feature_type == "Existing Feature" or eta == "Live"):
            conflicts.append({"name": feature["name"], "reason": f"Planned + {feature_type or eta}"})

    has_blocking_error = bool(missing or any(x in modal_text for x in GENERIC_PENDING))
    has_flags = bool(normalized_label_matches or page_status_drift or conflicts or unmatched)
    result = {
        "status": "FAIL" if has_blocking_error else ("PASS_WITH_FLAGS" if has_flags else "PASS"),
        "feature_count": len(features),
        "tracker_row_count": len(tracker.get("records", [])),
        "platform_feature_count": sum(1 for feature in features if feature.get("track") == "Platform"),
        "missing_detail_fields": missing,
        "normalized_label_matches": normalized_label_matches,
        "page_status_drift": page_status_drift,
        "source_conflicts": conflicts,
        "unmatched_records": unmatched,
        "generic_pending_copy_present": any(x in modal_text for x in GENERIC_PENDING),
        "counts_expected": {
            "total": len(features) == EXPECTED_TOTAL,
            "platform": sum(1 for feature in features if feature.get("track") == "Platform") == EXPECTED_PLATFORM,
        },
    }
    print(json.dumps(result, indent=2, ensure_ascii=False))
    return 0 if result["status"] != "FAIL" and all(result["counts_expected"].values()) else 1


if __name__ == "__main__":
    raise SystemExit(main())
