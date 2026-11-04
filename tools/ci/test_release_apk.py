import base64
import contextlib
import importlib
import io
import itertools
import json
import os
from pathlib import Path
import shutil
import struct
import sys
import tempfile
import unittest
from unittest.mock import patch
import warnings
from zipfile import ZIP_DEFLATED, ZipFile

sys.path.insert(0, str(Path(__file__).parent))
try:
    release = importlib.import_module('release_apk')
except ModuleNotFoundError:
    release = None

PIN = '7704A1A8A8927701A6F86FE5100C633A0DE5A038D41AA7C65C8A56150DF55845'
SECRET_NAMES = (
    'PUSH_OFFICE_KEYSTORE_BASE64', 'PUSH_OFFICE_KEYSTORE_PASSWORD',
    'PUSH_OFFICE_KEY_ALIAS', 'PUSH_OFFICE_KEY_PASSWORD',
    'PUSH_OFFICE_UPLOAD_CERT_SHA256',
)
BADGING = """package: name='com.hebi96.pushOffice_app' versionCode='3' versionName='1.1.0' platformBuildVersionName='16'
sdkVersion:'26'
targetSdkVersion:'36'
uses-permission: name='android.permission.INTERNET'
native-code: 'arm64-v8a' 'armeabi-v7a' 'x86_64'
"""
MANIFEST = {
    'package': 'com.hebi96.pushOffice_app', 'version_code': '3',
    'version_name': '1.1.0', 'min_sdk': '26', 'target_sdk': '36',
    'debuggable': False, 'abis': ['arm64-v8a', 'armeabi-v7a', 'x86_64'],
    'permissions': ['android.permission.INTERNET'],
}
CONFIG = {'expo': {'version': '1.1.0', 'android': {
    'package': 'com.hebi96.pushOffice_app', 'versionCode': 3,
    'blockedPermissions': ['android.permission.RECORD_AUDIO'],
}}}
SIGNATURE = ('Verifies\nVerified using v1 scheme (JAR signing): true\n'
             'Verified using v2 scheme (APK Signature Scheme v2): true\n'
             'Number of signers: 1\nSigner #1 certificate DN: CN=Upload\n'
             'Signer #1 certificate SHA-256 digest: ' + PIN.lower() + '\n')


def environment():
    return {
        'PUSH_OFFICE_KEYSTORE_BASE64': base64.b64encode(b'fake test keystore').decode(),
        'PUSH_OFFICE_KEYSTORE_PASSWORD': 'sentinel-store-password',
        'PUSH_OFFICE_KEY_ALIAS': 'sentinel-key-alias',
        'PUSH_OFFICE_KEY_PASSWORD': 'sentinel-key-password',
        'PUSH_OFFICE_UPLOAD_CERT_SHA256': PIN,
    }


def elf(alignment=16384):
    identity = b'\x7fELF\x02\x01\x01' + b'\x00' * 9
    header = struct.pack('<HHIQQQIHHHHHH', 3, 183, 1, 0, 64, 0, 0, 64, 56, 1, 0, 0, 0)
    load = struct.pack('<IIQQQQQQ', 1, 5, 0, 0, 0, 120, 120, alignment)
    return identity + header + load


def apk(path, alignment=16384, abis=('arm64-v8a', 'armeabi-v7a', 'x86_64')):
    with ZipFile(path, 'w', compression=ZIP_DEFLATED) as archive:
        for name in ('AndroidManifest.xml', 'classes.dex', 'resources.arsc'):
            archive.writestr(name, b'payload:' + name.encode())
        for abi in abis:
            archive.writestr(f'lib/{abi}/libapp.so', elf(alignment) if abi != 'armeabi-v7a' else b'ELF32 fixture')
        archive.writestr('META-INF/services/keep', b'keep service payload')


class ReleaseApkTests(unittest.TestCase):
    def setUp(self):
        self.assertIsNotNone(release, 'Portable APK release implementation is missing')

    def test_all_five_signing_values_and_approved_pin_are_mandatory(self):
        valid = environment()
        release.require_signing(valid)
        for count in range(5):
            for names in itertools.combinations(SECRET_NAMES, count):
                with self.subTest(names=names):
                    with self.assertRaises(release.ReleaseError) as caught:
                        release.require_signing({name: valid[name] for name in names})
                    self.assertNotIn('sentinel-', str(caught.exception))
        for pin in ('AB' * 32, 'old certificate', ''):
            with self.subTest(pin=pin):
                with self.assertRaises(release.ReleaseError):
                    release.require_signing({**valid, 'PUSH_OFFICE_UPLOAD_CERT_SHA256': pin})

    def test_badging_reads_package_sdk_abis_and_permissions(self):
        self.assertEqual(release.parse_badging(BADGING), MANIFEST)
        parsed = release.parse_badging(BADGING + "uses-permission-sdk-23: name='android.permission.CAMERA'\n")
        self.assertIn('android.permission.CAMERA', parsed['permissions'])

    def test_ambiguous_missing_or_debug_badging_is_rejected(self):
        for description in (
            BADGING + "sdkVersion:'26'\n", BADGING + BADGING,
            BADGING.replace("targetSdkVersion:'36'\n", ''),
            BADGING + 'application-debuggable\n',
            BADGING.replace("native-code: 'arm64-v8a' 'armeabi-v7a' 'x86_64'", 'native-code: malformed'),
        ):
            with self.subTest(description=description):
                with self.assertRaises(release.ReleaseError):
                    release.parse_badging(description)

    def test_metadata_guards_reject_wrong_package_version_sdk_debug_abis_and_permissions(self):
        release.validate_metadata(MANIFEST, CONFIG)
        for changed in (
            {'package': 'wrong.app'}, {'version_name': '0.0.0'}, {'version_code': '2'},
            {'min_sdk': '25'}, {'target_sdk': '35'}, {'debuggable': True},
            {'abis': ['arm64-v8a', 'x86_64']},
            {'abis': ['arm64-v8a', 'armeabi-v7a', 'x86_64', 'x86_64']},
            {'permissions': ['android.permission.CAMERA']},
            {'permissions': ['android.permission.RECORD_AUDIO']},
        ):
            with self.subTest(changed=changed):
                with self.assertRaises(release.ReleaseError):
                    release.validate_metadata({**MANIFEST, **changed}, CONFIG)

    def test_signature_requires_v2_single_signer_pinned_non_debug_certificate(self):
        release.validate_signature_description(SIGNATURE)
        for description in (
            SIGNATURE.replace('v2): true', 'v2): false'),
            SIGNATURE.replace('Number of signers: 1', 'Number of signers: 2'),
            SIGNATURE + 'Signer #2 certificate SHA-256 digest: ' + PIN + '\n',
            SIGNATURE.replace(PIN.lower(), 'ab' * 32),
            SIGNATURE.replace('CN=Upload', 'CN=Android Debug, O=Android'),
            SIGNATURE.replace('Number of signers: 1\n', ''),
        ):
            with self.subTest(description=description):
                with self.assertRaises(release.ReleaseError) as caught:
                    release.validate_signature_description(description)
                self.assertNotIn(PIN, str(caught.exception))

    def test_payload_inspects_real_zip_abis_elf_and_required_entries(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / 'source.apk'
            apk(source)
            with patch.object(release, 'checked_run', return_value=BADGING.encode()), patch.object(release, 'executable', return_value='aapt2'):
                proof = release.verify_payload(source, Path(directory), CONFIG, {})
                self.assertEqual(proof['abi_library_counts'], {'arm64-v8a': 1, 'armeabi-v7a': 1, 'x86_64': 1})
                self.assertEqual(proof['elf_64bit_libraries_checked'], 2)
                self.assertTrue(proof['elf_16kb_verified'])
                apk(source, alignment=4096)
                with self.assertRaises(release.ReleaseError):
                    release.verify_payload(source, Path(directory), CONFIG, {})
                apk(source, abis=('arm64-v8a', 'x86_64'))
                with self.assertRaises(release.ReleaseError):
                    release.verify_payload(source, Path(directory), CONFIG, {})
                with ZipFile(source, 'w') as archive:
                    archive.writestr('AndroidManifest.xml', b'incomplete')
                with self.assertRaises(release.ReleaseError):
                    release.verify_payload(source, Path(directory), CONFIG, {})

    def test_payload_comparison_excludes_only_top_level_jar_signatures(self):
        with tempfile.TemporaryDirectory() as directory:
            source, target = Path(directory) / 'source.apk', Path(directory) / 'target.apk'
            apk(source)
            shutil.copyfile(source, target)
            with ZipFile(target, 'a') as archive:
                archive.writestr('META-INF/MANIFEST.MF', b'new digest')
                archive.writestr('META-INF/UPLOAD.SF', b'new signature')
                archive.writestr('META-INF/UPLOAD.RSA', b'new certificate')
            release.compare_payloads(source, target)
            with ZipFile(target, 'a') as archive:
                archive.writestr('META-INF/services/added', b'unexpected payload')
            with self.assertRaises(release.ReleaseError):
                release.compare_payloads(source, target)
            shutil.copyfile(source, target)
            with warnings.catch_warnings():
                warnings.simplefilter('ignore', UserWarning)
                with ZipFile(target, 'a') as archive:
                    archive.writestr('classes.dex', b'changed')
            with self.assertRaises(release.ReleaseError):
                release.compare_payloads(source, target)

    def test_wrong_keystore_certificate_stops_before_apk_signing(self):
        with tempfile.TemporaryDirectory() as directory:
            folder = Path(directory)
            calls = []
            def run(command, label, **kwargs):
                calls.append(command)
                return b'wrong certificate'
            with patch.object(release, 'checked_run', side_effect=run), patch.object(release, 'jdk_tool', return_value='keytool'):
                with self.assertRaises(release.ReleaseError):
                    release.sign_apk(folder / 'source.apk', folder / 'signed.apk', folder, environment(), folder)
            self.assertEqual(len(calls), 1)
            self.assertFalse((folder / 'signed.apk').exists())

    def test_malformed_keystore_is_rejected_before_tooling_or_file_creation(self):
        with tempfile.TemporaryDirectory() as directory:
            folder = Path(directory)
            env = {**environment(), 'PUSH_OFFICE_KEYSTORE_BASE64': '!not-base64!'}
            with patch.object(release, 'checked_run') as runner:
                with self.assertRaises(release.ReleaseError) as caught:
                    release.sign_apk(folder / 'source.apk', folder / 'signed.apk', folder, env, folder)
            runner.assert_not_called()
            self.assertEqual(list(folder.iterdir()), [])
            self.assertNotIn('!not-base64!', str(caught.exception))

    def test_signing_uses_environment_password_references_and_verifies_alignment(self):
        with tempfile.TemporaryDirectory() as directory:
            folder = Path(directory)
            calls = []
            def run(command, label, **kwargs):
                calls.append(command)
                if '-exportcert' in command:
                    return b'test public certificate'
                if '-printcert' in command:
                    return b'Owner: CN=Upload'
                if 'verify' in command:
                    return SIGNATURE.encode()
                return b''
            with patch.object(release, 'checked_run', side_effect=run), patch.object(release, 'sha256', return_value=PIN), patch.object(release, 'jdk_tool', return_value='keytool'), patch.object(release, 'executable', side_effect=lambda directory, name: name):
                release.sign_apk(folder / 'source.apk', folder / 'signed.apk', folder, environment(), folder)
            flattened = ' '.join(str(value) for command in calls for value in command)
            self.assertNotIn('sentinel-store-password', flattened)
            self.assertNotIn('sentinel-key-password', flattened)
            self.assertIn('env:PUSH_OFFICE_KEYSTORE_PASSWORD', flattened)
            self.assertIn('env:PUSH_OFFICE_KEY_PASSWORD', flattened)
            self.assertIn(['zipalign', '-c', '-P', '16', '4', str(folder / 'signed.apk')], calls)
            signer = next(command for command in calls if 'sign' in command)
            self.assertEqual(signer[signer.index('--v2-signing-enabled') + 1], 'true')
            self.assertEqual(signer[signer.index('--v4-signing-enabled') + 1], 'false')
            self.assertEqual((folder / 'existing-upload-keystore').stat().st_mode & 0o777, 0o600)

    def test_failed_signature_or_alignment_does_not_publish_artifacts(self):
        for failed in ('signature', 'alignment'):
            with self.subTest(failed=failed), tempfile.TemporaryDirectory() as directory:
                folder = Path(directory)
                source, output = folder / 'source.apk', folder / 'release'
                apk(source)
                def sign(source, destination, tools, env, temporary):
                    shutil.copyfile(source, destination)
                    raise release.ReleaseError('Rejected ' + failed)
                with patch.object(release, 'checked_run', return_value=BADGING.encode()), patch.object(release, 'executable', return_value='aapt2'), patch.object(release, 'sign_apk', side_effect=sign):
                    with self.assertRaises(release.ReleaseError):
                        release.finalize(source, output, CONFIG, environment(), folder)
                self.assertFalse(output.exists())

    def test_changed_payload_is_rejected_before_publication(self):
        with tempfile.TemporaryDirectory() as directory:
            folder = Path(directory)
            source, output = folder / 'source.apk', folder / 'release'
            apk(source)
            def sign(source, destination, tools, env, temporary):
                with ZipFile(source) as original, ZipFile(destination, 'w') as signed:
                    for name in original.namelist():
                        signed.writestr(name, b'tampered dex' if name == 'classes.dex' else original.read(name))
            with patch.object(release, 'checked_run', return_value=BADGING.encode()), patch.object(release, 'executable', return_value='aapt2'), patch.object(release, 'sign_apk', side_effect=sign):
                with self.assertRaises(release.ReleaseError):
                    release.finalize(source, output, CONFIG, environment(), folder)
            self.assertFalse(output.exists())

    def test_finalizer_publishes_report_hash_and_github_output_only_after_verification(self):
        with tempfile.TemporaryDirectory() as directory:
            folder = Path(directory)
            source, output, github = folder / 'source.apk', folder / 'release', folder / 'github-output'
            apk(source)
            original = source.read_bytes()
            env = {**environment(), 'GITHUB_OUTPUT': str(github)}
            def sign(source, destination, tools, env, temporary):
                shutil.copyfile(source, destination)
            with patch.object(release, 'checked_run', return_value=BADGING.encode()), patch.object(release, 'executable', return_value='aapt2'), patch.object(release, 'sign_apk', side_effect=sign):
                proof = release.finalize(source, output, CONFIG, env, folder, source_commit='a' * 40)
            name = 'PushOffice-v1.1.0-code3-signed.apk'
            report = output / 'PushOffice-v1.1.0-code3-signed.verification.json'
            self.assertEqual(proof['filename'], name)
            self.assertTrue(proof['signature_verified'])
            self.assertFalse(proof['can_update_play_installation'])
            self.assertEqual(proof['manifest'], MANIFEST)
            self.assertEqual(proof['source_commit'], 'a' * 40)
            self.assertEqual(proof['size_bytes'], len(original))
            self.assertEqual((output / name).read_bytes(), original)
            self.assertEqual(json.loads(report.read_text()), proof)
            self.assertEqual(github.read_text(), f'apk_path={output / name}\napk_report_path={report}\n')
            self.assertNotIn('sentinel-', report.read_text())
            self.assertEqual(source.read_bytes(), original)
            with patch.object(release, 'sign_apk') as signer:
                with self.assertRaises(release.ReleaseError):
                    release.finalize(source, output, CONFIG, env, folder)
                signer.assert_not_called()

    def test_cli_errors_suppress_external_values(self):
        with tempfile.TemporaryDirectory() as directory:
            config = Path(directory) / 'app.json'
            config.write_text(json.dumps(CONFIG), encoding='utf-8')
            output = io.StringIO()
            arguments = ['release_apk.py', '--source', str(Path(directory) / 'source.apk'), '--output-directory', str(Path(directory) / 'release'), '--app-config', str(config), '--build-tools', directory]
            with patch.object(sys, 'argv', arguments), patch.object(release, 'finalize', side_effect=OSError('sentinel-private-subprocess-output')), contextlib.redirect_stderr(output):
                self.assertEqual(release.main(), 1)
            self.assertNotIn('sentinel-', output.getvalue())


if __name__ == '__main__':
    unittest.main()
