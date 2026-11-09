#!/usr/bin/env python3
"""Extract real Android instrumentation result, keeping unsupported != passed."""
import json
from pathlib import Path
import sys

log_path = Path(sys.argv[1])
output = Path(sys.argv[2])
lines = log_path.read_text(encoding="utf-8", errors="replace").splitlines()
entries = [line.split("REPORT=", 1)[1].strip() for line in lines if "PushOfficeAiEmuQA" in line and "REPORT=" in line]
if not entries:
    raise SystemExit("No on-device AI probe report found. Android instrumentation did not complete.")
report = json.loads(entries[-1])
expected = {"gemini-nano", "qwen3-06", "qwen35-08", "qwen35-2", "gemma4-e2b"}
rows = report.get("models", [])
assert report.get("modelCount") == 5 and {x["modelId"] for x in rows} == expected, "Five-model probe is incomplete"
assert report.get("androidShaCorruptionTest") == "passed"
assert report.get("androidScheduleTimestampTest") == "passed"
assert all(x.get("inference") in {"passed", "not_executed", "failed", "probe_error"} for x in rows)
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
for row in rows:
    print(f'{row["modelId"]}: {row.get("inference")} | {row.get("state", "unknown")} | {row.get("reason", row.get("safety", ""))}')
passed = sum(x["inference"] == "passed" for x in rows)
print(f"ACTUAL ANDROID MODEL INFERENCE PASSED: {passed}/5. Not-executed entries are NOT model successes.")
if any(x["inference"] in {"failed", "probe_error"} for x in rows):
    raise SystemExit("Android AI model probe found an actual runtime error; see JSON evidence.")
