"""Regression fixtures for fail-closed release-authorization parsing."""
import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("ops07_regression_audit", Path(__file__).with_name("audit.py"))
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)


def publish_on(event, command, job="sync", quoted=False):
    header = '"jobs":' if quoted else "jobs:"
    return (event + "\n" + header + "\n  " + job + ":\n"
            "    runs-on: ubuntu-latest\n    steps:\n      - run: " + command + "\n")


def store_workflow(guard=True, guard_run=None, pre_auth="", before_guard="", failure="", guard_if=""):
    approval = ("      - name: Verify immutable approved batch\n"
                + ("        if: " + guard_if + "\n" if guard_if else "")
                + ("        continue-on-error: " + failure + "\n" if failure else "")
                + "        run: " + (guard_run or "python3 scripts/ops06/store_gate.py apply") + "\n") if guard else ""
    return ("on:\n  workflow_dispatch:\njobs:\n  upload:\n"
            "    if: github.event_name == 'workflow_dispatch'\n"
            "    runs-on: ubuntu-latest\n    steps:\n"
            + before_guard + approval + pre_auth
            + "      - uses: google-github-actions/auth@v3\n"
            + "      - run: python3 scripts/play/listing_images.py --mode upload\n")


class FailClosedRegressionTests(unittest.TestCase):
    def test_inline_comment_and_quoted_jobs_cannot_hide_push(self):
        text = publish_on('on: [push, workflow_dispatch] # release', 
                          "python3 scripts/release/publisher.py deploy", quoted=True)
        self.assertTrue(audit.automatic_mutations("play.yml", text))
        self.assertEqual(audit.triggers(text), {"push", "workflow_dispatch"})
        self.assertIn("sync", audit.jobs(text))

    def test_flow_job_mapping_fails_closed(self):
        text = ('on: push\njobs: {upload: {runs-on: ubuntu-latest,'
                ' steps: [{run: "python3 scripts/release/publisher.py deploy"}]}}\n')
        self.assertTrue(audit.automatic_mutations("play.yml", text))
        self.assertIn("__unparsed_jobs__", audit.jobs(text))

    def test_actual_mobile_and_icon_publishers_without_mode(self):
        for command in ("python3 scripts/publish-mobile-play.py --aab release.aab",
                        "python3 scripts/play/store_icon.py --file icon.png"):
            with self.subTest(command=command):
                self.assertTrue(audit.automatic_mutations("other.yml", publish_on(
                    "on:\n  push:", command)))

    def test_dynamic_store_filename_requires_approval(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            folder = root / ".github/workflows"
            folder.mkdir(parents=True)
            (folder / "renamed-assets.yml").write_text(store_workflow(guard=False), encoding="utf-8")
            with patch.object(audit, "ROOT", root):
                self.assertTrue(any("STORE_GUARD" in issue for issue in audit.store_guard_findings()))

    def test_store_guard_must_execute_and_stop_on_failure(self):
        for kwargs in (
            {"guard_if": "false"},
            {"failure": "true"},
            {"failure": "$" + "{{ true }}"},
            {"guard_run": 'echo "python3 scripts/ops06/store_gate.py apply"'},
            {"guard_run": "python3 scripts/ops06/store_gate.py apply || true"},
        ):
            with self.subTest(kwargs=kwargs), tempfile.TemporaryDirectory() as temporary:
                root = Path(temporary)
                folder = root / ".github/workflows"
                folder.mkdir(parents=True)
                (folder / "play-listing-images.yml").write_text(
                    store_workflow(**kwargs), encoding="utf-8")
                with patch.object(audit, "ROOT", root):
                    issues = audit.store_guard_findings()
                self.assertTrue(any("STORE_OPTIONAL" in item for item in issues), issues)

    def test_direct_play_edit_before_store_guard_blocks(self):
        before = ("      - run: curl -X POST "
                  "https://androidpublisher.googleapis.com/androidpublisher/v3/applications/example/edits\n")
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            folder = root / ".github/workflows"
            folder.mkdir(parents=True)
            (folder / "store.yml").write_text(store_workflow(before_guard=before),
                                               encoding="utf-8")
            with patch.object(audit, "ROOT", root):
                issues = audit.store_guard_findings()
        self.assertTrue(any("STORE_ORDER" in item for item in issues), issues)

    def test_release_approval_atom_must_be_unconditionally_required(self):
        safe = "github.event_name == 'workflow_dispatch' && inputs.ops01_release_approved == true"
        unsafe = "github.event_name == 'workflow_dispatch' && (inputs.ops01_release_approved == true || true)"
        predicate = "inputs.ops01_release_approved == true"
        self.assertIn(predicate, audit._guaranteed_atoms(safe))
        self.assertNotIn(predicate, audit._guaranteed_atoms(unsafe))

    def test_chained_publish_scripts_and_image_only_upload(self):
        for script in (
            "python3 scripts/play/preflight.py auth && python3 scripts/play/publisher.py deploy",
            "python3 scripts/play/preflight.py auth; python3 scripts/release/play_closed.py deploy",
            "python3 scripts/play/images_only.py --track internal",
        ):
            with self.subTest(script=script):
                self.assertTrue(audit.automatic_mutations(
                    "custom.yml", publish_on("on:\n  push:", script)))

    def test_id_first_upload_before_approval_is_blocked(self):
        before = ("      - id: early_upload\n"
                  "        run: python3 scripts/play/listing_images.py --mode upload\n")
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            folder = root / ".github/workflows"
            folder.mkdir(parents=True)
            (folder / "renamed-store.yml").write_text(
                store_workflow(before_guard=before), encoding="utf-8")
            with patch.object(audit, "ROOT", root):
                issues = audit.store_guard_findings()
        self.assertTrue(any("STORE_ORDER" in issue for issue in issues), issues)

    def test_downstream_always_cannot_bypass_approval_failure(self):
        source = store_workflow().replace(
            "      - run: python3 scripts/play/listing_images.py --mode upload",
            "      - name: publish regardless\n"
            "        if: always()\n"
            "        run: python3 scripts/play/listing_images.py --mode upload")
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            folder = root / ".github/workflows"
            folder.mkdir(parents=True)
            (folder / "renamed-assets.yml").write_text(source, encoding="utf-8")
            with patch.object(audit, "ROOT", root):
                issues = audit.store_guard_findings()
        self.assertTrue(any("STORE_BYPASS" in issue for issue in issues), issues)

    def test_approval_is_not_itself_a_play_mutation(self):
        source = ("on:\n  workflow_dispatch:\njobs:\n  upload:\n"
                  "    if: github.event_name == 'workflow_dispatch'\n"
                  "    runs-on: ubuntu-latest\n    steps:\n"
                  "      - name: authorize either approved listing mode\n"
                  "        if: needs.source.outputs.mode == 'listing' || needs.source.outputs.mode == 'reconcile'\n"
                  "        run: python3 scripts/ops06/store_gate.py apply\n"
                  "      - name: upload listing\n"
                  "        if: needs.source.outputs.mode == 'listing'\n"
                  "        run: python3 scripts/release/listing.py apply --phone-only\n"
                  "      - name: reconcile listing\n"
                  "        if: needs.source.outputs.mode == 'reconcile'\n"
                  "        run: python3 scripts/release/listing.py apply --reconcile-brand\n")
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            folder = root / ".github/workflows"
            folder.mkdir(parents=True)
            (folder / "play-listing.yml").write_text(source, encoding="utf-8")
            with patch.object(audit, "ROOT", root):
                issues = audit.store_guard_findings()
        self.assertEqual(issues, [])

    def test_removing_both_internal_provenance_guards_fails(self):
        workflow = ("on:\n  workflow_dispatch:\njobs:\n"
                    "  verify:\n    runs-on: ubuntu-latest\n    steps:\n"
                    "      - run: python3 scripts/ops04/internal.py verify\n"
                    "  publish:\n    runs-on: ubuntu-latest\n    steps:\n"
                    "      - run: python3 scripts/ops04/internal.py verify\n")
        with patch.object(audit, "read", side_effect=lambda path:
                          workflow if path == ".github/workflows/play-internal-release.yml" else None):
            findings = audit.findings()
        self.assertTrue(any("PROVENANCE" in item for item in findings), findings)





class SharedHardeningRegressionTests(unittest.TestCase):
    def test_if_first_and_folded_step_conditions(self):
        self.assertEqual(audit._step_condition(
            "      - if: false\n        run: echo skipped\n"), "false")
        self.assertEqual(audit._step_condition(
            "      - if: >-\n          always()\n        run: echo unsafe\n"),
            "always()")
        self.assertEqual(audit._step_condition(
            "      - name: release\n        if: >-\n          inputs.mode == 'publish'\n"
            "        run: echo release\n"), "inputs.mode == 'publish'")

    def test_chained_store_mutation_requires_approval(self):
        workflow = store_workflow(guard=False).replace(
            "python3 scripts/play/listing_images.py --mode upload",
            "python3 scripts/ops07/preflight.py check&&python3 scripts/play/listing_images.py --mode upload")
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            folder = root / ".github/workflows"
            folder.mkdir(parents=True)
            (folder / "renamed-store.yml").write_text(workflow, encoding="utf-8")
            with patch.object(audit, "ROOT", root):
                issues = audit.store_guard_findings()
        self.assertTrue(any("STORE_GUARD" in issue for issue in issues), issues)

    def test_run_first_approval_and_masked_pipeline(self):
        valid = store_workflow().replace(
            "      - name: Verify immutable approved batch\n"
            "        run: python3 scripts/ops06/store_gate.py apply\n",
            "      - run: python3 scripts/ops06/store_gate.py apply\n")
        bad = store_workflow(guard_run="python3 scripts/ops06/store_gate.py apply | tee approval.log")
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            folder = root / ".github/workflows"
            folder.mkdir(parents=True)
            filename = folder / "play-listing-images.yml"
            with patch.object(audit, "ROOT", root):
                filename.write_text(valid, encoding="utf-8")
                self.assertEqual(audit.store_guard_findings(), [])
                filename.write_text(bad, encoding="utf-8")
                issues = audit.store_guard_findings()
        self.assertTrue(any("STORE_OPTIONAL" in issue for issue in issues), issues)

    def test_provenance_guards_must_not_ignore_failed_checks(self):
        workflow = ("on:\n  workflow_dispatch:\njobs:\n"
                    "  verify:\n    steps:\n"
                    "      - run: python3 scripts/ops04/internal.py guard || true\n"
                    "  publish:\n    steps:\n"
                    "      - run: python3 scripts/ops04/internal.py guard || true\n")
        with patch.object(audit, "read", side_effect=lambda path:
                          workflow if path == ".github/workflows/play-internal-release.yml"
                          else None):
            issues = audit.findings()
        self.assertTrue(any("PROVENANCE" in issue for issue in issues), issues)

    def test_compound_automatic_publisher_is_detected(self):
        workflow = publish_on("on:\n  push:",
            "python3 scripts/play/preflight.py auth&&python3 scripts/play/publisher.py deploy")
        self.assertTrue(audit.automatic_mutations("custom.yml", workflow))



class FailureBoundaryRegressionTests(unittest.TestCase):
    def test_step_leading_ignore_errors_rejects_store_approval(self):
        workflow = store_workflow().replace(
            "      - name: Verify immutable approved batch\n",
            "      - continue-on-error: true\n"
            "        name: Verify immutable approved batch\n")
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            folder = root / ".github/workflows"
            folder.mkdir(parents=True)
            (folder / "play-listing-images.yml").write_text(workflow, encoding="utf-8")
            with patch.object(audit, "ROOT", root):
                issues = audit.store_guard_findings()
        self.assertTrue(any("STORE_OPTIONAL" in item for item in issues), issues)

    def test_downstream_auth_cannot_ignore_failed_provenance(self):
        workflow = ("on:\n  workflow_dispatch:\njobs:\n"
                    "  verify:\n    steps:\n"
                    "      - run: python3 scripts/ops04/internal.py guard\n"
                    "  publish:\n    steps:\n"
                    "      - run: python3 scripts/ops04/internal.py guard\n"
                    "      - name: Unsafe Play authentication\n"
                    "        if: always()\n"
                    "        uses: google-github-actions/auth@v3\n")
        with patch.object(audit, "read", side_effect=lambda path:
                          workflow if path == ".github/workflows/play-internal-release.yml"
                          else None):
            issues = audit.findings()
        self.assertTrue(any("PROVENANCE_BYPASS" in item for item in issues), issues)



class PushOfficeReleaseGateRegressionTests(unittest.TestCase):
    def test_refresh_requires_manual_full_release_approval(self):
        read_file = audit.read
        path = ".github/workflows/pushoffice-store-refresh-20261111.yml"
        workflow = read_file(path)
        self.assertIn("inputs.ops01_release_approved == true", workflow)
        unsafe = workflow.replace("inputs.ops01_release_approved == true", "true")
        with patch.object(audit, "read", side_effect=lambda name:
                          unsafe if name == path else read_file(name)):
            issues = audit.findings()
        self.assertTrue(any("APPROVAL: Push Office" in item for item in issues), issues)

    def test_frozen_inline_publisher_cannot_be_reactivated(self):
        read_file = audit.read
        path = ".github/workflows/pushoffice-play-images-once-20261108.yml"
        workflow = read_file(path)
        self.assertIn("false &&", workflow)
        unsafe = workflow.replace("false &&", "true &&", 1)
        with patch.object(audit, "read", side_effect=lambda name:
                          unsafe if name == path else read_file(name)):
            issues = audit.findings()
        self.assertTrue(any("FROZEN: Push Office" in item for item in issues), issues)



class InterpreterOptionsRegressionTests(unittest.TestCase):
    def test_unbuffered_python_publisher_is_not_exempt(self):
        workflow = publish_on(
            "on:\n  push:",
            "python3 -u scripts/play/publisher.py deploy --bundle release.aab")
        self.assertTrue(audit.automatic_mutations("custom.yml", workflow))

    def test_unbuffered_store_publisher_requires_approval(self):
        workflow = store_workflow(guard=False).replace(
            "python3 scripts/play/listing_images.py --mode upload",
            "python3 -u scripts/play/listing_images.py --mode upload")
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            folder = root / ".github/workflows"
            folder.mkdir(parents=True)
            (folder / "renamed-assets.yml").write_text(workflow, encoding="utf-8")
            with patch.object(audit, "ROOT", root):
                issues = audit.store_guard_findings()
        self.assertTrue(any("STORE_GUARD" in item for item in issues), issues)



class FlexibleJobConditionRegressionTests(unittest.TestCase):
    def test_four_space_yaml_nesting_respects_manual_gate(self):
        workflow = ("on:\n  push:\n  workflow_dispatch:\njobs:\n"
                    "    sync:\n        runs-on: ubuntu-latest\n"
                    "        if: github.event_name == 'workflow_dispatch'\n"
                    "        steps:\n          - run: python3 scripts/play/publisher.py deploy\n")
        self.assertEqual(audit.automatic_mutations("play.yml", workflow), [])

    def test_quoted_job_conditions_are_unwrapped(self):
        workflow = ("on:\n  push:\n  workflow_dispatch:\njobs:\n"
                    "  sync:\n    runs-on: ubuntu-latest\n"
                    "    if: \"github.event_name == 'workflow_dispatch'\"\n"
                    "    steps:\n      - run: python3 scripts/play/publisher.py deploy\n")
        self.assertEqual(audit.automatic_mutations("play.yml", workflow), [])
        unsafe = workflow.replace(
            "github.event_name == 'workflow_dispatch'",
            "github.event_name == 'workflow_dispatch' || true")
        self.assertTrue(audit.automatic_mutations("play.yml", unsafe))


    def test_quoted_job_if_preserves_manual_release_gate(self):
        example = (
            "on:\n  push:\n  workflow_dispatch:\njobs:\n"
            "  deliver:\n"
            "    \"if\": github.event_name == 'workflow_dispatch'\n"
            "    runs-on: ubuntu-latest\n"
            "    steps:\n"
            "      - run: python3 tools/ci/play_publish.py publish\n"
        )
        self.assertEqual(audit.automatic_mutations("play-release.yml", example), [])
        unsafe = example.replace(
            "github.event_name == 'workflow_dispatch'",
            "github.event_name == 'workflow_dispatch' || github.event_name == 'push'")
        self.assertTrue(audit.automatic_mutations("play-release.yml", unsafe))

    def test_existing_store_publisher_accepts_quoted_job_if(self):
        original_read = audit.read
        path = ".github/workflows/pushoffice-store-refresh-20261111.yml"
        source = original_read(path)
        self.assertEqual(source.count("    if: >-\n"), 1)
        for quoted in ('    "if": >-\n', "    'if': >-\n"):
            with self.subTest(quoted=quoted):
                changed = source.replace("    if: >-\n", quoted, 1)
                with patch.object(audit, "read", side_effect=lambda name:
                                  changed if name == path else original_read(name)):
                    issues = audit.findings()
                self.assertFalse(any("APPROVAL: Push Office" in item for item in issues),
                                 issues)



class QuotedStepControlRegressionTests(unittest.TestCase):
    def findings_for_store(self, source):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            workflows = root / ".github/workflows"
            workflows.mkdir(parents=True)
            (workflows / "pushoffice-store-refresh-20261111.yml").write_text(
                source, encoding="utf-8")
            with patch.object(audit, "ROOT", root):
                return audit.store_guard_findings()

    def test_quoted_false_condition_cannot_skip_approval(self):
        source = store_workflow().replace(
            "      - name: Verify immutable approved batch\n",
            '      - "if": false\n        name: Verify immutable approved batch\n')
        issues = self.findings_for_store(source)
        self.assertTrue(any(issue.startswith(("STORE_OPTIONAL:", "STORE_GUARD:"))
                            for issue in issues), issues)

    def test_quoted_ignore_errors_cannot_bypass_approval(self):
        source = store_workflow().replace(
            "      - name: Verify immutable approved batch\n",
            '      - "continue-on-error": true\n'
            '        name: Verify immutable approved batch\n')
        issues = self.findings_for_store(source)
        self.assertTrue(any(issue.startswith(("STORE_OPTIONAL:", "STORE_GUARD:"))
                            for issue in issues), issues)

    def test_and_list_cannot_mask_approval_failure(self):
        source = store_workflow(
            guard_run="|\n"
                      "          python3 scripts/ops06/store_gate.py apply && echo approved\n"
                      "          echo success")
        issues = self.findings_for_store(source)
        self.assertTrue(any(issue.startswith(("STORE_OPTIONAL:", "STORE_GUARD:"))
                            for issue in issues), issues)


class EffectivePushOfficeApprovalRegressionTests(unittest.TestCase):
    def test_store_approved_source_cannot_be_self_approved(self):
        read_file = audit.read
        path = ".github/workflows/pushoffice-store-refresh-20261111.yml"
        source = read_file(path)
        original = "OPS06_EXPECTED_MAIN_SHA: ${{ inputs.ops06_expected_main_sha }}"
        self.assertIn(original, source)
        changed = source.replace(original, "OPS06_EXPECTED_MAIN_SHA: ${{ github.sha }}")
        with patch.object(audit, "read", side_effect=lambda name:
                          changed if name == path else read_file(name)):
            findings = audit.findings()
        self.assertTrue(any("STORE_BINDING: Push Office OPS06_EXPECTED_MAIN_SHA"
                            in problem for problem in findings), findings)

    def test_store_confirmation_must_come_from_dispatch_input(self):
        read_file = audit.read
        path = ".github/workflows/pushoffice-store-refresh-20261111.yml"
        source = read_file(path)
        original = "OPS06_CONFIRMATION: ${{ inputs.ops06_confirmation }}"
        self.assertIn(original, source)
        changed = source.replace(original, "OPS06_CONFIRMATION: APPLY_VERIFIED_PLAY_STORE_ASSETS")
        with patch.object(audit, "read", side_effect=lambda name:
                          changed if name == path else read_file(name)):
            findings = audit.findings()
        self.assertTrue(any("STORE_BINDING: Push Office OPS06_CONFIRMATION"
                            in problem for problem in findings), findings)

    def test_android_deploy_cannot_skip_release_approval(self):
        read_file = audit.read
        path = ".github/workflows/android-release.yml"
        source = read_file(path)
        gate = ("      - name: OPS-01 require explicit Play release approval\n"
                "        if: steps.request.outputs.mode == 'deploy'\n"
                "        env:\n"
                "          OPS01_RELEASE_APPROVED: ${{ inputs.ops01_release_approved }}\n"
                "        run: |\n"
                "          test \"$GITHUB_EVENT_NAME\" = workflow_dispatch\n"
                "          test \"$OPS01_RELEASE_APPROVED\" = true\n")
        self.assertIn(gate, source)
        forged = source.replace(gate, "")
        with patch.object(audit, "read", side_effect=lambda name:
                          forged if name == path else read_file(name)):
            findings = audit.findings()
        self.assertTrue(any("ANDROID_APPROVAL: Push Office release" in problem
                            for problem in findings), findings)

    def test_existing_android_release_gate_is_accepted(self):
        findings = audit.findings()
        self.assertFalse(any("ANDROID_APPROVAL" in problem for problem in findings),
                         findings)


class AndroidApprovalFailurePropagationTests(unittest.TestCase):
    def test_android_approval_must_not_mask_rejection(self):
        read_file = audit.read
        path = ".github/workflows/android-release.yml"
        source = read_file(path)
        test = 'test "$OPS01_RELEASE_APPROVED" = true'
        self.assertIn(test, source)
        approval = "      - name: OPS-01 require explicit Play release approval\n"
        self.assertIn(approval, source)
        unsafe_cases = (
            source.replace(test, test + " || true", 1),
            source.replace(approval,
                           approval + "        continue-on-error: " + "$" + "{{ true }}\n", 1),
            source.replace(approval, approval + "        shell: bash {0}\n", 1),
        )
        for modified in unsafe_cases:
            with self.subTest(variant=modified != source):
                with patch.object(audit, "read", side_effect=lambda name:
                                  modified if name == path else read_file(name)):
                    issues = audit.findings()
                self.assertTrue(any("ANDROID_APPROVAL: Push Office OPS-01 guard" in issue
                                    for issue in issues), issues)


    def test_android_custom_shell_cannot_ignore_rejected_approval(self):
        original_read = audit.read
        path = ".github/workflows/android-release.yml"
        source = original_read(path)
        marker = "      - name: OPS-01 require explicit Play release approval\n"
        self.assertIn(marker, source)
        for declaration in ("shell: sh {0}", '"shell": bash {0}'):
            with self.subTest(shell=declaration):
                unsafe = source.replace(marker,
                                        marker + "        " + declaration + "\n", 1)
                with patch.object(audit, "read", side_effect=lambda name:
                                  unsafe if name == path else original_read(name)):
                    issues = audit.findings()
                self.assertTrue(any("ANDROID_APPROVAL: Push Office OPS-01 guard"
                                    in item for item in issues), issues)

    def test_android_play_auth_must_depend_on_success(self):
        original_read = audit.read
        path = ".github/workflows/android-release.yml"
        source = original_read(path)
        safe = "        if: steps.request.outputs.mode == 'deploy' && steps.activation.outputs.allowed == 'true'"
        self.assertIn(safe, source)
        for condition in ("!success()", "success() || inputs.force == true"):
            with self.subTest(condition=condition):
                unsafe = source.replace(safe, "        if: " + condition, 1)
                with patch.object(audit, "read", side_effect=lambda name:
                                  unsafe if name == path else original_read(name)):
                    issues = audit.findings()
                self.assertTrue(any("ANDROID_APPROVAL: Play publication must stop"
                                    in item for item in issues), issues)


    def test_android_publisher_must_imply_release_approval_mode(self):
        original_read = audit.read
        path = ".github/workflows/android-release.yml"
        source = original_read(path)
        approved = ("        if: steps.request.outputs.mode == 'deploy' "
                    "&& steps.activation.outputs.allowed == 'true'")
        self.assertEqual(source.count(approved), 2)
        unauthorized = (
            "steps.request.outputs.mode != 'check'",
            "steps.request.outputs.mode == 'build'",
            "steps.request.outputs.mode == 'deploy' || steps.request.outputs.mode == 'build'",
            "inputs.ops01_release_approved == true",
        )
        for replacement in unauthorized:
            for index in (0, 1):
                with self.subTest(condition=replacement, downstream_step=index):
                    start = 0
                    for _ in range(index + 1):
                        position = source.find(approved, start)
                        self.assertNotEqual(position, -1)
                        start = position + len(approved)
                    modified = (source[:position] + "        if: " + replacement
                                + source[position + len(approved):])
                    with patch.object(audit, "read", side_effect=lambda name:
                                      modified if name == path else original_read(name)):
                        issues = audit.findings()
                    self.assertTrue(
                        any("ANDROID_APPROVAL: Play publication must stop" in issue
                            for issue in issues),
                        issues,
                    )


    def test_android_approval_accepts_env_after_yaml_run_block(self):
        original_read = audit.read
        path = ".github/workflows/android-release.yml"
        source = original_read(path)
        current = (
            "        env:\n"
            "          OPS01_RELEASE_APPROVED: $" + "{{ inputs.ops01_release_approved }}\n"
            "        run: |\n"
            "          test \"$GITHUB_EVENT_NAME\" = workflow_dispatch\n"
            "          test \"$OPS01_RELEASE_APPROVED\" = true\n"
        )
        reordered = (
            "        run: |\n"
            "          test \"$GITHUB_EVENT_NAME\" = workflow_dispatch\n"
            "          test \"$OPS01_RELEASE_APPROVED\" = true\n"
            "        env:\n"
            "          OPS01_RELEASE_APPROVED: $" + "{{ inputs.ops01_release_approved }}\n"
        )
        self.assertIn(current, source)
        changed = source.replace(current, reordered, 1)
        with patch.object(audit, "read", side_effect=lambda name:
                          changed if name == path else original_read(name)):
            issues = audit.findings()
        self.assertFalse(any("ANDROID_APPROVAL:" in issue for issue in issues), issues)


    def test_android_gate_accepts_equivalent_yaml_conditions(self):
        original_read = audit.read
        path = ".github/workflows/android-release.yml"
        source = original_read(path)
        literal = "        if: steps.request.outputs.mode == 'deploy'\n"
        self.assertIn(literal, source)
        accepted = (
            "        if: " + "$" + "{{ steps.request.outputs.mode == 'deploy' }}\n",
            '        if: "steps.request.outputs.mode == \'deploy\'"\n',
            '        if: "' + "$" + "{{ steps.request.outputs.mode == 'deploy' }}" + '"\n',
            "        if: 'steps.request.outputs.mode == ''deploy'''\n",
            '        "if": ' + "$" + "{{ steps.request.outputs.mode == 'deploy' }}\n",
        )
        for replacement in accepted:
            with self.subTest(replacement=replacement):
                changed = source.replace(literal, replacement, 1)
                with patch.object(audit, "read", side_effect=lambda name:
                                  changed if name == path else original_read(name)):
                    issues = audit.findings()
                self.assertFalse(any("ANDROID_APPROVAL: Push Office OPS-01 guard"
                                     in issue for issue in issues), issues)

    def test_android_gate_rejects_yaml_expression_with_bypass_branch(self):
        original_read = audit.read
        path = ".github/workflows/android-release.yml"
        source = original_read(path)
        literal = "        if: steps.request.outputs.mode == 'deploy'\n"
        unsafe = (
            "        if: " + "$" + "{{ steps.request.outputs.mode == 'deploy' || true }}\n"
        )
        changed = source.replace(literal, unsafe, 1)
        with patch.object(audit, "read", side_effect=lambda name:
                          changed if name == path else original_read(name)):
            issues = audit.findings()
        self.assertTrue(any("ANDROID_APPROVAL: Push Office OPS-01 guard"
                            in issue for issue in issues), issues)


if __name__ == "__main__":
    unittest.main()
