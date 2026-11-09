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
    raise SystemExit("Android model produced text, but Korean schedule extraction was incorrect.")
if not report.get("noScheduleSavedByTest"):
    raise SystemExit("Model QA unexpectedly modified the saved schedule count.")
if report.get("modelId") == "qwen35-08" and not report.get("localBriefingPassed"):
    raise SystemExit("Qwen3.5 0.8B local briefing integration did not pass.")
if not report.get("notificationCandidatePolicyPassed"):
    raise SystemExit("Android notification suggestion policy verification did not pass.")
