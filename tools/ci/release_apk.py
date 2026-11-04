#!/usr/bin/env python3
"""Sign and verify a portable three-ABI APK with the existing upload key."""

import argparse
import base64
import binascii
import json
import os
from pathlib import Path
import re
import shutil
import struct
import sys
import tempfile
from zipfile import BadZipFile, ZipFile

import release_aab as shared
from release_aab import ReleaseError, checked_run, jdk_tool, require, sha256

UPLOAD_CERTIFICATE_SHA256 = '7704A1A8A8927701A6F86FE5100C633A0DE5A038D41AA7C65C8A56150DF55845'


def require_signing(environment):
    require(shared.signing_mode(environment) == 'signed',
            'APK release requires all five existing signing settings.')
    require(shared.normalize_fingerprint(environment['PUSH_OFFICE_UPLOAD_CERT_SHA256'])
            == UPLOAD_CERTIFICATE_SHA256,
            'APK signing configuration does not select the approved upload certificate.')


def executable(directory, name):
    path = Path(directory) / name
    require(path.is_file() and os.access(path, os.X_OK),
            'Required Android build tooling is unavailable.')
    return str(path)


def parse_badging(description):
    packages = re.findall(r"^package: name='([^']+)' versionCode='([0-9]+)' versionName='([^']+)'", description, re.M)
    minimum = re.findall(r"^(?:minSdkVersion|sdkVersion):'([0-9]+)'$", description, re.M)
    target = re.findall(r"^targetSdkVersion:'([0-9]+)'$", description, re.M)
    native = re.findall(r'^native-code:\s*([^\r\n]*)$', description, re.M)
    require(len(packages) == len(minimum) == len(target) == len(native) == 1,
            'APK package, SDK, or ABI metadata is missing or ambiguous.')
    require(not re.search(r'^application-debuggable(?:\s|:|$)', description, re.M),
            'Release APK must not be debuggable.')
    require(bool(re.fullmatch(r"(?:'[^'\s]+'\s*)+", native[0])), 'APK ABI metadata is malformed.')
    package, code, version = packages[0]
    return {
        'package': package, 'version_code': code, 'version_name': version,
        'min_sdk': minimum[0], 'target_sdk': target[0], 'debuggable': False,
        'abis': sorted(re.findall(r"'([^']+)'", native[0])),
        'permissions': sorted(set(re.findall(r"^uses-permission(?:-sdk-\d+)?: name='([^']+)'", description, re.M))),
    }


def validate_metadata(manifest, config):
    shared.validate_metadata(manifest, config)
    require(set(manifest['abis']) == shared.ABIS and len(manifest['abis']) == 3,
            'APK must contain exactly the three supported Android ABIs.')


def verify_payload(path, build_tools, config, environment):
    description = checked_run(
        [executable(build_tools, 'aapt2'), 'dump', 'badging', str(path)],
        'APK metadata inspection', env=environment,
    ).decode('utf-8', 'strict')
    manifest = parse_badging(description)
    validate_metadata(manifest, config)
    counts, checked_64bit = {}, 0
    with ZipFile(path) as archive:
        names = archive.namelist()
        require(names and len(set(names)) == len(names) and archive.testzip() is None,
                'APK ZIP integrity verification failed.')
        require({'AndroidManifest.xml', 'classes.dex', 'resources.arsc'} <= set(names),
                'Required APK payload entries are missing.')
        for name in names:
            match = re.fullmatch(r'lib/([^/]+)/[^/]+\.so', name)
            if match:
                abi = match[1]
                counts[abi] = counts.get(abi, 0) + 1
                if abi in {'arm64-v8a', 'x86_64'}:
                    shared.validate_elf_16kb(archive.read(name))
                    checked_64bit += 1
    require(set(counts) == shared.ABIS, 'APK native libraries do not match the supported ABIs.')
    return {'manifest': manifest, 'abi_library_counts': counts,
            'elf_64bit_libraries_checked': checked_64bit, 'elf_16kb_verified': True}


def compare_payloads(source, destination):
    with ZipFile(source) as original, ZipFile(destination) as signed:
        original_names, signed_names = original.namelist(), signed.namelist()
        require(len(original_names) == len(set(original_names))
                and len(signed_names) == len(set(signed_names)),
                'APK payload comparison rejected duplicate ZIP entries.')
        retained = {name for name in original_names if not shared.is_jar_signature(name)}
        current = {name for name in signed_names if not shared.is_jar_signature(name)}
        require(retained == current, 'APK signing changed the payload entry names.')
        require(all(sha256(original.read(name)) == sha256(signed.read(name)) for name in retained),
                'APK signing changed a non-signature payload.')


def validate_signature_description(description):
    signers = re.findall(r'^Number of signers:\s*(\d+)\s*$', description, re.M)
    certificates = re.findall(r'^Signer #(\d+) certificate SHA-256 digest:\s*([0-9a-fA-F]{64})\s*$', description, re.M)
    require(signers == ['1'] and len(certificates) == 1 and certificates[0][0] == '1',
            'Signed APK must have exactly one certificate signer.')
    shared.validate_certificate_identity(description, '', certificates[0][1], UPLOAD_CERTIFICATE_SHA256)
    require(bool(re.search(r'^Verified using v2 scheme .*:\s*true\s*$', description, re.M)),
            'APK Signature Scheme v2 verification did not succeed.')


def sign_apk(source, destination, build_tools, environment, temporary):
    require_signing(environment)
    try:
        encoded = ''.join(environment['PUSH_OFFICE_KEYSTORE_BASE64'].split())
        key_bytes = base64.b64decode(encoded, validate=True)
    except (ValueError, binascii.Error) as error:
        raise ReleaseError('Keystore base64 is malformed.') from error
    require(0 < len(key_bytes) <= 10 * 1024 * 1024, 'Keystore data is empty or exceeds the allowed size.')
    key_path = Path(temporary) / 'existing-upload-keystore'
    descriptor = os.open(key_path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, 'wb') as stream:
        stream.write(key_bytes)
    alias = environment['PUSH_OFFICE_KEY_ALIAS']
    keytool = [jdk_tool('keytool'), '-J-Duser.language=en', '-J-Duser.country=US']
    certificate = checked_run(
        [*keytool, '-exportcert', '-keystore', str(key_path), '-alias', alias,
         '-storepass:env', 'PUSH_OFFICE_KEYSTORE_PASSWORD'],
        'Upload certificate export', env=environment,
    )
    fingerprint = sha256(certificate).upper()
    require(fingerprint == UPLOAD_CERTIFICATE_SHA256,
            'Keystore certificate does not match the approved upload certificate.')
    description = checked_run([*keytool, '-printcert'], 'Upload certificate inspection',
                              input=certificate, env=environment).decode('utf-8', 'replace')
    shared.validate_certificate_identity(description, alias, fingerprint, UPLOAD_CERTIFICATE_SHA256)
    aligned = Path(temporary) / 'aligned-unsigned.apk'
    checked_run([executable(build_tools, 'zipalign'), '-P', '16', '-f', '4', str(source), str(aligned)],
                'APK ZIP preparation', env=environment)
    checked_run(
        [executable(build_tools, 'apksigner'), 'sign', '--ks', str(key_path), '--ks-key-alias', alias,
         '--ks-pass', 'env:PUSH_OFFICE_KEYSTORE_PASSWORD', '--key-pass', 'env:PUSH_OFFICE_KEY_PASSWORD',
         '--debuggable-apk-permitted', 'false', '--v4-signing-enabled', 'false',
         '--v2-signing-enabled', 'true', '--lib-page-alignment', '16384',
         '--out', str(destination), str(aligned)],
        'APK release signing', env=environment,
    )
    verification = checked_run(
        [executable(build_tools, 'apksigner'), 'verify', '--verbose', '--print-certs', str(destination)],
        'APK signature verification', env=environment,
    )
    validate_signature_description(verification.decode('utf-8', 'replace'))
    checked_run([executable(build_tools, 'zipalign'), '-c', '-P', '16', '4', str(destination)],
                'APK ZIP 16KB alignment verification', env=environment)


def finalize(source, output_directory, config, environment, build_tools, source_commit=None):
    require_signing(environment)
    name = shared.artifact_name(config['expo'], 'signed').removesuffix('.aab') + '.apk'
    source = Path(source).resolve()
    output_directory = Path(output_directory).resolve()
    require(source.is_file(), 'Source APK is unavailable.')
    require('\n' not in str(output_directory) and '\r' not in str(output_directory), 'Artifact directory is invalid.')
    if source_commit is not None:
        require(bool(re.fullmatch(r'(?:[0-9a-fA-F]{40}|[0-9a-fA-F]{64})', source_commit)),
                'Source commit must be a full Git revision hash.')
    destination = output_directory / name
    report = destination.with_suffix('.verification.json')
    checksum = destination.with_suffix('.apk.sha256')
    require(all(not os.path.lexists(path) for path in (destination, report, checksum)),
            'APK artifact or report already exists; use a clean output directory.')
    source_hash = sha256(source.read_bytes())
    with tempfile.TemporaryDirectory(prefix='push-office-apk-', dir=environment.get('RUNNER_TEMP') or None) as directory:
        temporary = Path(directory)
        payload = verify_payload(source, build_tools, config, environment)
        candidate = temporary / name
        sign_apk(source, candidate, build_tools, environment, temporary)
        signed_payload = verify_payload(candidate, build_tools, config, environment)
        require(signed_payload == payload, 'APK metadata or native verification changed after signing.')
        compare_payloads(source, candidate)
        require(sha256(source.read_bytes()) == source_hash, 'Source APK changed during finalization.')
        proof = {
            'mode': 'signed', 'filename': name, 'sha256': sha256(candidate.read_bytes()),
            'size_bytes': candidate.stat().st_size, 'source_apk_sha256': source_hash,
            'signature_verified': True, 'single_signer': True, 'signing_pending': False,
            'signing_certificate_sha256': UPLOAD_CERTIFICATE_SHA256,
            'zip_16kb_alignment_verified': True, 'all_non_signature_payloads_unchanged': True,
            'can_update_play_installation': False, 'play_upload_performed': False,
            'installation_note': 'Signed with the upload key; cannot update a Play-installed copy.',
            **signed_payload,
        }
        if source_commit is not None:
            proof['source_commit'] = source_commit
        output_directory.mkdir(parents=True, exist_ok=True)
        with destination.open('xb') as stream, candidate.open('rb') as artifact:
            shutil.copyfileobj(artifact, stream)
        with report.open('x', encoding='utf-8') as stream:
            stream.write(json.dumps(proof, indent=2) + '\n')
        with checksum.open('x', encoding='utf-8') as stream:
            stream.write(proof['sha256'] + '  ' + name + '\n')
    if environment.get('GITHUB_OUTPUT'):
        with Path(environment['GITHUB_OUTPUT']).open('a', encoding='utf-8') as stream:
            stream.write(f'apk_path={destination}\napk_report_path={report}\n')
    return proof


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--output-directory', type=Path, required=True)
    parser.add_argument('--app-config', type=Path, default=Path('app.json'))
    parser.add_argument('--source-commit')
    parser.add_argument('--build-tools', type=Path,
                        default=Path(os.environ.get('ANDROID_HOME', '/nonexistent')) / 'build-tools' / '36.0.0')
    arguments = parser.parse_args()
    try:
        config = json.loads(arguments.app_config.read_text(encoding='utf-8'))
        proof = finalize(arguments.source, arguments.output_directory, config, dict(os.environ),
                         arguments.build_tools, arguments.source_commit)
        print(f'Verified signed APK: {proof["filename"]}. It cannot update a Play-installed copy.')
        return 0
    except ReleaseError as error:
        print(f'::error::APK release preparation failed: {error}', file=sys.stderr)
    except (OSError, BadZipFile, struct.error, KeyError, TypeError, ValueError):
        print('::error::APK release preparation failed; invalid input or unavailable build tooling. Details suppressed.',
              file=sys.stderr)
    return 1


if __name__ == '__main__':
    sys.exit(main())
