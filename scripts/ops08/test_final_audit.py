"""Read-only release-boundary tests for OPS-08."""
import importlib.util
import os
from pathlib import Path
import re
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("ops08_final_audit", Path(__file__).with_name("final_audit.py"))
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)


class FinalPolicyTests(unittest.TestCase):
    def test_checked_out_git_source_has_complete_sha(self):
        self.assertRegex(audit.verified_head(), r"^[0-9a-f]{40}$")

    def test_main_validation_is_not_claimed_for_pull_requests(self):
        with patch.dict(os.environ, {"GITHUB_REF": "refs/pull/123/merge"}):
            result = audit.audit()
        self.assertFalse(result["main_verified"])
        self.assertEqual(result["repository"], audit.REPOSITORY)

    def test_no_credential_or_publisher_action_in_final_audit(self):
        source = (ROOT / ".github/workflows/ops08-final-policy.yml").read_text(encoding="utf-8")
        for forbidden in ("id-token: write", "google-github-actions/auth@",
                          "PLAY_ACCESS_TOKEN:", "androidpublisher.googleapis.com",
                          "publish-play", "--mode deploy", "PLAY_SERVICE_ACCOUNT"):
            with self.subTest(value=forbidden):
                self.assertNotIn(forbidden, source)
        self.assertIn("permissions:\n  contents: read", source)

    def test_required_policy_files_include_all_release_stages(self):
        files = set(audit.REQUIRED)
        for value in ("AGENTS.md", "scripts/ops07/audit.py",
                      ".github/workflows/release-build.yml",
                      ".github/workflows/play-internal-release.yml",
                      ".github/workflows/play-closed-release.yml",
                      "scripts/ops06/store_gate.py"):
            with self.subTest(path=value):
                self.assertIn(value, files)

    def test_report_explicitly_distinguishes_api_from_review(self):
        result = audit.audit()
        self.assertIs(result["play_api_called"], False)
        self.assertIs(result["play_uploaded"], False)
        self.assertIs(result["store_changed"], False)
        self.assertIn(result["status"], {"pass", "blocked"})
        self.assertTrue(isinstance(result["policy_hashes_sha256"], dict))


    def test_final_workflow_runs_on_every_main_push(self):
        source = (ROOT / ".github/workflows/ops08-final-policy.yml").read_text(
            encoding="utf-8")
        self.assertEqual(audit.final_workflow_issues(source), [])
        original = "  push:\n    branches: [main]\n"
        self.assertIn(original, source)
        unsafe = (
            source.replace(original,
                           "  push:\n    branches: [main]\n    paths: [scripts/ops08/**]\n", 1),
            source.replace(original, "  push:\n    paths: [scripts/ops08/**]\n", 1),
            source.replace(original, "  # push:\n    branches: [main]\n", 1),
        )
        for changed in unsafe:
            with self.subTest(index=unsafe.index(changed)):
                self.assertTrue(any("OPS-08 main push" in issue
                                    or "OPS-08 must run after every main" in issue
                                    for issue in audit.final_workflow_issues(changed)))

    def test_mismatched_checked_out_commit_is_rejected(self):
        actual = audit.verified_head()
        mismatched = ("0" if actual[0] != "0" else "1") + actual[1:]
        with patch.dict(os.environ, {"GITHUB_SHA": mismatched}):
            with self.assertRaisesRegex(RuntimeError, "differs from checkout"):
                audit.verified_head()

    def test_main_verified_never_claims_success_if_policy_is_blocked(self):
        from unittest.mock import Mock
        simulated = Mock()
        simulated.findings.return_value = ["sample OPS-07 fail-closed blocker"]
        with patch.object(audit, "ops07", return_value=simulated):
            with patch.dict(os.environ, {"GITHUB_REF": "refs/heads/main"}):
                report = audit.audit()
        self.assertEqual(report["status"], "blocked")
        self.assertFalse(report["main_verified"])
        self.assertIn("sample OPS-07 fail-closed blocker", report["issues"])


if __name__ == "__main__":
    unittest.main()
