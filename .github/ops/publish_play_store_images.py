#!/usr/bin/env python3
"""Safely replace verified ko-KR Play images while preserving listing text and tracks."""
from __future__ import annotations
import io
import json
import os
import re
import struct
import sys
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

ROOT = "https://androidpublisher.googleapis.com"
PACKAGE = "com.hebi96.pushOffice_app"
API = f"/androidpublisher/v3/applications/{PACKAGE}/edits"
LANGUAGE = "ko-KR"
CURRENT_TITLE = "Push Office - 일정과 브리핑"
ASSETS = Path("store-assets/ko-KR")
PLAN = ASSETS / "listing-candidate-20261108.json"
TYPES = ("icon", "featureGraphic", "phoneScreenshots")


class ListingError(Exception):
    pass


class Play:
    def __init__(self, token: str):
        if not token or not token.isascii() or any(c.isspace() for c in token):
            raise ListingError("Invalid Google Play authentication.")
        self.token = token

    def request(self, method: str, path: str, body=None, mime=None) -> dict:
        if not (path == API or path.startswith(API + "/") or path.startswith("/upload" + API + "/")):
            raise ListingError("A Play request was outside the approved app.")
        data = None
        headers = {"Authorization": "Bearer " + self.token, "Accept": "application/json"}
        if isinstance(body, bytes):
            data = body
            headers["Content-Type"] = mime or "image/png"
        elif body is not None:
            data = json.dumps(body, separators=(",", ":")).encode("utf-8")
            headers["Content-Type"] = "application/json"
        req = Request(ROOT + path, method=method, data=data, headers=headers)
        try:
            with urlopen(req, timeout=180) as result:
                raw = result.read()
            value = json.loads(raw) if raw else {}
            if not isinstance(value, dict):
                raise ValueError()
            return value
        except HTTPError as err:
            summary = ""
            try:
                obj = json.loads(err.read(8192).decode("utf-8", "replace"))
                message = obj.get("error", {}).get("message", "")
                if isinstance(message, str):
                    summary = re.sub(r"[^A-Za-z0-9\s가-힣,.:;()_/-]", " ", message)[:220]
            except (ValueError, TypeError, AttributeError):
                pass
            raise ListingError(f"Google Play {method} request failed (HTTP {err.code}). {summary}") from None
        except (URLError, OSError, TimeoutError, ValueError):
            raise ListingError(f"Google Play {method} response could not be confirmed.") from None

    def new_edit(self):
        value = self.request("POST", API, {})
        eid = value.get("id")
        if not isinstance(eid, str) or not re.fullmatch(r"[A-Za-z0-9_-]+", eid):
            raise ListingError("Invalid Play edit identifier.")
        return API + "/" + eid


def dimensions(png: bytes) -> tuple[int, int, int]:
    if len(png) < 33 or png[:8] != b"\x89PNG\r\n\x1a\n" or png[12:16] != b"IHDR":
        raise ListingError("The source graphic is not a PNG image.")
    width, height = struct.unpack(">II", png[16:24])
    return width, height, png[25]


def validated_assets():
    from PIL import Image
    plan = json.loads(PLAN.read_text(encoding="utf-8"))
    if plan.get("language") != LANGUAGE or plan.get("title") != CURRENT_TITLE:
        raise ListingError("Store plan does not match the existing Korean listing.")
    sources = plan.get("phoneScreenshots")
    if not isinstance(sources, list) or len(sources) != 6 or len(set(sources)) != 6:
        raise ListingError("Exactly six ordered store screenshots are required.")
    screenshots = []
    for relative in sources:
        path = Path(relative)
        if not path.is_file() or not str(path).startswith("store-assets/ko-KR/screenshots-candidate-20261108/"):
            raise ListingError("A screenshot source is missing or outside approved assets.")
        blob = path.read_bytes()
        if dimensions(blob) != (1080, 1920, 2):
            raise ListingError("Screenshots must be 1080x1920 RGB PNGs.")
        if len(blob) > 15_000_000:
            raise ListingError("A screenshot exceeds the file size limit.")
        screenshots.append(blob)
    brand = ASSETS / "app-icon.png"
    img = Image.open(brand).convert("RGBA")
    if img.size != (512, 512):
        raise ListingError("The store icon must be 512x512.")
    buff = io.BytesIO()
    img.save(buff, format="PNG", optimize=True)
    icon = buff.getvalue()
    if len(icon) > 1024 * 1024 or dimensions(icon) != (512, 512, 6):
        raise ListingError("The icon must be a 512x512 RGBA PNG below 1MB.")
    graphic = (ASSETS / "feature-graphic.png").read_bytes()
    if dimensions(graphic)[:2] != (1024, 500):
        raise ListingError("The feature graphic must be 1024x500.")
    return {"icon": [icon], "featureGraphic": [graphic], "phoneScreenshots": screenshots}


def image_list(play: Play, edit: str, kind: str) -> list[dict]:
    response = play.request("GET", f"{edit}/listings/{LANGUAGE}/{kind}")
    images = response.get("images", [])
    if not isinstance(images, list):
        raise ListingError(f"Invalid image list: {kind}.")
    return images


def run():
    report = {"package": PACKAGE, "locale": LANGUAGE, "status": "started",
              "changed_fields": list(TYPES), "text_preserved": False,
              "track_preserved": True, "image_counts_before": {},
              "image_counts_after": {}, "api_accepted": False, "verified": False}
    report["stage"] = "asset_preflight"
    out = Path(os.environ.get("RUNNER_TEMP", ".")) / "push-office-play-store-publication.json"
    edit = None
    verified_edit = None
    play = None
    try:
        files = validated_assets()
        play = Play(os.environ.get("PLAY_ACCESS_TOKEN", ""))
        report["stage"] = "create_edit"
        edit = play.new_edit()
        report["stage"] = "check_existing_listing"
        before = play.request("GET", f"{edit}/listings/{LANGUAGE}")
        if before.get("title") != CURRENT_TITLE:
            raise ListingError("Listing title changed since approval; refusing to overwrite images.")
        if not before.get("shortDescription") or not before.get("fullDescription"):
            raise ListingError("Store listing text is incomplete; aborting image update.")
        report["text_preserved"] = True
        for kind in TYPES:
            old = image_list(play, edit, kind)
            report["image_counts_before"][kind] = len(old)
            if not (len(old) == 1 if kind != "phoneScreenshots" else len(old) == 6):
                raise ListingError(f"Existing {kind} count changed since audit; refusing destructive replacement.")
        uploaded_ids = {}
        for kind in TYPES:
            report["stage"] = f"upload_{kind}"
            play.request("DELETE", f"{edit}/listings/{LANGUAGE}/{kind}")
            uploaded_ids[kind] = []
            for blob in files[kind]:
                response = play.request(
                    "POST",
                    f"/upload{edit}/listings/{LANGUAGE}/{kind}?uploadType=media",
                    body=blob, mime="image/png",
                )
                image = response.get("image", response)
                if not isinstance(image, dict) or not image.get("id"):
                    raise ListingError(f"Google Play did not confirm upload of {kind}.")
                uploaded_ids[kind].append(str(image["id"]))
            current = image_list(play, edit, kind)
            if len(current) != len(files[kind]):
                raise ListingError(f"Expected {len(files[kind])} images for {kind}, got {len(current)}.")
            if [str(item.get("id")) for item in current] != uploaded_ids[kind]:
                raise ListingError(f"Uploaded image order or identifiers differ for {kind}.")
            report["image_counts_after"][kind] = len(current)
        after = play.request("GET", f"{edit}/listings/{LANGUAGE}")
        for key in ("title", "shortDescription", "fullDescription", "video"):
            if after.get(key) != before.get(key):
                raise ListingError("A previously saved listing text field changed; refusing to commit.")
        # Google Play edits.commit validates before applying changes. The separate
        # edits.validate call is optional and returned 403 after image uploads,
        # even though this account can manage the listing images. Retain the
        # review-safe commit guard and independently verify the saved images.
        report["stage"] = "commit"
        try:
            play.request("POST", edit + ":commit?changesInReviewBehavior=ERROR_IF_IN_REVIEW")
            edit = None
        except ListingError as exc:
            # A failed or ambiguous commit must never be retried automatically.
            report["status"] = "commit_unconfirmed"
            report["message"] = str(exc)
            raise
        report["api_accepted"] = True
        report["status"] = "committed_unverified"
        report["stage"] = "verify_saved_listing"
        verified_edit = play.new_edit()
        actual = play.request("GET", f"{verified_edit}/listings/{LANGUAGE}")
        for key in ("title", "shortDescription", "fullDescription", "video"):
            if actual.get(key) != before.get(key):
                raise ListingError("Store listing text changed during confirmation.")
        for kind in TYPES:
            found = image_list(play, verified_edit, kind)
            if len(found) != len(files[kind]) or [str(item.get("id")) for item in found] != uploaded_ids[kind]:
                raise ListingError(f"Fresh Play listing verification failed for {kind}.")
        report.update(status="committed", verified=True, stage="complete")
    except ListingError as exc:
        if report["status"] == "started":
            report["status"] = "failed"
        report["message"] = str(exc)
        print("::error::" + str(exc), file=sys.stderr)
    finally:
        if play:
            for field, item in (("temporary_edit_deleted", edit),
                                ("verification_edit_deleted", verified_edit)):
                if item:
                    try:
                        play.request("DELETE", item)
                        report[field] = True
                    except ListingError:
                        report[field] = False
        out.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Play Store image update status: {report['status']}; accepted={report['api_accepted']}; verified={report['verified']}")
    if report["status"] != "committed":
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(run())
