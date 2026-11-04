import copy
from contextlib import redirect_stderr, redirect_stdout
from datetime import datetime, timezone
import hashlib
from http.client import RemoteDisconnected
import importlib
import io
import json
import os
from pathlib import Path
import struct
import sys
import tempfile
import unittest
from unittest.mock import patch
from urllib.error import HTTPError
from urllib.parse import unquote, urlsplit
from zipfile import ZipFile

sys.path.insert(0, str(Path(__file__).parent))
try:
    play = importlib.import_module('play_publish')
except ModuleNotFoundError:
    play = None

from test_release_aab import field, xml_element

PACKAGE = 'com.hebi96.pushOffice_app'
EDITS = f'/androidpublisher/v3/applications/{PACKAGE}/edits'
PIN = '7704A1A8A8927701A6F86FE5100C633A0DE5A038D41AA7C65C8A56150DF55845'
ANDROID = 'http://schemas.android.com/apk/res/android'


class Response(io.BytesIO):
    def __init__(self, value):
        super().__init__(json.dumps(value).encode('utf-8'))


class PlayServer:
    def __init__(self, tracks=None, bundles=None, apks=None):
        self.tracks = copy.deepcopy(tracks if tracks is not None else [
            {'track': 'qa', 'releases': [{'status': 'completed', 'versionCodes': ['2']}]},
            {'track': 'production', 'releases': [{'status': 'completed', 'versionCodes': ['7']}]},
            {'track': 'closed-test', 'releases': []},
        ])
        self.bundles = bundles if bundles is not None else [{'versionCode': 8}]
        self.apks = apks if apks is not None else [{'versionCode': 9}]
        self.calls, self.edits, self.deleted = [], {}, []
        self.counter, self.uploaded = 0, None
        self.failures, self.overrides = {}, {}

    def __call__(self, request, *, timeout):
        parsed = urlsplit(request.full_url)
        path = parsed.path + ('?' + parsed.query if parsed.query else '')
        method = request.get_method()
        self.calls.append((method, path, request.data))
        key = (method, path)
        if key in self.failures:
            raise self.failures[key]
        if key in self.overrides:
            return Response(self.overrides[key])
        if method == 'POST' and path == EDITS:
            self.counter += 1
            edit_id = f'e{self.counter}'
            self.edits[edit_id] = copy.deepcopy(self.tracks)
            return Response({'id': edit_id, 'expiryTimeSeconds': '9999999999'})
        normalized = path.removeprefix('/upload')
        edit_id = normalized[len(EDITS) + 1:].split('/')[0].split(':')[0]
        tracks = self.edits.get(edit_id, [])
        if method == 'DELETE':
            self.deleted.append(edit_id)
            self.edits.pop(edit_id, None)
            return Response({})
        if method == 'GET' and path.endswith('/tracks'):
            return Response({'kind': 'androidpublisher#tracksListResponse', 'tracks': tracks})
        if method == 'GET' and path.endswith('/bundles'):
            return Response({'kind': 'androidpublisher#bundlesListResponse', 'bundles': self.bundles})
        if method == 'GET' and path.endswith('/apks'):
            return Response({'kind': 'androidpublisher#apksListResponse', 'apks': self.apks})
        if method == 'POST' and path.endswith('/bundles?uploadType=media'):
            self.uploaded = bytes(request.data)
            return Response({'versionCode': 10, 'sha1': '0' * 40,
                             'sha256': hashlib.sha256(self.uploaded).hexdigest()})
        if method == 'PUT' and '/tracks/' in path:
            updated = json.loads(request.data)
            self.edits[edit_id] = [updated if item['track'] == updated['track'] else item for item in tracks]
            return Response(updated)
        if method == 'POST' and path.endswith(':validate'):
            return Response({'id': edit_id, 'expiryTimeSeconds': '9999999999'})
        if method == 'POST' and ':commit?' in path:
            self.tracks = self.edits.pop(edit_id)
            return Response({'id': edit_id, 'expiryTimeSeconds': '9999999999'})
        if method == 'GET' and '/tracks/' in path:
            name = unquote(path.rsplit('/', 1)[1], errors='strict')
            return Response(next(item for item in tracks if item['track'] == name))
        raise AssertionError(f'Unexpected request: {method} {path}')


def elf():
    return (b'\x7fELF\x02\x01\x01' + b'\x00' * 9
            + struct.pack('<HHIQQQIHHHHHH', 3, 183, 1, 0, 64, 0, 0, 64, 56, 1, 0, 0, 0)
            + struct.pack('<IIQQQQQQ', 1, 5, 0, 0, 0, 120, 120, 16384))


class PlayTests(unittest.TestCase):
    def setUp(self):
        self.assertIsNotNone(play, 'Play publisher implementation is missing')
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.bundle = self.root / 'PushOffice-v1.1.0-code10-signed.aab'
        manifest = xml_element('manifest', [('', 'package', PACKAGE),
                               (ANDROID, 'versionCode', '10'), (ANDROID, 'versionName', '1.1.0')], [
            xml_element('uses-sdk', [(ANDROID, 'minSdkVersion', '26'), (ANDROID, 'targetSdkVersion', '36')]),
            xml_element('application'),
        ])
        with ZipFile(self.bundle, 'w') as archive:
            for name in ('BundleConfig.pb', 'base/dex/classes.dex', 'base/resources.pb'):
                archive.writestr(name, b'payload')
            archive.writestr('base/manifest/AndroidManifest.xml', manifest)
            for abi in ('arm64-v8a', 'armeabi-v7a', 'x86_64'):
                archive.writestr(f'base/lib/{abi}/libtest.so', elf())
            archive.writestr('META-INF/UPLOAD.SF', b'signature proof fixture')
        self.proof = {
            'mode': 'signed', 'signature_verified': True, 'signing_pending': False,
            'play_upload_performed': False, 'filename': self.bundle.name,
            'sha256': hashlib.sha256(self.bundle.read_bytes()).hexdigest(),
            'size_bytes': self.bundle.stat().st_size, 'bundletool_validated': True,
            'signer_certificate_sha256': PIN, 'source_commit': 'a' * 40,
            'preparation': {'payloads_and_metadata_preserved': True,
                            'raw_local_records_preserved': True, 'source_unchanged': True,
                            'retained_entries': 7, 'removed_entries': []},
            'manifest': {'package': PACKAGE, 'version_code': '10', 'version_name': '1.1.0',
                         'min_sdk': '26', 'target_sdk': '36', 'debuggable': False, 'permissions': []},
            'abi_library_counts': {'arm64-v8a': 1, 'armeabi-v7a': 1, 'x86_64': 1},
            'elf_64bit_libraries_checked': 2, 'elf_16kb_verified': True,
        }
        self.verification = self.root / 'PushOffice-v1.1.0-code10-signed.verification.json'
        self.write_proof()
        self.notes = self.root / 'notes.txt'
        self.notes.write_text('<ko-KR>\n• 일정 알림을 개선했습니다.\n</ko-KR>\n', encoding='utf-8')
        self.config = self.root / 'app.json'
        self.config.write_text(json.dumps({'expo': {'version': '1.1.0',
                               'android': {'package': PACKAGE, 'versionCode': 3}}}), encoding='utf-8')
        self.release_config = self.root / 'release-app.json'
        self.release_config.write_text(json.dumps({'expo': {'version': '1.1.0',
                                       'android': {'package': PACKAGE, 'versionCode': 10}}}), encoding='utf-8')
        self.server = PlayServer()
        self.client = play.PlayClient('sentinel-private-token', transport=self.server)

    def write_proof(self):
        self.verification.write_text(json.dumps(self.proof), encoding='utf-8')

    def preflight(self, **kwargs):
        return play.preflight(self.client, 'internal', app_config=self.config, **kwargs)

    def publish(self, **kwargs):
        return play.publish(self.client, 'internal', bundle=self.bundle,
                            verification=self.verification, notes=self.notes,
                            app_config=self.release_config, source_commit='a' * 40, **kwargs)

    def test_preflight_allocates_above_bundles_apks_and_all_tracks_and_deletes_edit(self):
        result = self.preflight()
        self.assertEqual(result['api_track'], 'qa')
        self.assertEqual(result['next_version_code'], 10)
        self.assertEqual(result['used_version_codes'], [2, 7, 8, 9])
        self.assertEqual(self.server.deleted, ['e1'])
        self.assertFalse(any(method == 'PUT' or '/upload/' in path or ':commit' in path
                             for method, path, _ in self.server.calls))

    def test_preflight_retains_higher_configured_code(self):
        config = json.loads(self.config.read_text())
        config['expo']['android']['versionCode'] = 20
        self.config.write_text(json.dumps(config))
        self.assertEqual(self.preflight()['next_version_code'], 20)

    def test_internal_inventory_accepts_localized_space_and_form_factor_tracks(self):
        self.server.tracks.extend([
            {'track': '비공개 테스트', 'releases': [{'status': 'completed', 'versionCodes': ['20']}]},
            {'track': 'Closed testing 2026', 'releases': [{'status': 'draft', 'versionCodes': ['21']}]},
            {'track': 'wear:production', 'releases': [{'status': 'completed', 'versionCodes': ['22']}]},
        ])
        result = self.preflight()
        self.assertEqual(result['api_track'], 'qa')
        self.assertEqual(result['next_version_code'], 23)
        self.assertEqual(result['available_track_ids'], [
            'qa', 'production', 'closed-test', '비공개 테스트', 'Closed testing 2026', 'wear:production'])
        self.assertEqual(self.server.deleted, ['e1'])

    def test_invalid_or_duplicate_localized_inventory_is_rejected_with_cleanup(self):
        for names in (['qa', '비공개', '비공개'], ['qa', ''], ['qa', '   '], ['qa', None],
                      ['qa', '닫힌\n테스트'], ['qa', '닫힌\x7f테스트'], ['qa', '닫힌\u200b테스트']):
            with self.subTest(names=names):
                server = PlayServer(tracks=[{'track': name, 'releases': []} for name in names])
                with self.assertRaises(play.ReleaseError):
                    play.preflight(play.PlayClient('token', transport=server), 'internal', app_config=self.config)
                self.assertEqual(server.deleted, ['e1'])

    def test_exact_localized_closed_track_publishes_through_encoded_path_and_readback(self):
        self.server.tracks.append({'track': '비공개 테스트', 'releases': []})
        result = play.preflight(self.client, 'closed', closed_track='비공개 테스트', app_config=self.config)
        self.assertEqual(result['api_track'], '비공개 테스트')
        result = play.publish(self.client, 'closed', closed_track='비공개 테스트', bundle=self.bundle,
                              verification=self.verification, notes=self.notes,
                              app_config=self.release_config, source_commit='a' * 40)
        self.assertEqual(result['status'], 'committed')
        self.assertEqual(self.server.deleted, ['e1', 'e3'])
        self.assertIn(('PUT', EDITS + '/e2/tracks/%EB%B9%84%EA%B3%B5%EA%B0%9C%20%ED%85%8C%EC%8A%A4%ED%8A%B8'),
                      [(method, path) for method, path, _ in self.server.calls])
        self.assertIn(('GET', EDITS + '/e3/tracks/%EB%B9%84%EA%B3%B5%EA%B0%9C%20%ED%85%8C%EC%8A%A4%ED%8A%B8'),
                      [(method, path) for method, path, _ in self.server.calls])

    def test_closed_track_names_with_spaces_require_exact_existing_match(self):
        self.server.tracks.append({'track': 'Closed testing (한국)', 'releases': []})
        result = play.preflight(self.client, 'closed', closed_track='Closed testing (한국)', app_config=self.config)
        self.assertEqual(result['api_track'], 'Closed testing (한국)')
        with self.assertRaises(play.ReleaseError):
            play.preflight(self.client, 'closed', closed_track='closed testing (한국)', app_config=self.config)

    def test_existing_closed_names_cannot_select_reserved_form_factor_or_routing_paths(self):
        for name in ('Production', ' production ', 'Beta', 'QA', 'INTERNAL', 'wear:닫힌 테스트',
                     '../qa', '/qa', '닫힌/테스트', '닫힌\\테스트', '닫힌?track=production',
                     '닫힌#production', '%2Fproduction', '닫힌%20테스트', '.', '..'):
            with self.subTest(name=name):
                server = PlayServer(tracks=[{'track': 'qa'}, {'track': name}])
                with self.assertRaises(play.ReleaseError):
                    play.preflight(play.PlayClient('token', transport=server), 'closed',
                                   closed_track=name, app_config=self.config)
                self.assertEqual(server.calls, [])

    def test_track_request_refuses_encoded_routing_paths_and_noncanonical_encoding(self):
        edit = self.client.create_edit()
        for name in ('%2E%2E', '%2Fproduction', '%252Fproduction', '%FF', '%eb%b9%84',
                     'qa?track=production', '닫힌 테스트', '%ZZ'):
            with self.subTest(name=name):
                with self.assertRaises(play.ReleaseError):
                    self.client.request('GET', edit + '/tracks/' + name)
        self.assertEqual(len(self.server.calls), 1)

    def test_internal_requires_exactly_one_existing_alias(self):
        for tracks in ([], [{'track': 'qa'}, {'track': 'internal'}], [{'track': 'Internal'}]):
            with self.subTest(tracks=tracks):
                server = PlayServer(tracks=tracks)
                with self.assertRaises(play.ReleaseError):
                    play.preflight(play.PlayClient('token', transport=server), 'internal', app_config=self.config)
                self.assertEqual(server.deleted, ['e1'])

    def test_closed_requires_exact_existing_name_and_blocks_reserved_and_form_factor_tracks(self):
        valid = play.preflight(self.client, 'closed', closed_track='closed-test', app_config=self.config)
        self.assertEqual(valid['api_track'], 'closed-test')
        for name in (None, 'production', 'Production', 'beta', 'qa', 'internal',
                     'INTERNAL', 'wear:closed-test', 'unknown', 'closed-Test', '../qa', 'qa\nother'):
            with self.subTest(name=name):
                with self.assertRaises(play.ReleaseError):
                    play.preflight(self.client, 'closed', closed_track=name, app_config=self.config)
        with self.assertRaises(play.ReleaseError):
            self.preflight(closed_track='closed-test')

    def test_duplicate_tracks_and_malformed_version_inventory_fail_with_cleanup(self):
        cases = [PlayServer(tracks=[{'track': 'qa'}, {'track': 'qa'}]),
                 PlayServer(bundles=[{'versionCode': True}]), PlayServer(apks=[{'versionCode': '0'}]),
                 PlayServer(tracks=[{'track': 'qa', 'releases': [{'status': 'draft', 'versionCodes': '12'}]}])]
        for server in cases:
            with self.subTest(server=server):
                with self.assertRaises(play.ReleaseError):
                    play.preflight(play.PlayClient('token', transport=server), 'internal', app_config=self.config)
                self.assertEqual(server.deleted, ['e1'])

    def test_version_code_exhaustion_fails_without_wrapping(self):
        self.server.bundles = [{'versionCode': 2100000000}]
        with self.assertRaises(play.ReleaseError):
            self.preflight()

    def test_preflight_api_failure_is_sanitized_and_cleanup_is_attempted(self):
        path = EDITS + '/e1/apks'
        self.server.failures[('GET', path)] = HTTPError('secret-url', 403, 'sentinel-private-token', {}, io.BytesIO(b'secret-body'))
        with self.assertRaises(play.ReleaseError) as caught:
            self.preflight()
        self.assertNotIn('sentinel-private-token', str(caught.exception))
        self.assertEqual(self.server.deleted, ['e1'])

    def test_failed_preflight_cleanup_cannot_report_success(self):
        self.server.failures[('DELETE', EDITS + '/e1')] = RemoteDisconnected('private details')
        report = {}
        with self.assertRaises(play.ReleaseError):
            self.preflight(report=report)
        self.assertEqual(report['status'], 'cleanup_failed')

    def test_api_client_refuses_other_packages_redirect_targets_and_unowned_deletion(self):
        for path in ('https://evil.invalid', EDITS + '/../other',
                     '/androidpublisher/v3/applications/wrong/edits', EDITS + '/e1/tracks/../../other'):
            with self.subTest(path=path):
                with self.assertRaises(play.ReleaseError):
                    self.client.request('GET', path)
        with self.assertRaises(play.ReleaseError):
            self.client.delete_edit(EDITS + '/foreign')
        self.assertEqual(self.server.calls, [])

    def test_publish_updates_only_selected_track_and_confirms_fresh_edit(self):
        before_production = copy.deepcopy(self.server.tracks[1])
        report = self.publish()
        self.assertEqual(report['status'], 'committed')
        self.assertIs(report['api_accepted'], True)
        self.assertIs(report['track_verified'], True)
        self.assertEqual(report['play_approval'], 'not_confirmed')
        self.assertEqual(self.server.tracks[1], before_production)
        updated = self.server.tracks[0]
        self.assertEqual(updated['track'], 'qa')
        self.assertEqual(updated['releases'][0]['versionCodes'], ['10'])
        self.assertEqual(updated['releases'][0]['status'], 'completed')
        self.assertEqual(updated['releases'][0]['releaseNotes'], [{'language': 'ko-KR', 'text': '• 일정 알림을 개선했습니다.'}])
        self.assertEqual(self.server.deleted, ['e2'])
        commit = [('POST', EDITS + '/e1:commit?changesInReviewBehavior=ERROR_IF_IN_REVIEW')]
        self.assertEqual([(method, path) for method, path, _ in self.server.calls if ':commit?' in path], commit)
        self.assertEqual(self.server.uploaded, self.bundle.read_bytes())

    def test_empty_draft_is_allowed_but_nonempty_draft_halted_and_inprogress_are_blocked(self):
        self.server.tracks[0]['releases'] = [{'status': 'draft', 'versionCodes': []}]
        self.assertEqual(self.publish()['status'], 'committed')
        for status, codes in (('draft', ['2']), ('halted', ['2']), ('inProgress', ['2']), ('halted', [])):
            with self.subTest(status=status, codes=codes):
                server = PlayServer(tracks=[{'track': 'internal', 'releases': [{'status': status, 'versionCodes': codes}]}])
                with self.assertRaises(play.ReleaseError):
                    play.publish(play.PlayClient('token', transport=server), 'internal', bundle=self.bundle,
                                 verification=self.verification, notes=self.notes,
                                 app_config=self.release_config, source_commit='a' * 40)
                self.assertIsNone(server.uploaded)
                self.assertEqual(server.deleted, ['e1'])

    def test_publish_rechecks_external_version_race_before_upload(self):
        self.assertEqual(self.preflight()['next_version_code'], 10)
        self.server.apks.append({'versionCode': 11})
        with self.assertRaises(play.ReleaseError):
            self.publish()
        self.assertIsNone(self.server.uploaded)
        self.assertEqual(self.server.deleted, ['e1', 'e2'])

    def test_unsigned_stale_pin_and_incomplete_verification_are_rejected_before_api(self):
        changes = [{'mode': 'unsigned'}, {'signature_verified': False}, {'signing_pending': True},
                   {'signer_certificate_sha256': 'AB' * 32}, {'source_commit': 'bad'},
                   {'bundletool_validated': False}, {'elf_16kb_verified': False},
                   {'abi_library_counts': {'arm64-v8a': 1}}, {'filename': 'other.aab'},
                   {'sha256': '0' * 64}, {'size_bytes': 1}]
        original = copy.deepcopy(self.proof)
        for changed in changes:
            with self.subTest(changed=changed):
                self.proof = {**original, **changed}
                self.write_proof()
                with self.assertRaises(play.ReleaseError):
                    self.publish()
        self.assertEqual(self.server.calls, [])

    def test_actual_manifest_must_match_verified_report_even_after_digest_is_replaced(self):
        with ZipFile(self.bundle) as archive:
            entries = {name: archive.read(name) for name in archive.namelist()}
        entries['base/manifest/AndroidManifest.xml'] = entries['base/manifest/AndroidManifest.xml'].replace(
            b'com.hebi96.pushOffice_app', b'com.hebi96.otherOffice_app')
        with ZipFile(self.bundle, 'w') as archive:
            for name, value in entries.items():
                archive.writestr(name, value)
        self.proof['sha256'] = hashlib.sha256(self.bundle.read_bytes()).hexdigest()
        self.proof['size_bytes'] = self.bundle.stat().st_size
        self.write_proof()
        with self.assertRaises(play.ReleaseError):
            self.publish()
        self.assertEqual(self.server.calls, [])

    def test_modified_bundle_and_malformed_report_cannot_be_published(self):
        with self.bundle.open('ab') as stream:
            stream.write(b'changed')
        with self.assertRaises(play.ReleaseError):
            self.publish()
        self.verification.write_text('{not-json')
        with self.assertRaises(play.ReleaseError):
            self.publish()
        self.assertEqual(self.server.calls, [])

    def test_release_notes_reject_empty_overlong_markup_and_control_characters(self):
        for text in ('', '<ko-KR></ko-KR>', '가' * 501, '<b>note</b>', 'note\x00', '<ko-KR>note'):
            with self.subTest(text=text[:20]):
                self.notes.write_text(text, encoding='utf-8')
                with self.assertRaises(play.ReleaseError):
                    self.publish()
        self.assertEqual(self.server.calls, [])

    def test_wrong_upload_hash_or_version_never_updates_track(self):
        path = '/upload' + EDITS + '/e1/bundles?uploadType=media'
        for response in ({'versionCode': 11, 'sha256': self.proof['sha256']}, {'versionCode': 10, 'sha256': '0' * 64}):
            with self.subTest(response=response):
                server = PlayServer()
                server.overrides[('POST', path)] = response
                with self.assertRaises(play.ReleaseError):
                    play.publish(play.PlayClient('token', transport=server), 'internal', bundle=self.bundle,
                                 verification=self.verification, notes=self.notes,
                                 app_config=self.release_config, source_commit='a' * 40)
                self.assertFalse(any(method == 'PUT' for method, _, _ in server.calls))
                self.assertEqual(server.deleted, ['e1'])

    def test_upload_failure_is_not_retried_and_edit_is_cleaned(self):
        path = '/upload' + EDITS + '/e1/bundles?uploadType=media'
        self.server.failures[('POST', path)] = RemoteDisconnected('sentinel-private-token')
        with self.assertRaises(play.ReleaseError) as caught:
            self.publish()
        self.assertNotIn('sentinel-private-token', str(caught.exception))
        self.assertEqual(sum(url == path for _, url, _ in self.server.calls), 1)
        self.assertEqual(self.server.deleted, ['e1'])

    def test_validate_failure_prevents_commit(self):
        self.server.failures[('POST', EDITS + '/e1:validate')] = HTTPError('', 400, 'private', {}, None)
        with self.assertRaises(play.ReleaseError):
            self.publish()
        self.assertFalse(any(':commit?' in path for _, path, _ in self.server.calls))
        self.assertEqual(self.server.deleted, ['e1'])

    def test_uncertain_commit_is_not_retried_or_claimed_as_accepted(self):
        path = EDITS + '/e1:commit?changesInReviewBehavior=ERROR_IF_IN_REVIEW'
        for failure in (RemoteDisconnected('private'), HTTPError('', 503, 'private', {}, None)):
            with self.subTest(failure=type(failure).__name__):
                server = PlayServer()
                server.failures[('POST', path)] = failure
                report = {}
                with self.assertRaises(play.ReleaseError):
                    play.publish(play.PlayClient('token', transport=server), 'internal', bundle=self.bundle,
                                 verification=self.verification, notes=self.notes,
                                 app_config=self.release_config, source_commit='a' * 40, report=report)
                self.assertEqual(report['status'], 'commit_unknown')
                self.assertIsNone(report['api_accepted'])
                self.assertEqual(sum(url == path for _, url, _ in server.calls), 1)
                self.assertEqual(server.deleted, [])

    def test_definite_commit_rejection_cleans_uncommitted_edit(self):
        path = EDITS + '/e1:commit?changesInReviewBehavior=ERROR_IF_IN_REVIEW'
        self.server.failures[('POST', path)] = HTTPError('', 409, 'private', {}, None)
        report = {}
        with self.assertRaises(play.ReleaseError):
            self.publish(report=report)
        self.assertFalse(report['api_accepted'])
        self.assertEqual(self.server.deleted, ['e1'])

    def test_fresh_track_mismatch_and_read_failure_leave_api_acceptance_distinct(self):
        path = EDITS + '/e2/tracks/qa'
        for response in ({'track': 'qa', 'releases': [{'status': 'draft', 'versionCodes': ['10']}]},
                         {'track': 'qa', 'releases': [{'status': 'completed', 'versionCodes': ['9']}]},
                         {'track': 'wrong', 'releases': [{'status': 'completed', 'versionCodes': ['10']}]}):
            with self.subTest(response=response):
                server = PlayServer()
                server.overrides[('GET', path)] = response
                report = {}
                with self.assertRaises(play.ReleaseError):
                    play.publish(play.PlayClient('token', transport=server), 'internal', bundle=self.bundle,
                                 verification=self.verification, notes=self.notes,
                                 app_config=self.release_config, source_commit='a' * 40, report=report)
                self.assertTrue(report['api_accepted'])
                self.assertFalse(report['track_verified'])
                self.assertEqual(server.deleted, ['e2'])
        self.server.failures[('GET', path)] = RemoteDisconnected('sentinel-private-token')
        report = {}
        with self.assertRaises(play.ReleaseError):
            self.publish(report=report)
        self.assertTrue(report['api_accepted'])
        self.assertEqual(report['status'], 'committed_unverified')
        self.assertEqual(self.server.deleted, ['e2'])

    def test_verification_cleanup_failure_is_reported_after_commit(self):
        self.server.failures[('DELETE', EDITS + '/e2')] = RemoteDisconnected('private')
        report = {}
        with self.assertRaises(play.ReleaseError):
            self.publish(report=report)
        self.assertTrue(report['api_accepted'])
        self.assertEqual(report['status'], 'committed_cleanup_failed')

    def test_cli_writes_public_report_and_outputs_only_after_clean_preflight(self):
        output, report = self.root / 'github-output', self.root / 'report.json'
        with patch.object(play, 'PlayClient', return_value=self.client), patch.dict(os.environ, {
                'PLAY_ACCESS_TOKEN': 'sentinel-private-token', 'GITHUB_OUTPUT': str(output)}), redirect_stdout(io.StringIO()):
            self.assertEqual(play.main(['preflight', '--app-config', str(self.config), '--report', str(report)]), 0)
        self.assertEqual(output.read_text(), 'next_version_code=10\napi_track=qa\n')
        self.assertNotIn('sentinel-private-token', report.read_text())
        self.assertEqual(json.loads(report.read_text())['status'], 'checked')

    def test_cli_failure_saves_sanitized_report_without_success_outputs(self):
        report, output = self.root / 'failed.json', self.root / 'github-output'
        self.server.failures[('GET', EDITS + '/e1/tracks')] = RemoteDisconnected('sentinel-private-token')
        with patch.object(play, 'PlayClient', return_value=self.client), patch.dict(os.environ, {
                'PLAY_ACCESS_TOKEN': 'sentinel-private-token', 'GITHUB_OUTPUT': str(output)}), redirect_stderr(io.StringIO()):
            self.assertEqual(play.main(['preflight', '--app-config', str(self.config), '--report', str(report)]), 1)
        self.assertEqual(json.loads(report.read_text())['status'], 'failed')
        self.assertNotIn('sentinel-private-token', report.read_text())
        self.assertFalse(output.exists())

    def test_cli_publish_rejects_another_source_commit_before_any_api_request(self):
        config = json.loads(self.config.read_text())
        config['expo']['android']['versionCode'] = 10
        self.config.write_text(json.dumps(config))
        report = self.root / 'wrong-source.json'
        with patch.object(play, 'datetime', create=True) as clock, patch.object(play, 'PlayClient', return_value=self.client), patch.dict(os.environ, {'GITHUB_SHA': 'b' * 40}), redirect_stderr(io.StringIO()), redirect_stdout(io.StringIO()):
            clock.now.return_value = datetime(2026, 11, 6, 3, 32, tzinfo=timezone.utc)
            result = play.main(['publish', '--app-config', str(self.config),
                                '--bundle', str(self.bundle), '--verification', str(self.verification),
                                '--report', str(report)])
        self.assertEqual(result, 1)
        self.assertEqual(self.server.calls, [])
        self.assertFalse(json.loads(report.read_text())['api_accepted'])

    def test_cli_publish_rejects_missing_or_malformed_source_context_before_api(self):
        for source in ('', 'not-a-commit', 'A' * 40):
            with self.subTest(source=source):
                report = self.root / 'invalid-source.json'
                server = PlayServer()
                client = play.PlayClient('token', transport=server)
                with patch.object(play, 'datetime', create=True) as clock, patch.object(play, 'PlayClient', return_value=client), patch.dict(os.environ, {'GITHUB_SHA': source}), redirect_stderr(io.StringIO()), redirect_stdout(io.StringIO()):
                    clock.now.return_value = datetime(2026, 11, 6, 3, 32, tzinfo=timezone.utc)
                    result = play.main(['publish', '--app-config', str(self.release_config),
                                        '--bundle', str(self.bundle), '--verification', str(self.verification),
                                        '--report', str(report)])
                self.assertEqual(result, 1)
                self.assertEqual(server.calls, [])

    def test_cli_publish_rejects_checkout_version_or_package_mismatch_before_api(self):
        configurations = [
            {'expo': {'version': '1.1.0', 'android': {'package': PACKAGE, 'versionCode': 11}}},
            {'expo': {'version': '1.2.0', 'android': {'package': PACKAGE, 'versionCode': 10}}},
            {'expo': {'version': '1.1.0', 'android': {'package': 'com.hebi96.other', 'versionCode': 10}}},
        ]
        for config in configurations:
            with self.subTest(config=config):
                self.config.write_text(json.dumps(config))
                report = self.root / 'wrong-config.json'
                server = PlayServer()
                client = play.PlayClient('token', transport=server)
                with patch.object(play, 'datetime', create=True) as clock, patch.object(play, 'PlayClient', return_value=client), patch.dict(os.environ, {'GITHUB_SHA': 'a' * 40}), redirect_stderr(io.StringIO()), redirect_stdout(io.StringIO()):
                    clock.now.return_value = datetime(2026, 11, 6, 3, 32, tzinfo=timezone.utc)
                    result = play.main(['publish', '--app-config', str(self.config),
                                        '--bundle', str(self.bundle), '--verification', str(self.verification),
                                        '--report', str(report)])
                self.assertEqual(result, 1)
                self.assertEqual(server.calls, [])

    def test_cli_publish_refuses_before_key_activation_without_api_calls(self):
        report = self.root / 'deferred.json'
        with patch.object(play, 'datetime', create=True) as clock, patch.object(play, 'PlayClient', return_value=self.client), redirect_stderr(io.StringIO()), redirect_stdout(io.StringIO()):
            clock.now.return_value = datetime(2026, 11, 6, 3, 31, 59, tzinfo=timezone.utc)
            self.assertEqual(play.main(['publish', '--bundle', str(self.bundle),
                             '--verification', str(self.verification), '--report', str(report)]), 1)
        self.assertEqual(json.loads(report.read_text())['status'], 'deferred')
        self.assertFalse(json.loads(report.read_text())['api_accepted'])
        self.assertEqual(self.server.calls, [])

    def test_cli_publish_accepts_activation_boundary_and_retains_approval_distinction(self):
        report = self.root / 'published.json'
        with patch.object(play, 'datetime', create=True) as clock, patch.object(play, 'PlayClient', return_value=self.client), patch.dict(os.environ, {'GITHUB_SHA': 'a' * 40}), redirect_stdout(io.StringIO()):
            clock.now.return_value = datetime(2026, 11, 6, 3, 32, tzinfo=timezone.utc)
            self.assertEqual(play.main(['publish', '--app-config', str(self.release_config), '--bundle', str(self.bundle),
                             '--verification', str(self.verification), '--report', str(report)]), 0)
        result = json.loads(report.read_text())
        self.assertTrue(result['api_accepted'])
        self.assertEqual(result['play_approval'], 'not_confirmed')

    def test_track_update_failure_is_not_retried_or_committed(self):
        path = EDITS + '/e1/tracks/qa'
        self.server.failures[('PUT', path)] = RemoteDisconnected('private')
        with self.assertRaises(play.ReleaseError):
            self.publish()
        self.assertEqual(sum(url == path for _, url, _ in self.server.calls), 1)
        self.assertFalse(any(':commit?' in url for _, url, _ in self.server.calls))
        self.assertEqual(self.server.deleted, ['e1'])


if __name__ == '__main__':
    unittest.main()
