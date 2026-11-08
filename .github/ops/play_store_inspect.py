#!/usr/bin/env python3
"""Inspect only Push Office Google Play listing text and image metadata."""
import json
import os
import re
import sys
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

ROOT = "https://androidpublisher.googleapis.com/androidpublisher/v3/applications/com.hebi96.pushOffice_app/edits"
LANG = "ko-KR"
IMAGE_TYPES = ("icon", "featureGraphic", "phoneScreenshots")


class PlayError(Exception):
    pass


def call(method, suffix, token, body=None):
    if suffix not in {"", "/listings", "/listings/" + LANG} and not any(
        suffix.endswith("/listings/" + LANG + "/" + t) for t in IMAGE_TYPES
    ) and not re.fullmatch(r"/[A-Za-z0-9_-]+", suffix):
        raise PlayError("Unexpected Play API resource.")
    uri = ROOT + suffix
    req = Request(uri, method=method, headers={
        "Authorization": "Bearer " + token, "Accept": "application/json",
        **({"Content-Type": "application/json"} if body is not None else {}),
    }, data=json.dumps(body).encode("utf-8") if body is not None else None)
    try:
        with urlopen(req, timeout=90) as resp:
            raw = resp.read()
        return json.loads(raw) if raw else {}
    except HTTPError as err:
        details = ""
        try:
            error = json.loads(err.read(5000).decode("utf-8", "replace"))
            message = error.get("error", {}).get("message", "")
            if isinstance(message, str):
                details = re.sub(r"[^A-Za-z0-9\s가-힣,.:;()_/-]", " ", message)[:230]
        except (ValueError, AttributeError):
            pass
        raise PlayError(f"{method} {suffix.split('/')[-1] or 'edits'}: HTTP {err.code}; {details}") from None
    except (URLError, OSError, ValueError):
        raise PlayError(f"{method} {suffix.split('/')[-1] or 'edits'}: request not confirmed") from None


def main():
    token = os.environ.get("PLAY_ACCESS_TOKEN", "")
    if not token or not token.isascii() or any(x.isspace() for x in token):
        raise PlayError("Invalid Play credential.")
    report = {"package": "com.hebi96.pushOffice_app", "status": "started",
              "read_only": True, "results": {}, "errors": []}
    edit = None
    try:
        edit_resp = call("POST", "", token, {})
        edit_id = edit_resp.get("id", "")
        if not re.fullmatch(r"[A-Za-z0-9_-]+", edit_id):
            raise PlayError("Unexpected edit id.")
        edit = "/" + edit_id
        for label, suffix in [("listing_ko", "/listings/" + LANG), ("all_listings", "/listings"),
                              *[(kind, "/listings/" + LANG + "/" + kind) for kind in IMAGE_TYPES]]:
            try:
                data = call("GET", edit + suffix, token)
                if label == "listing_ko":
                    report["results"][label] = {
                        "language": data.get("language"), "title": data.get("title"),
                        "shortDescription": data.get("shortDescription"),
                        "fullDescription": data.get("fullDescription"),
                        "video": data.get("video")}
                elif label == "all_listings":
                    report["results"][label] = [
                        {"language": s.get("language"), "title": s.get("title")}
                        for s in data.get("listings", [])]
                else:
                    report["results"][label] = {"count": len(data.get("images", [])),
                                                "ids": [v.get("id") for v in data.get("images", [])]}
            except PlayError as exc:
                report["errors"].append(str(exc))
        report["status"] = "checked" if not report["errors"] else "partial"
    except PlayError as exc:
        report["errors"].append(str(exc))
        report["status"] = "failed"
    finally:
        if edit:
            try:
                call("DELETE", edit, token)
                report["temporary_edit_deleted"] = True
            except PlayError as exc:
                report["temporary_edit_deleted"] = False
                report["errors"].append("cleanup: " + str(exc))
    path = Path(os.environ.get("RUNNER_TEMP", ".")) / "push-office-store-inspection.json"
    path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("Store audit: " + report["status"] + ".")
    print("Public listing title: " + str(report["results"].get("listing_ko", {}).get("title", "unavailable")))
    print("Asset counts: " + ", ".join(f"{k}={v['count']}" for k, v in report["results"].items() if k in IMAGE_TYPES))
    for err in report["errors"]:
        print("Store API diagnostic: " + err)
    if report["status"] != "checked" or report.get("temporary_edit_deleted") is not True:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
