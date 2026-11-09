#!/usr/bin/env python3
"""Parse Android device logs; SHA and native text generation are distinct pass criteria."""
import json
import pathlib
import sys
src, dest, expected_id = sys.argv[1:]
lines = pathlib.Path(src).read_text(encoding="utf-8", errors="replace").splitlines()
reports = [line.split("REPORT=", 1)[1].strip()
           for line in lines if "PushOfficeAiRealQA" in line and "REPORT=" in line]
if not reports:
    raise SystemExit("Real Android inference report was not emitted (possible native crash).")
report = json.loads(reports[-1])
assert report["modelId"] == expected_id, "Wrong model tested"
pathlib.Path(dest).parent.mkdir(parents=True, exist_ok=True)
pathlib.Path(dest).write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps(report, ensure_ascii=False, indent=2))
if not report.get("sha256VerifiedOnAndroid"):
    raise SystemExit("Android SHA-256 full-file verification not completed.")
if not report.get("actualCpuTextGenerated"):
    raise SystemExit("Real Android LiteRT-LM CPU inference did not produce text.")
if not report.get("koreanSchedulePassed"):
    print("NOTICE: Native text generation succeeded, but Korean schedule extraction is not yet accurate.")
