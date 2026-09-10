# PRODUCT-FUNCTIONALITY · C3A Labs

SARVAX executive product surface for wealth-management teams.

## Included

- `source/sarvax-capabilities-brief.html` — executive pitch deck, agent catalogue, connected capability map, four focused system architecture diagrams, five agent process diagrams, 39 capability records, search, filters, modal detail views, and previous/next navigation.
- `source/sarvax-roadmap.html` — 65-item platform and business delivery roadmap.
- `data/roadmap-modal-data.js`, `data/roadmap-modal.css`, `data/roadmap-modal.js` — roadmap runtime assets.

## Executive pitch deck

The deck explains how SARVAX helps wealth-management firms prepare, act, and follow through with more consistency and control.

The agent catalogue contains the four source-backed records from the attached catalogue:

1. Pre-Meeting Analysis Agent
2. Post-Meeting Analysis Agent
3. Pipeline & Escalation Tracker
4. KYC Intelligence Officer

The page keeps agent catalogue description separate from production-readiness claims.

## Local preview

```bash
cd "/path/to/PRODUCT-SALES"
python -m http.server 8123 --bind 127.0.0.1
```

Open:

```text
http://127.0.0.1:8123/source/sarvax-capabilities-brief.html
```

## Product boundaries

- `39` = curated platform capability catalogue.
- `65` = complete platform and business delivery roadmap.
- `29` = capabilities catalogued as Live in the product tracker.
- `10` = capabilities catalogued as In Development / Roadmap.

These counts are intentionally not treated as identical inventories.
