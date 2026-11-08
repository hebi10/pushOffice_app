#!/usr/bin/env python3
"""Read-only inspection of existing Push Office Play listing and graphic assets."""
from __future__ import annotations
import json
import os
import re
import sys
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

ROOT = "https://androidpublisher.googleapis.com"
PACKAGE = "com.hebi96.pushOffice_app"
BASE = f"/androidpublisher/v3/applications/{PACKAGE}/edits"
TYPES = ("icon", "featureGraphic", "phoneScreenshots", "sevenInchScreenshots", "tenInchScreenshots")


class PlayError(Exception):
    pass


class Client:
    def __init__(self, token: str):
        if not token or not token.isascii() or any(c.isspace() for c in token):
            raise PlayError("Missing or invalid Google Play access token.")
        self.token = token

    def request(self, method: str, path: str, data: dict | None = None) -> dict:
        if not path.startswith(BASE) or not re.fullmatch(r"/[a-zA-Z0-9._/:-]+", path):
            raise PlayError("Requested an unexpected Play API resource.")
        payload = json.dumps(data).encode("utf-8") if data is not None else None
        req = Request(ROOT + path, data=payload, method=method,
                      headers={"Authorization": "Bearer " + self.token,
                               "Accept": "application/json",
                               **({"Content-Type": "application/json"} if payload is not None else {})})
        try:
            with urlopen(req, timeout=90) as res:
                raw = res.read()
            return json.loads(raw) if raw else {}
        except HTTPError as err:
            raise PlayError(f"Google Play {method} API returned HTTP {err.code}.") from None
        except (URLError, TimeoutError, ValueError):
            raise PlayError(f"Google Play {method} API did not return valid data.") from None


def main() -> int:
    report: dict = {"package": PACKAGE, "read_only": True, "status": "started", "languages": [], "images": {}}
    client = Client(os.environ.get("PLAY_ACCESS_TOKEN", ""))
    edit = None
    error = None
    try:
        response = client.request("POST", BASE, {})
        edit_id = response.get("id")
        if not isinstance(edit_id, str) or not re.fullmatch("[A-Za-z0-9_-]+", edit_id):
            raise PlayError("Unexpected Play edit id.")
        edit = f"{BASE}/{edit_id}"
        listing_list = client.request("GET", edit + "/listings")
        listings = listing_list.get("listings", [])
        if not isinstance(listings, list):
            raise PlayError("Invalid listings response.")
        report["languages"] = [
            {"language": v.get("language"), "title": v.get("title"),
             "shortDescription": v.get("shortDescription"),
             "fullDescription": v.get("fullDescription"), "video": v.get("video")}
            for v in listings if isinstance(v, dict)
        ]
        for lang in sorted({x.get("language") for x in report["languages"] if x.get("language")} | {"ko-KR"}):
            report["images"][lang] = {}
            for kind in TYPES:
                data = client.request("GET", f"{edit}/listings/{lang}/{kind}")
                images = data.get("images", [])
                if not isinstance(images, list):
                    raise PlayError(f"Invalid image list for {lang}/{kind}.")
                report["images"][lang][kind] = [
                    {"id": entry.get("id"), "url": entry.get("url")}
                    for entry in images if isinstance(entry, dict)
                ]
        report["status"] = "checked"
    except PlayError as exc:
        error = str(exc)
        report["status"] = "failed"
        report["error"] = error
    finally:
        if edit:
            try:
                client.request("DELETE", edit)
                report["temporary_edit_deleted"] = True
            except PlayError:
                report["temporary_edit_deleted"] = False
                report["status"] = "cleanup_failed"
    out = Path(os.environ.get("RUNNER_TEMP", ".")) / "push-office-store-audit.json"
    out.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Store listing audit {report['status']} with {len(report['languages'])} languages.")
    for listing in report["languages"]:
        lang = listing.get("language")
        print(f"  {lang}: {listing.get('title')!r} / short={len(listing.get('shortDescription') or '')} / full={len(listing.get('fullDescription') or '')}")
    for lang, types in report["images"].items():
        print(f"  {lang} image counts: " + ", ".join(f"{kind}={len(items)}" for kind, items in types.items()))
    if error:
        print(f"::error::{error}", file=sys.stderr)
    if report.get("temporary_edit_deleted") is False:
        print("::error::The audit edit could not be deleted; review Play Console before further edits.", file=sys.stderr)
    return 0 if report["status"] == "checked" and report.get("temporary_edit_deleted") else 1


if __name__ == "__main__":
    raise SystemExit(main())
