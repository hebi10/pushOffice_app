#!/usr/bin/env python3
"""List packaged Android LiteRT native ABI support; do not infer this from build success."""
import json
from pathlib import Path
import sys
from zipfile import ZipFile

apk = Path(sys.argv[1])
output = Path(sys.argv[2])
if not apk.is_file():
    raise SystemExit(f"APK missing: {apk}")
with ZipFile(apk) as archive:
    entries = [name for name in archive.namelist() if name.startswith("lib/") and name.endswith(".so")]
litert = [name for name in entries if "litert" in name.lower() or "lite_rt" in name.lower() or "llm" in name.lower()]
abis = sorted({name.split("/")[1] for name in entries})
abi_litert = {abi: [x for x in litert if x.startswith(f"lib/{abi}/")] for abi in abis}
report = {
    "apk": str(apk),
    "allNativeAbis": abis,
    "litertCandidateLibrariesByAbi": abi_litert,
    "x86_64LiteRtCandidatePresent": bool(abi_litert.get("x86_64")),
    "note": "Native .so inspection is a prerequisite, NOT successful model inference."
}
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps(report, ensure_ascii=False, indent=2))
