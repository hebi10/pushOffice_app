"""Store authorization must be wired before any Play authentication or edits."""
import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location(
    "ops07_store_wiring_audit", Path(__file__).with_name("audit.py"))
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)


def store_workflow():
    return """on:
  pull_request:
  workflow_dispatch:
jobs:
  upload:
    if: github.event_name == 'workflow_dispatch'
    runs-on: ubuntu-latest
    steps:
      - name: OPS-06 separate store approval
        run: python3 scripts/ops06/store_gate.py apply
      - uses: google-github-actions/auth@v3
      - run: python3 scripts/play/listing_images.py --apply
"""


class StoreWiringTests(unittest.TestCase):
    def findings(self, source):
        def read(path):
            if path == ".github/workflows/play-listing-images.yml":
                return source
            return None
        with patch.object(audit, "read", side_effect=read):
            return audit.store_guard_findings()

    def test_valid_store_gate_precedes_authentication(self):
        self.assertEqual(self.findings(store_workflow()), [])

    def test_custom_shell_cannot_ignore_failed_approval(self):
        example = store_workflow().replace(
            "        run: python3 scripts/ops06/store_gate.py apply\n",
            "        shell: bash {0}\n"
            "        run: |\n"
            "          python3 scripts/ops06/store_gate.py apply\n"
            "          echo finished\n", 1)
        self.assertTrue(any("STORE_OPTIONAL:" in item for item in self.findings(example)),
                        self.findings(example))

    def test_unflagged_default_image_publisher_requires_store_approval(self):
        example = store_workflow().replace(
            "python3 scripts/play/listing_images.py --apply",
            "python3 .github/ops/publish_play_store_images.py", 1)
        self.assertEqual(self.findings(example), [])
        changed = example.replace(
            "      - name: OPS-06 separate store approval\n"
            "        run: python3 scripts/ops06/store_gate.py apply\n", "", 1)
        self.assertTrue(any("STORE_GUARD:" in issue for issue in self.findings(changed)),
                        self.findings(changed))

    def test_quoted_default_image_publisher_needs_approval(self):
        source = store_workflow().replace(
            "python3 scripts/play/listing_images.py --apply",
            'python3 ".github/ops/publish_play_store_images.py"', 1)
        self.assertEqual(self.findings(source), [])
        without_gate = source.replace(
            "      - name: OPS-06 separate store approval\n"
            "        run: python3 scripts/ops06/store_gate.py apply\n", "", 1)
        self.assertTrue(any("STORE_GUARD:" in issue for issue in self.findings(without_gate)),
                        self.findings(without_gate))

    def test_missing_store_gate_blocks(self):
        source = store_workflow().replace(
            "      - name: OPS-06 separate store approval\n"
            "        run: python3 scripts/ops06/store_gate.py apply\n", "")
        self.assertTrue(any("STORE_GUARD" in p for p in self.findings(source)))

    def test_authentication_before_store_gate_blocks(self):
        source = store_workflow().replace(
            "      - uses: google-github-actions/auth@v3\n", "")
        source = source.replace(
            "      - name: OPS-06 separate store approval\n",
            "      - uses: google-github-actions/auth@v3\n"
            "      - name: OPS-06 separate store approval\n")
        self.assertTrue(any("STORE_ORDER" in p for p in self.findings(source)))


    def test_custom_shells_cannot_swallow_failed_store_approval(self):
        for declaration in ("shell: sh {0}", '"shell": bash {0}',
                            "shell: bash --noprofile --norc {0}"):
            with self.subTest(shell=declaration):
                example = store_workflow().replace(
                    "        run: python3 scripts/ops06/store_gate.py apply",
                    "        " + declaration + "\n"
                    "        run: python3 scripts/ops06/store_gate.py apply", 1)
                self.assertTrue(
                    any("STORE_OPTIONAL:" in item for item in self.findings(example)),
                    self.findings(example))

    def test_status_checks_cannot_publish_after_rejected_store_approval(self):
        for condition in ("!success()", "success() == false",
                          "success() || inputs.force == true", "!cancelled()"):
            with self.subTest(condition=condition):
                example = store_workflow().replace(
                    "      - uses: google-github-actions/auth@v3",
                    "      - if: " + condition + "\n"
                    "        uses: google-github-actions/auth@v3", 1)
                self.assertTrue(
                    any("STORE_BYPASS:" in item for item in self.findings(example)),
                    self.findings(example))

    def test_explicit_success_dependency_is_safe(self):
        example = store_workflow().replace(
            "      - uses: google-github-actions/auth@v3",
            "      - if: success() && inputs.mode == 'publish'\n"
            "        uses: google-github-actions/auth@v3", 1)
        self.assertEqual(self.findings(example), [])


if __name__ == "__main__":
    unittest.main()
