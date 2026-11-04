import importlib
import json
from pathlib import Path
import sys
import tempfile
import unittest
from datetime import datetime, timezone

sys.path.insert(0, str(Path(__file__).parent))


class PolicyTests(unittest.TestCase):
    def setUp(self):
        self.policy = importlib.import_module('release_policy')

    def test_main_push_is_always_internal_deploy(self):
        request = self.policy.release_request('push', 'refs/heads/main', 'hebi10/pushOffice_app', {'target': 'closed'})
        self.assertEqual(request, {'mode': 'deploy', 'target': 'internal'})

    def test_dispatch_defaults_and_explicit_closed(self):
        self.assertEqual(self.policy.release_request('workflow_dispatch', 'refs/heads/main', 'hebi10/pushOffice_app', {}),
                         {'mode': 'deploy', 'target': 'internal'})
        self.assertEqual(self.policy.release_request('workflow_dispatch', 'refs/heads/main', 'hebi10/pushOffice_app', {'mode': 'check', 'target': 'closed'}),
                         {'mode': 'check', 'target': 'closed'})

    def test_other_branches_repositories_and_unsafe_targets_are_rejected(self):
        inputs = [('pull_request', 'refs/heads/main', 'hebi10/pushOffice_app', {}),
                  ('push', 'refs/heads/feature', 'hebi10/pushOffice_app', {}),
                  ('push', 'refs/heads/main', 'somebody/pushOffice_app', {}),
                  ('workflow_dispatch', 'refs/heads/main', 'hebi10/pushOffice_app', {'target': 'production'}),
                  ('workflow_dispatch', 'refs/heads/main', 'hebi10/pushOffice_app', {'mode': 'unknown'})]
        for args in inputs:
            with self.subTest(args=args), self.assertRaises(self.policy.ReleaseError):
                self.policy.release_request(*args)

    def test_upload_gate_is_exact_and_does_not_block_builds(self):
        before = datetime(2026, 11, 6, 3, 31, 59, tzinfo=timezone.utc)
        at = datetime(2026, 11, 6, 3, 32, tzinfo=timezone.utc)
        self.assertFalse(self.policy.upload_allowed(before))
        self.assertTrue(self.policy.upload_allowed(at))

    def test_required_signing_values_and_fixed_pin(self):
        environment = dict.fromkeys(self.policy.PRIVATE_SIGNING_SECRETS, 'sentinel-private-value')
        self.policy.require_signing(environment)
        for name in self.policy.PRIVATE_SIGNING_SECRETS:
            with self.subTest(name=name), self.assertRaises(self.policy.ReleaseError) as caught:
                self.policy.require_signing({k: v for k, v in environment.items() if k != name})
            self.assertNotIn('sentinel-private-value', str(caught.exception))
        self.assertEqual(self.policy.CERTIFICATE, '7704A1A8A8927701A6F86FE5100C633A0DE5A038D41AA7C65C8A56150DF55845')

    def test_effective_version_changes_only_android_code(self):
        config = {'expo': {'version': '1.1.0', 'android': {'package': self.policy.PACKAGE, 'versionCode': 3}, 'extra': {'preserved': True}}}
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / 'app.json'
            path.write_text(json.dumps(config))
            self.policy.set_version(path, 10)
            config['expo']['android']['versionCode'] = 10
            self.assertEqual(json.loads(path.read_text()), config)
            for invalid in [True, 0, 9, 2100000001, '11']:
                with self.subTest(code=invalid), self.assertRaises(self.policy.ReleaseError):
                    self.policy.set_version(path, invalid)

    def test_build_only_code_is_deterministic_and_bounded(self):
        self.assertEqual(self.policy.build_version(3, '25'), 28)
        for bad in ['0', 'abc', '-1', '2100000000']:
            with self.subTest(value=bad), self.assertRaises(self.policy.ReleaseError):
                self.policy.build_version(3, bad)


if __name__ == '__main__':
    unittest.main()
