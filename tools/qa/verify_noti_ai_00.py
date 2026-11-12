#!/usr/bin/env python3
"""Validate the production-Kotlin synthetic notification baseline and print scoped metrics."""
import hashlib
import json
import os
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
BASELINE = ROOT / "modules/push-office-native/android/build/reports/noti-ai-00/baseline.json"
FIXTURE = ROOT / "modules/push-office-native/android/src/test/resources/noti-ai-00-cases.tsv"
COUNTS = {"complete": 24, "incomplete": 12, "unrelated": 14, "sensitive": 10}


def validate(path=BASELINE):
    report = json.loads(Path(path).read_text(encoding="utf-8"))
    assert report["schemaVersion"] == 1
    assert report["dataset"] == "synthetic-notification-v1"
    assert report["referenceClock"] == "2026-11-12T10:00:00+09:00[Asia/Seoul]"
    assert report["realNotificationMetrics"] is False
    assert report["aiInferenceMeasured"] is False
    assert report["deviceLatencyOrBatteryMeasured"] is False
    assert report["fixtureSha256"] == hashlib.sha256(FIXTURE.read_bytes()).hexdigest()
    assert report["sampleCount"] == 60 and report["groups"] == COUNTS

    rows = report["cases"]
    assert len(rows) == 60
    assert len({row["id"] for row in rows}) == 60
    assert all(set(row) == {"id", "group", "candidate", "accepted", "exact"} for row in rows)
    assert all(row["group"] in COUNTS and type(row["candidate"]) is bool and
               type(row["accepted"]) is bool and type(row["exact"]) is bool for row in rows)
    for group, count in COUNTS.items():
        assert sum(row["group"] == group for row in rows) == count

    def confusion(stage):
        positive = lambda row: row["group"] in {"complete", "incomplete"}
        value = lambda row: row[stage]
        return {
            "tp": sum(positive(row) and value(row) for row in rows),
            "fp": sum(not positive(row) and value(row) for row in rows),
            "fn": sum(positive(row) and not value(row) for row in rows),
            "tn": sum(not positive(row) and not value(row) for row in rows),
        }

    assert report["candidateConfusion"] == confusion("candidate")
    assert report["finalConfusion"] == confusion("accepted")
    assert report["confirmedRecall"] == {
        "matched": sum(row["group"] == "complete" and row["accepted"] for row in rows), "total": 24
    }
    assert report["incompleteIntentRecall"] == {
        "matched": sum(row["group"] == "incomplete" and row["accepted"] for row in rows), "total": 12
    }
    assert report["dateTimeExactOnAllConfirmed"] == {
        "matched": sum(row["exact"] for row in rows), "total": 24
    }
    assert all(not row["exact"] or
               (row["group"] == "complete" and row["accepted"]) for row in rows)
    assert report["sensitiveCandidateLeakIds"] == [
        row["id"] for row in rows if row["group"] == "sensitive" and row["candidate"]
    ]
    assert report["sensitiveBlockedBeforeParsing"] == {
        "blocked": 10 - len(report["sensitiveCandidateLeakIds"]), "total": 10
    }
    assert report["sensitiveCandidateLeakIds"] == [], "Sensitive test message entered the candidate queue."
    assert report["missedConfirmedIds"] == [
        row["id"] for row in rows if row["group"] == "complete" and not row["accepted"]
    ]
    assert report["missedIncompleteIds"] == [
        row["id"] for row in rows if row["group"] == "incomplete" and not row["accepted"]
    ]
    assert report["falsePositiveUnrelatedIds"] == [
        row["id"] for row in rows if row["group"] == "unrelated" and row["accepted"]
    ]
    assert report["wrongDateOrRepeatIds"] == [
        row["id"] for row in rows if row["group"] == "complete" and row["accepted"] and not row["exact"]
    ]
    return report


def percent(a, b):
    return f"{100 * a / b:.1f}%" if b else "N/A"


def summarize(report):
    candidate = report["candidateConfusion"]
    final = report["finalConfusion"]
    complete = report["confirmedRecall"]
    partial = report["incompleteIntentRecall"]
    dates = report["dateTimeExactOnAllConfirmed"]
    precision = percent(final["tp"], final["tp"] + final["fp"])
    recall = percent(final["tp"], final["tp"] + final["fn"])
    metrics = [
        "NOTI-AI-00 | synthetic sample only (not a real-device, battery, or AI benchmark)",
        "Cases: 60 (confirmed 24 / incomplete 12 / unrelated 14 / sensitive 10)",
        f"Candidate gate: TP={candidate['tp']} FP={candidate['fp']} FN={candidate['fn']} TN={candidate['tn']}",
        f"Final parser: TP={final['tp']} FP={final['fp']} FN={final['fn']} TN={final['tn']}",
        f"Synthetic final precision: {precision} | recall all intents: {recall}",
        f"Confirmed date+time recall: {complete['matched']}/{complete['total']} = {percent(complete['matched'], complete['total'])}",
        f"Incomplete intent recall: {partial['matched']}/{partial['total']} = {percent(partial['matched'], partial['total'])}",
        f"Exact date/time+repeat across all confirmed: {dates['matched']}/{dates['total']}",
        f"Sensitive synthetic alerts blocked: {report['sensitiveBlockedBeforeParsing']['blocked']}/10",
        "Missed confirmed: " + ", ".join(report["missedConfirmedIds"]),
        "False positive unrelated: " + ", ".join(report["falsePositiveUnrelatedIds"]),
        "Wrong date/repeat: " + ", ".join(report["wrongDateOrRepeatIds"]),
    ]
    return "\n".join(metrics)


if __name__ == "__main__":
    try:
        path = Path(sys.argv[1]) if len(sys.argv) > 1 else BASELINE
        report = validate(path)
        output = summarize(report)
        print(output)
        if os.environ.get("GITHUB_STEP_SUMMARY"):
            with Path(os.environ["GITHUB_STEP_SUMMARY"]).open("a", encoding="utf-8") as fh:
                fh.write("## NOTI-AI-00 offline synthetic baseline\n\n")
                fh.write("\n".join("- " + line for line in output.splitlines()) + "\n")
    except (ValueError, KeyError, OSError, AssertionError, TypeError) as error:
        print("NOTI-AI-00 report verification failed: " + str(error), file=sys.stderr)
        sys.exit(1)
