#!/usr/bin/env python3
"""
Cross-reference a leads export (CSV) against a HighLevel (GHL) sub-account
to report whether each lead has been worked by the sales team.

"Worked" is inferred from the GHL contact's opportunity pipeline stage: a
lead is considered worked once its opportunity has moved past the entry
stage of whichever pipeline it lives in (e.g. "Cold Lead" -> "Warm Leads",
"New Lead" -> "NA1", etc). Contacts found in GHL with no opportunity at all,
or sitting at the entry stage, are flagged as not (yet) worked. Leads with
no matching GHL contact are flagged as not found.

Usage:
    export GHL_PIT_TOKEN=pit-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
    export GHL_LOCATION_ID=xxxxxxxxxxxxxxxxxxxxx
    python3 scripts/ghl_lead_work_status.py \
        --leads-csv leads_export.csv \
        --out report.xlsx

Requires: requests, openpyxl (pip install requests openpyxl)
"""

import argparse
import csv
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests

API_BASE = "https://services.leadconnectorhq.com"
API_VERSION = "2021-07-28"


def api_headers(token: str) -> dict:
    return {
        "Authorization": f"Bearer {token}",
        "Version": API_VERSION,
        "Content-Type": "application/json",
        "Accept": "application/json",
    }


def fetch_pipelines(token: str, location_id: str) -> dict:
    """Returns {stageId: {"pipeline": name, "stage": name, "position": int}}"""
    resp = requests.get(
        f"{API_BASE}/opportunities/pipelines",
        headers=api_headers(token),
        params={"locationId": location_id},
        timeout=30,
    )
    resp.raise_for_status()
    stage_map = {}
    for pipeline in resp.json().get("pipelines", []):
        for stage in pipeline.get("stages", []):
            stage_map[stage["id"]] = {
                "pipeline": pipeline["name"],
                "stage": stage["name"],
                "position": stage["position"],
            }
    return stage_map


def search_contact(token: str, location_id: str, field: str, value: str, attempt: int = 0) -> dict | None:
    try:
        resp = requests.post(
            f"{API_BASE}/contacts/search",
            headers=api_headers(token),
            json={
                "locationId": location_id,
                "pageLimit": 1,
                "filters": [{"field": field, "operator": "eq", "value": value}],
            },
            timeout=60,
        )
    except (requests.exceptions.Timeout, requests.exceptions.ConnectionError):
        if attempt >= 4:
            raise
        time.sleep(2 ** attempt)
        return search_contact(token, location_id, field, value, attempt + 1)

    if resp.status_code == 429 or resp.status_code >= 500:
        if attempt >= 4:
            resp.raise_for_status()
        time.sleep(max(2 ** attempt, 2))
        return search_contact(token, location_id, field, value, attempt + 1)
    resp.raise_for_status()
    contacts = resp.json().get("contacts", [])
    return contacts[0] if contacts else None


def find_contact(token: str, location_id: str, email: str, phone: str) -> dict | None:
    if email and "@" in email:
        contact = search_contact(token, location_id, "email", email)
        if contact:
            return contact
    if phone:
        contact = search_contact(token, location_id, "phone", phone)
        if contact:
            return contact
    return None


def best_opportunity(contact: dict, stage_map: dict) -> dict | None:
    """Pick the most-progressed opportunity (highest pipeline stage position)."""
    opps = contact.get("opportunities") or []
    best = None
    best_pos = -1
    for opp in opps:
        info = stage_map.get(opp.get("pipelineStageId"), {})
        pos = info.get("position", -1)
        if pos > best_pos:
            best_pos = pos
            best = {**opp, **info}
    return best


def load_leads(csv_path: str, delimiter: str) -> list[dict]:
    with open(csv_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f, delimiter=delimiter)
        return [row for row in reader if any(v.strip() for v in row.values())]


def dedupe_leads(rows: list[dict]) -> dict:
    """Group raw CSV rows into unique leads keyed by email (or phone if no valid email)."""
    leads = {}
    for row in rows:
        email = (row.get("email") or "").strip()
        phone = (row.get("phone") or "").strip()
        key = email.lower() if "@" in email else f"phone:{phone}" if phone else None
        if key is None:
            continue
        lead = leads.setdefault(
            key,
            {
                "email": email if "@" in email else "",
                "phone": phone,
                "name": row.get("name", ""),
                "sources": set(),
                "submission_count": 0,
                "first_seen": None,
                "last_seen": None,
            },
        )
        lead["sources"].add(row.get("source", ""))
        lead["submission_count"] += 1
        created = row.get("created_at", "")
        if created:
            if lead["first_seen"] is None or created < lead["first_seen"]:
                lead["first_seen"] = created
            if lead["last_seen"] is None or created > lead["last_seen"]:
                lead["last_seen"] = created
        if not lead["phone"] and phone:
            lead["phone"] = phone
    return leads


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--leads-csv", required=True, help="Path to the leads export CSV")
    parser.add_argument("--delimiter", default=";", help="CSV delimiter (default ';')")
    parser.add_argument("--out", default="lead_work_status.csv", help="Output CSV path")
    parser.add_argument("--location-id", default=os.environ.get("GHL_LOCATION_ID"))
    parser.add_argument("--token", default=os.environ.get("GHL_PIT_TOKEN"))
    parser.add_argument("--concurrency", type=int, default=6)
    args = parser.parse_args()

    if not args.token or not args.location_id:
        sys.exit("GHL_PIT_TOKEN and GHL_LOCATION_ID must be set (env vars or --token/--location-id)")

    print(f"Loading leads from {args.leads_csv} ...", file=sys.stderr)
    rows = load_leads(args.leads_csv, args.delimiter)
    leads = dedupe_leads(rows)
    print(f"{len(rows)} raw rows -> {len(leads)} unique leads", file=sys.stderr)

    print("Fetching pipeline/stage definitions ...", file=sys.stderr)
    stage_map = fetch_pipelines(args.token, args.location_id)

    results = []

    def process(key, lead):
        contact = find_contact(args.token, args.location_id, lead["email"], lead["phone"])
        row = {
            "email": lead["email"],
            "phone": lead["phone"],
            "name": lead["name"],
            "sources": ", ".join(sorted(s for s in lead["sources"] if s)),
            "submission_count": lead["submission_count"],
            "first_seen": lead["first_seen"],
            "last_seen": lead["last_seen"],
        }
        if not contact:
            row.update(
                {
                    "found_in_ghl": False,
                    "worked_status": "NOT_FOUND_IN_GHL",
                    "ghl_contact_id": "",
                    "pipeline": "",
                    "stage": "",
                    "opportunity_status": "",
                    "tags": "",
                    "assigned_to": "",
                    "ghl_created_at": "",
                    "ghl_updated_at": "",
                }
            )
            return row

        opp = best_opportunity(contact, stage_map)
        if opp is None:
            worked_status = "FOUND_NO_OPPORTUNITY"
        elif opp.get("position", 0) > 0:
            worked_status = "WORKED"
        else:
            worked_status = "NOT_WORKED_ENTRY_STAGE"

        row.update(
            {
                "found_in_ghl": True,
                "worked_status": worked_status,
                "ghl_contact_id": contact.get("id", ""),
                "pipeline": opp.get("pipeline", "") if opp else "",
                "stage": opp.get("stage", "") if opp else "",
                "opportunity_status": opp.get("status", "") if opp else "",
                "tags": ", ".join(contact.get("tags") or []),
                "assigned_to": contact.get("assignedTo") or "",
                "ghl_created_at": contact.get("dateAdded", ""),
                "ghl_updated_at": contact.get("dateUpdated", ""),
            }
        )
        return row

    print(f"Matching {len(leads)} leads against GHL (concurrency={args.concurrency}) ...", file=sys.stderr)
    with ThreadPoolExecutor(max_workers=args.concurrency) as pool:
        futures = {pool.submit(process, k, v): k for k, v in leads.items()}
        done = 0
        for future in as_completed(futures):
            results.append(future.result())
            done += 1
            if done % 50 == 0:
                print(f"  {done}/{len(leads)}", file=sys.stderr)

    results.sort(key=lambda r: r["first_seen"] or "")

    fieldnames = [
        "email", "phone", "name", "sources", "submission_count",
        "first_seen", "last_seen", "found_in_ghl", "worked_status",
        "ghl_contact_id", "pipeline", "stage", "opportunity_status",
        "tags", "assigned_to", "ghl_created_at", "ghl_updated_at",
    ]
    with open(args.out, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(results)

    print(f"Wrote {len(results)} rows to {args.out}", file=sys.stderr)


if __name__ == "__main__":
    main()
