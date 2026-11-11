#!/usr/bin/env python3
"""Read-only Play store image verification for the verified 2026-11-11 refresh."""
from __future__ import annotations
import base64
import hashlib
import json
import os
import re
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import publish_play_store_images as pub

ROOT=Path(__file__).resolve().parents[2]
APP="com.hebi96.pushOffice_app"
LANGUAGE="ko-KR"
ASSET_ROOT=ROOT/"store-assets"/"ko-KR"
MANIFEST=ASSET_ROOT/"refresh-manifest-20261111.json"
OUTPUT=Path(os.environ.get("RUNNER_TEMP", "."))/"push-office-store-readback-20261111.json"
SUMMARY=Path(os.environ.get("RUNNER_TEMP", "."))/"push-office-store-readback-20261111.md"
TYPES=("icon","featureGraphic","phoneScreenshots")
SOURCES={
    "icon": [ASSET_ROOT/"app-icon.png"],
    "featureGraphic": [ASSET_ROOT/"feature-graphic-refresh-20261111.png"],
}

def to_hex(remote: str) -> str | None:
    if not isinstance(remote,str) or not remote: return None
    if re.fullmatch(r"[0-9a-fA-F]{64}",remote): return remote.lower()
    try:
        x=base64.b64decode(remote,validate=True)
        return x.hex() if len(x)==32 else None
    except Exception: return None

def expected_images():
    manifest=json.loads(MANIFEST.read_text(encoding="utf-8"))
    names=[x["name"] for x in manifest["screenshots"]]
    assert manifest.get("complete") is True and len(names)==8 and len(set(names))==8
    SOURCES["phoneScreenshots"]=[ASSET_ROOT/"screenshots-refresh-20261111"/x for x in names]
    return {kind:[hashlib.sha256(p.read_bytes()).hexdigest() for p in SOURCES[kind]] for kind in TYPES}

def read_once(play: pub.Play,expected:dict):
    edit=play.new_edit()
    result={"counts":{},"ids_unique":{},"sha256_matches":{},"sha256_available":{},
            "expected":{"icon":1,"featureGraphic":1,"phoneScreenshots":8},
            "listing_title_ok":False,"listing_text_nonempty":False,
            "complete":False}
    try:
        listing=play.request("GET",f"{edit}/listings/{LANGUAGE}")
        result["listing_title_ok"]=listing.get("title")==pub.CURRENT_TITLE
        result["listing_text_nonempty"]=bool(listing.get("shortDescription") and listing.get("fullDescription"))
        for kind in TYPES:
            response=play.request("GET",f"{edit}/listings/{LANGUAGE}/{kind}")
            images=response.get("images",[])
            if not isinstance(images,list): raise pub.ListingError("Malformed image list: "+kind)
            result["counts"][kind]=len(images)
            ids=[str(x.get("id","")) for x in images]
            result["ids_unique"][kind]=len(set(ids))==len(ids) and all(ids)
            digests=[to_hex(x.get("sha256","")) for x in images]
            result["sha256_available"][kind]=len(images)>0 and all(x is not None for x in digests)
            result["sha256_matches"][kind]=(
                bool(result["sha256_available"][kind]) and digests==expected[kind]
            )
        result["complete"]=(result["listing_title_ok"] and result["listing_text_nonempty"]
            and result["counts"]==result["expected"] and all(result["ids_unique"].values()))
        return result
    finally:
        try:play.request("DELETE",edit)
        except pub.ListingError:pass

def main():
    report={"package":APP,"locale":LANGUAGE,"status":"unverified"}
    try:
        expected=expected_images()
        play=pub.Play(os.environ.get("PLAY_ACCESS_TOKEN",""))
        for attempt in range(1,9):
            report.update(read_once(play,expected))
            report["attempt"]=attempt
            if report["complete"]:break
            if attempt<8: time.sleep(20)
        report["status"]="verified" if report["complete"] else "not_verified"
    except Exception as exc:
        report["status"]="not_verified"
        report["error_type"]=type(exc).__name__
        report["error"]="Google Play readback failed; consult protected Action logs."
    finally:
        OUTPUT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
        counts=report.get("counts",{})
        checks=report.get("sha256_matches",{})
        ok=report.get("status")=="verified"
        lines=[
            "## Push Office — Google Play ko-KR 이미지 신규 조회 결과",
            "",
            f"- 결과: **{'API 재조회 성공' if ok else '재조회 미확인'}**",
            f"- 패키지: \`{APP}\`",
            f"- 아이콘: {counts.get('icon','?')}개 / 대표 그래픽: {counts.get('featureGraphic','?')}개 / 휴대전화 설명 이미지: {counts.get('phoneScreenshots','?')}개",
            f"- 등록정보 이름 일치: {report.get('listing_title_ok',False)}, 텍스트 존재: {report.get('listing_text_nonempty',False)}",
            f"- 이미지 ID 고유성: {report.get('ids_unique',{})}",
            f"- 원본 PNG와 Play SHA-256 일치 여부: {checks} (Google Play에서 SHA를 제공하지 않거나 변환 시 별도 확인 필요)",
            "- GitHub 실제 UI 캡처: https://github.com/hebi10/pushOffice_app/actions/runs/42952209462",
            "- PR: https://github.com/hebi10/pushOffice_app/pull/46",
            "",
            "이미지 등록 정보만 조회했습니다. 테스트 트랙·AAB·버전 코드는 수정하지 않았습니다.",
            "API 등록 확인과 Google Play 스토어 이용자에게 실제 노출되는 시점은 다를 수 있습니다.",
        ]
        SUMMARY.write_text("\n".join(lines)+"\n",encoding="utf-8")
    print("Play readback status="+report["status"]+"; counts="+json.dumps(report.get("counts",{})))
    return 0 if report["status"]=="verified" else 1

if __name__=="__main__":
    raise SystemExit(main())
