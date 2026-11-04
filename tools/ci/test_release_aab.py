import importlib
import itertools
from pathlib import Path
import struct
import sys
import tempfile
import unittest
import warnings
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo

sys.path.insert(0, str(Path(__file__).parent))
try:
    release = importlib.import_module('release_aab')
except ModuleNotFoundError:
    release = None

SECRET_NAMES = (
    'PUSH_OFFICE_KEYSTORE_BASE64', 'PUSH_OFFICE_KEYSTORE_PASSWORD',
    'PUSH_OFFICE_KEY_ALIAS', 'PUSH_OFFICE_KEY_PASSWORD',
    'PUSH_OFFICE_UPLOAD_CERT_SHA256',
)


def varint(value):
    result = bytearray()
    while value > 127:
        result.append((value & 127) | 128)
        value >>= 7
    result.append(value)
    return bytes(result)


def field(number, value):
    value = value.encode() if isinstance(value, str) else value
    return varint(number * 8 + 2) + varint(len(value)) + value


def xml_element(name, attributes=(), children=()):
    element = field(3, name)
    for namespace, key, value in attributes:
        attribute = field(2, key) + field(3, value)
        if namespace:
            attribute += field(1, namespace)
        element += field(4, attribute)
    for child in children:
        element += field(5, child)
    return field(1, element)


class ReleaseTests(unittest.TestCase):
    def setUp(self):
        self.assertIsNotNone(release, 'CI release implementation is missing')

    def test_absent_secrets_produce_unsigned_mode(self):
        self.assertEqual(release.signing_mode({}), 'unsigned')
        self.assertEqual(release.signing_mode(dict.fromkeys(SECRET_NAMES, '')), 'unsigned')

    def test_signed_provenance_records_the_verified_pin_and_checkout(self):
        proof = release.provenance('signed', {'PUSH_OFFICE_UPLOAD_CERT_SHA256': 'ab:' * 31 + 'ab', 'GITHUB_SHA': 'c' * 40})
        self.assertEqual(proof, {'signer_certificate_sha256': 'AB' * 32, 'source_commit': 'c' * 40})

    def test_unsigned_provenance_does_not_claim_a_signer(self):
        self.assertEqual(release.provenance('unsigned', {}), {'signer_certificate_sha256': None, 'source_commit': None})

    def test_invalid_source_revision_cannot_enter_provenance(self):
        with self.assertRaises(release.ReleaseError):
            release.provenance('unsigned', {'GITHUB_SHA': 'not-a-commit'})

    def test_all_secrets_enable_signing(self):
        self.assertEqual(release.signing_mode(dict.fromkeys(SECRET_NAMES, 'sentinel-private-value')), 'signed')

    def test_every_partial_secret_configuration_fails_without_echoing_values(self):
        for count in range(1, len(SECRET_NAMES)):
            for names in itertools.combinations(SECRET_NAMES, count):
                with self.subTest(names=names):
                    with self.assertRaises(release.ReleaseError) as caught:
                        release.signing_mode(dict.fromkeys(names, 'sentinel-private-value'))
                    self.assertNotIn('sentinel-private-value', str(caught.exception))

    def test_fingerprint_accepts_colons_and_case_but_rejects_other_content(self):
        self.assertEqual(release.normalize_fingerprint('aB:' * 31 + 'aB'), 'AB' * 32)
        for malformed in ('abc', 'GG' * 32, 'AB' * 32 + '/path'):
            with self.subTest(malformed=malformed):
                with self.assertRaises(release.ReleaseError):
                    release.normalize_fingerprint(malformed)

    def test_debug_certificate_is_rejected_even_with_a_renamed_alias(self):
        with self.assertRaises(release.ReleaseError):
            release.validate_certificate_identity('Owner: CN=Android Debug, O=Android', 'renamed-upload-key', 'AB' * 32, 'AB' * 32)
        with self.assertRaises(release.ReleaseError):
            release.validate_certificate_identity('Owner: CN=Release', 'androiddebugkey', 'AB' * 32, 'AB' * 32)

    def test_different_certificate_fails_without_echoing_fingerprints(self):
        with self.assertRaises(release.ReleaseError) as caught:
            release.validate_certificate_identity('Owner: CN=Release', 'upload', 'AB' * 32, 'CD' * 32)
        self.assertNotIn('ABAB', str(caught.exception))
        self.assertNotIn('CDCD', str(caught.exception))
        release.validate_certificate_identity('Owner: CN=Release', 'upload', 'AB' * 32, 'AB' * 32)

    def test_one_signer_with_certificate_chain_uses_the_leaf_fingerprint(self):
        description = ('Signer #1:\nCertificate #1:\nOwner: CN=Release\nSHA256: ' + 'AB:' * 31 + 'AB'
                       + '\nCertificate #2:\nOwner: CN=Root\nSHA256: ' + 'CD:' * 31 + 'CD')
        release.validate_signed_certificate_description(description, 'upload', 'AB' * 32)
        with self.assertRaises(release.ReleaseError):
            release.validate_signed_certificate_description(description + '\nSigner #2:\nSHA256: ' + 'AB:' * 31 + 'AB', 'upload', 'AB' * 32)

    def test_malformed_base64_fails_before_creating_a_keystore_or_output(self):
        with tempfile.TemporaryDirectory() as directory:
            folder = Path(directory)
            environment = dict.fromkeys(SECRET_NAMES, 'sentinel-private-value')
            environment['PUSH_OFFICE_UPLOAD_CERT_SHA256'] = 'AB' * 32
            environment['PUSH_OFFICE_KEYSTORE_BASE64'] = '!not-base64!'
            with self.assertRaises(release.ReleaseError) as caught:
                release.sign_bundle(folder / 'source.aab', folder / 'signed.aab', environment, folder)
            self.assertNotIn('sentinel-private-value', str(caught.exception))
            self.assertEqual(list(folder.iterdir()), [])

    def test_strip_preserves_unrelated_payloads_raw_records_and_metadata(self):
        with tempfile.TemporaryDirectory() as directory:
            source, target = Path(directory) / 'source.aab', Path(directory) / 'unsigned.aab'
            info = ZipInfo('base/assets/한글.bin', (2025, 3, 2, 1, 2, 4))
            info.compress_type = ZIP_DEFLATED
            info.external_attr = 0o100640 << 16
            info.comment = b'entry-comment'
            info.extra = b'\xfe\xca\x02\x00ok'
            with ZipFile(source, 'w') as archive:
                archive.comment = b'archive-comment'
                archive.writestr(info, b'original payload\x00\xff' * 50)
                archive.writestr('META-INF/RELEASE.SF', b'signature')
                archive.writestr('META-INF/RELEASE.RSA', b'certificate')
                archive.writestr('META-INF/MANIFEST.MF', b'manifest')
                archive.writestr('base/root/META-INF/retain.SF', b'keep nested metadata')
                archive.writestr('META-INF/services/keep', b'keep service')
            original_bytes = source.read_bytes()
            audit = release.strip_jar_signatures(source, target)
            self.assertEqual(source.read_bytes(), original_bytes)
            self.assertEqual(audit['retained_entries'], 3)
            self.assertTrue(audit['payloads_and_metadata_preserved'])
            self.assertTrue(audit['raw_local_records_preserved'])
            with ZipFile(target) as archive:
                self.assertEqual(archive.comment, b'archive-comment')
                self.assertEqual(archive.namelist(), ['base/assets/한글.bin', 'base/root/META-INF/retain.SF', 'META-INF/services/keep'])
                self.assertEqual(archive.read('base/assets/한글.bin'), b'original payload\x00\xff' * 50)
                copied = archive.getinfo('base/assets/한글.bin')
                self.assertEqual(copied.extra, b'\xfe\xca\x02\x00ok')
                self.assertEqual(copied.external_attr, 0o100640 << 16)
                self.assertEqual(copied.date_time, (2025, 3, 2, 1, 2, 4))

    def test_duplicate_names_fail_closed(self):
        with tempfile.TemporaryDirectory() as directory:
            source, target = Path(directory) / 'source.aab', Path(directory) / 'unsigned.aab'
            with warnings.catch_warnings():
                warnings.simplefilter('ignore', UserWarning)
                with ZipFile(source, 'w') as archive:
                    archive.writestr('base/assets/duplicate', b'one')
                    archive.writestr('base/assets/duplicate', b'two')
            with self.assertRaises(release.ReleaseError):
                release.strip_jar_signatures(source, target)
            self.assertFalse(target.exists())

    def test_output_cannot_overwrite_source_or_existing_file(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / 'source.aab'
            with ZipFile(source, 'w') as archive:
                archive.writestr('base/assets/a', b'a')
            with self.assertRaises(release.ReleaseError):
                release.strip_jar_signatures(source, source)
            target = Path(directory) / 'existing.aab'
            target.write_bytes(b'preserve')
            with self.assertRaises(release.ReleaseError):
                release.strip_jar_signatures(source, target)
            self.assertEqual(target.read_bytes(), b'preserve')

    def test_manifest_reads_android_namespaces_and_sdk_values(self):
        android = 'http://schemas.android.com/apk/res/android'
        sdk = xml_element('uses-sdk', [(android, 'minSdkVersion', '26'), (android, 'targetSdkVersion', '36')])
        permission = xml_element('uses-permission', [(android, 'name', 'android.permission.INTERNET')])
        application = xml_element('application', [(android, 'debuggable', 'false')])
        encoded = xml_element('manifest', [('', 'package', 'com.hebi96.pushOffice_app'), (android, 'versionCode', '3'), (android, 'versionName', '1.1.0')], [sdk, permission, application])
        manifest = release.parse_manifest(encoded)
        self.assertEqual(manifest, {'package': 'com.hebi96.pushOffice_app', 'version_code': '3', 'version_name': '1.1.0', 'min_sdk': '26', 'target_sdk': '36', 'debuggable': False, 'permissions': ['android.permission.INTERNET']})

    def test_truncated_manifest_fails_closed(self):
        for data in (b'\x0a\xff', b'\x0a\x02a', b'not protobuf'):
            with self.subTest(data=data):
                with self.assertRaises(release.ReleaseError):
                    release.parse_manifest(data)

    def test_release_metadata_rejects_wrong_version_debuggable_and_blocked_permission(self):
        valid = {'package': 'com.hebi96.pushOffice_app', 'version_code': '3', 'version_name': '1.1.0', 'min_sdk': '26', 'target_sdk': '36', 'debuggable': False, 'permissions': []}
        config = {'expo': {'version': '1.1.0', 'android': {'package': 'com.hebi96.pushOffice_app', 'versionCode': 3, 'blockedPermissions': ['android.permission.CAMERA']}}}
        release.validate_metadata(valid, config)
        for changed in ({'version_code': '1'}, {'debuggable': True}, {'permissions': ['android.permission.CAMERA']}, {'min_sdk': '23'}, {'package': 'wrong.app'}):
            with self.subTest(changed=changed):
                with self.assertRaises(release.ReleaseError):
                    release.validate_metadata({**valid, **changed}, config)

    def test_version_cannot_inject_an_output_path_or_github_output(self):
        for version in ('../escape', '1.0\nmode=signed', ''):
            with self.subTest(version=version):
                with self.assertRaises(release.ReleaseError):
                    release.artifact_name({'version': version, 'android': {'versionCode': 3}}, 'unsigned')
        self.assertEqual(release.artifact_name({'version': '1.1.0', 'android': {'versionCode': 3}}, 'unsigned'), 'PushOffice-v1.1.0-code3-unsigned.aab')

    def test_elf_check_rejects_4kb_load_alignment(self):
        def elf(alignment):
            identification = b'\x7fELF\x02\x01\x01' + b'\x00' * 9
            header = struct.pack('<HHIQQQIHHHHHH', 3, 183, 1, 0, 64, 0, 0, 64, 56, 1, 0, 0, 0)
            segment = struct.pack('<IIQQQQQQ', 1, 5, 0, 0, 0, 120, 120, alignment)
            return identification + header + segment
        release.validate_elf_16kb(elf(16384))
        with self.assertRaises(release.ReleaseError):
            release.validate_elf_16kb(elf(4096))

    def test_unsigned_entry_warning_is_not_accepted_as_a_verified_signature(self):
        release.validate_jarsigner_result(0, 'jar verified.\nWarning: signer is self-signed.')
        for output in ('jar is unsigned.', 'jar verified.\nThis jar contains unsigned entries which have not been integrity-checked.'):
            with self.subTest(output=output):
                with self.assertRaises(release.ReleaseError):
                    release.validate_jarsigner_result(0, output)


if __name__ == '__main__':
    unittest.main()
