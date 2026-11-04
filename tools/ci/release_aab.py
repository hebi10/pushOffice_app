#!/usr/bin/env python3
"""Prepare and verify an Android bundle without Expo EAS or Play API access."""

import argparse
import base64
import binascii
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import struct
import subprocess
import sys
import tempfile
from zipfile import BadZipFile, ZipFile

SECRETS = (
    'PUSH_OFFICE_KEYSTORE_BASE64', 'PUSH_OFFICE_KEYSTORE_PASSWORD',
    'PUSH_OFFICE_KEY_ALIAS', 'PUSH_OFFICE_KEY_PASSWORD',
    'PUSH_OFFICE_UPLOAD_CERT_SHA256',
)
ANDROID = 'http://schemas.android.com/apk/res/android'
PACKAGE = 'com.hebi96.pushOffice_app'
ABIS = {'arm64-v8a', 'armeabi-v7a', 'x86_64'}
BLOCKED_PERMISSIONS = {
    'android.permission.CAMERA', 'android.permission.READ_EXTERNAL_STORAGE',
    'android.permission.WRITE_EXTERNAL_STORAGE', 'android.permission.SYSTEM_ALERT_WINDOW',
}


class ReleaseError(Exception):
    """A safe, public error message, without subprocess output or secret values."""


def require(condition, message):
    if not condition:
        raise ReleaseError(message)


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def signing_mode(environment):
    present = [bool(environment.get(name)) for name in SECRETS]
    require(not any(present) or all(present),
            'Signing configuration is incomplete; provide all five secrets or leave all unset.')
    return 'signed' if all(present) else 'unsigned'


def normalize_fingerprint(value):
    normalized = re.sub(r'[:\s]', '', value).upper()
    require(bool(re.fullmatch(r'[0-9A-F]{64}', normalized)), 'Upload certificate SHA-256 is malformed.')
    return normalized


def validate_certificate_identity(description, alias, actual, expected):
    require(alias.strip().lower() != 'androiddebugkey'
            and not re.search(r'\bCN\s*=\s*"?Android\s+Debug\b', description, re.I),
            'An Android Debug certificate cannot be used for a signed release.')
    require(normalize_fingerprint(actual) == normalize_fingerprint(expected),
            'Keystore certificate does not match the configured existing upload certificate.')


def validate_signed_certificate_description(description, alias, expected):
    signers = re.findall(r'^Signer #\d+:', description, re.M)
    require(len(signers) == 1, 'Signed bundle must have exactly one signer.')
    fingerprints = re.findall(r'SHA256:\s*([0-9A-Fa-f:]+)', description)
    require(bool(fingerprints), 'Signed bundle leaf certificate is missing.')
    # keytool prints each signer's leaf as Certificate #1, followed by its CA chain.
    validate_certificate_identity(description, alias, fingerprints[0], expected)


def is_jar_signature(name):
    return name.upper() == 'META-INF/MANIFEST.MF' or bool(
        re.fullmatch(r'META-INF/[^/]+\.(SF|RSA|DSA|EC)', name, re.I))


def strip_jar_signatures(source, destination):
    """Keep raw local records and central metadata; relocate only ZIP offsets."""
    source, destination = Path(source), Path(destination)
    require(source.resolve() != destination.resolve() and not destination.exists(),
            'Bundle output must be a new file, separate from the source.')
    data = source.read_bytes()
    with ZipFile(source) as archive:
        infos, central_start, comment = archive.infolist(), archive.start_dir, archive.comment
        require(bool(infos) and len({item.filename for item in infos}) == len(infos),
                'Bundle ZIP is empty or contains duplicate entry names.')
        require(len(infos) < 65535 and len(data) < 0xffffffff
                and all(max(item.file_size, item.compress_size, item.header_offset) < 0xffffffff for item in infos),
                'ZIP64 bundles are unsupported by the signing preparation step.')
        ordered = sorted(infos, key=lambda item: item.header_offset)
        require(ordered[0].header_offset == 0, 'Unexpected bundle ZIP prefix.')
        ends = {item.header_offset: (ordered[index + 1].header_offset if index + 1 < len(ordered) else central_start)
                for index, item in enumerate(ordered)}
        output, relocated = bytearray(), {}
        for item in ordered:
            require(data[item.header_offset:item.header_offset + 4] == b'PK\x03\x04', 'Invalid local ZIP record.')
            if not is_jar_signature(item.filename):
                relocated[item.header_offset] = len(output)
                output.extend(data[item.header_offset:ends[item.header_offset]])
        new_central_start, cursor = len(output), central_start
        for item in infos:
            require(data[cursor:cursor + 4] == b'PK\x01\x02', 'Invalid central ZIP record.')
            name_size, extra_size, comment_size = struct.unpack_from('<HHH', data, cursor + 28)
            record_size = 46 + name_size + extra_size + comment_size
            record = bytearray(data[cursor:cursor + record_size])
            require(struct.unpack_from('<I', record, 42)[0] == item.header_offset, 'Invalid ZIP entry offset.')
            if not is_jar_signature(item.filename):
                struct.pack_into('<I', record, 42, relocated[item.header_offset])
                output.extend(record)
            cursor += record_size
        require(data[cursor:cursor + 4] == b'PK\x05\x06', 'Unsupported ZIP trailer.')
        signature, disk, central_disk, disk_count, count, central_size, old_start, comment_size = struct.unpack_from('<4s4H2IH', data, cursor)
        require(disk == central_disk == 0 and disk_count == count == len(infos)
                and old_start == central_start and central_size == cursor - central_start
                and comment_size == len(comment) and data[cursor + 22:] == comment, 'Unsupported ZIP layout.')
        output.extend(struct.pack('<4s4H2IH', signature, 0, 0, len(relocated), len(relocated),
                                  len(output) - new_central_start, new_central_start, len(comment)))
        output.extend(comment)
        destination.parent.mkdir(parents=True, exist_ok=True)
        with destination.open('xb') as stream:
            stream.write(output)
        fields = ('filename', 'orig_filename', 'date_time', 'compress_type', 'comment', 'extra',
                  'create_system', 'create_version', 'extract_version', 'reserved', 'flag_bits',
                  'volume', 'internal_attr', 'external_attr', 'CRC', 'compress_size', 'file_size')
        retained = [item for item in infos if not is_jar_signature(item.filename)]
        with ZipFile(destination) as copied:
            require([item.filename for item in retained] == copied.namelist() and copied.testzip() is None,
                    'Prepared ZIP failed integrity verification.')
            for original, current in zip(retained, copied.infolist()):
                require(all(getattr(original, field) == getattr(current, field) for field in fields)
                        and sha256(archive.read(original)) == sha256(copied.read(current)),
                        'Prepared bundle changed a retained entry or its ZIP metadata.')
                original_record = data[original.header_offset:ends[original.header_offset]]
                require(original_record == output[current.header_offset:current.header_offset + len(original_record)],
                        'Prepared bundle changed a retained raw ZIP record.')
    require(sha256(source.read_bytes()) == sha256(data), 'Source bundle changed during preparation.')
    return {'removed_entries': [item.filename for item in infos if is_jar_signature(item.filename)],
            'retained_entries': len(retained), 'payloads_and_metadata_preserved': True,
            'raw_local_records_preserved': True, 'source_unchanged': True}


def _varint(data, position):
    value = 0
    for shift in range(0, 70, 7):
        require(position < len(data), 'Truncated protobuf manifest.')
        byte = data[position]
        position += 1
        value |= (byte & 127) << shift
        if not byte & 128:
            return value, position
    raise ReleaseError('Invalid protobuf manifest varint.')


def _fields(data):
    position = 0
    while position < len(data):
        tag, position = _varint(data, position)
        number, wire = tag >> 3, tag & 7
        require(number > 0, 'Invalid protobuf manifest field.')
        if wire == 0:
            value, position = _varint(data, position)
        else:
            require(wire in (1, 2, 5), 'Unsupported protobuf manifest field.')
            if wire == 2:
                size, position = _varint(data, position)
            else:
                size = 8 if wire == 1 else 4
            require(position + size <= len(data), 'Truncated protobuf manifest field.')
            value, position = data[position:position + size], position + size
        yield number, wire, value


def _element(node, depth=0):
    require(depth < 100, 'Manifest XML nesting is excessive.')
    elements = [value for number, wire, value in _fields(node) if number == 1 and wire == 2]
    if not elements:
        return None  # XmlNode text / whitespace.
    require(len(elements) == 1, 'Invalid manifest XML node.')
    name, attributes, children = None, {}, []
    for number, wire, value in _fields(elements[0]):
        if wire != 2:
            continue
        if number == 3:
            name = value.decode('utf-8')
        elif number == 4:
            parts = {key: item.decode('utf-8') for key, kind, item in _fields(value) if kind == 2 and key in (1, 2, 3)}
            key = (parts.get(1, ''), parts.get(2))
            require(key[1] is not None and key not in attributes, 'Duplicate or unnamed manifest attribute.')
            attributes[key] = parts.get(3)
        elif number == 5:
            child = _element(value, depth + 1)
            if child is not None:
                children.append(child)
    require(name is not None, 'Unnamed manifest XML element.')
    return name, attributes, children


def parse_manifest(data):
    try:
        root = _element(data)
        require(root is not None and root[0] == 'manifest', 'Bundle manifest root is missing.')
        _, attributes, children = root
        sdks = [child for child in children if child[0] == 'uses-sdk']
        applications = [child for child in children if child[0] == 'application']
        require(len(sdks) == len(applications) == 1, 'Bundle manifest SDK or application is missing.')
        debuggable = applications[0][1].get((ANDROID, 'debuggable'), 'false')
        require(debuggable in ('true', 'false'), 'Invalid debuggable manifest value.')
        return {'package': attributes.get(('', 'package')),
                'version_code': attributes.get((ANDROID, 'versionCode')),
                'version_name': attributes.get((ANDROID, 'versionName')),
                'min_sdk': sdks[0][1].get((ANDROID, 'minSdkVersion')),
                'target_sdk': sdks[0][1].get((ANDROID, 'targetSdkVersion')),
                'debuggable': debuggable == 'true',
                'permissions': sorted({child[1].get((ANDROID, 'name')) for child in children
                                       if child[0] in ('uses-permission', 'uses-permission-sdk-23')
                                       and child[1].get((ANDROID, 'name'))})}
    except (UnicodeDecodeError, TypeError, ValueError, IndexError) as error:
        raise ReleaseError('Bundle protobuf manifest is malformed.') from error


def artifact_name(expo, mode):
    version, code = expo.get('version'), expo.get('android', {}).get('versionCode')
    require(isinstance(version, str) and bool(re.fullmatch(r'[0-9A-Za-z][0-9A-Za-z.+_-]{0,63}', version)),
            'App version is unsafe for an artifact filename.')
    require(type(code) is int and 0 < code <= 2100000000 and mode in ('signed', 'unsigned'),
            'App versionCode or signing mode is invalid.')
    return f'PushOffice-v{version}-code{code}-{mode}.aab'


def validate_metadata(manifest, config):
    expo = config['expo']
    artifact_name(expo, 'unsigned')
    require(expo['android']['package'] == PACKAGE and manifest['package'] == PACKAGE,
            'Bundle package does not match the existing Play app.')
    require(manifest['version_name'] == expo['version']
            and manifest['version_code'] == str(expo['android']['versionCode']),
            'Bundle version does not match app.json.')
    require(manifest['min_sdk'] == '26' and manifest['target_sdk'] == '36', 'Unexpected bundle SDK levels.')
    require(manifest['debuggable'] is False, 'Release bundle must not be debuggable.')
    blocked = BLOCKED_PERMISSIONS | set(expo['android'].get('blockedPermissions', []))
    require(not blocked.intersection(manifest['permissions']), 'Bundle contains a blocked Android permission.')


def validate_elf_16kb(data):
    require(len(data) >= 64 and data[:4] == b'\x7fELF' and data[4] == 2 and data[5] in (1, 2),
            'A 64-bit native library is not a valid ELF64 file.')
    order = '<' if data[5] == 1 else '>'
    header = struct.unpack_from(order + 'HHIQQQIHHHHHH', data, 16)
    offset, size, count = header[4], header[8], header[9]
    require(size >= 56 and count > 0 and offset + size * count <= len(data), 'Invalid ELF program-header table.')
    loads = [struct.unpack_from(order + 'IIQQQQQQ', data, offset + index * size) for index in range(count)]
    loads = [segment for segment in loads if segment[0] == 1]
    require(bool(loads) and all(segment[7] >= 16384 and segment[2] % 16384 == segment[3] % 16384 for segment in loads),
            'A 64-bit native library does not support 16 KB pages.')
    return len(loads)


def verify_payload(path, config):
    with ZipFile(path) as archive:
        names = archive.namelist()
        require(len(names) == len(set(names)) and archive.testzip() is None, 'Bundle ZIP integrity check failed.')
        require({'BundleConfig.pb', 'base/manifest/AndroidManifest.xml', 'base/dex/classes.dex', 'base/resources.pb'} <= set(names),
                'Required Android App Bundle entries are missing.')
        manifest = parse_manifest(archive.read('base/manifest/AndroidManifest.xml'))
        validate_metadata(manifest, config)
        counts = {}
        checked_64bit = 0
        for name in names:
            match = re.fullmatch(r'base/lib/([^/]+)/[^/]+\.so', name)
            if match:
                abi = match[1]
                counts[abi] = counts.get(abi, 0) + 1
                if abi in ('arm64-v8a', 'x86_64'):
                    validate_elf_16kb(archive.read(name))
                    checked_64bit += 1
        require(set(counts) == ABIS, 'Bundle does not contain the expected Android ABIs.')
        return {'manifest': manifest, 'abi_library_counts': counts,
                'elf_64bit_libraries_checked': checked_64bit, 'elf_16kb_verified': True}


def jdk_tool(name):
    configured = Path(os.environ.get('JAVA_HOME', '/nonexistent')) / 'bin' / name
    executable = str(configured) if configured.is_file() else shutil.which(name)
    require(bool(executable), f'Required JDK tool is unavailable: {name}.')
    return executable


def checked_run(arguments, label, **kwargs):
    result = subprocess.run(arguments, capture_output=True, **kwargs)
    require(result.returncode == 0, f'{label} failed; command output is suppressed to protect signing values.')
    return result.stdout


def validate_with_bundletool(path, gradle_home):
    """Use the bundletool and dependencies already resolved by the Gradle build."""
    modules = Path(gradle_home) / 'caches/modules-2/files-2.1'
    selected = {}
    for jar in modules.glob('*/*/*/*/*.jar'):
        key = (jar.parents[3].name, jar.parents[2].name)
        rank = (tuple(int(part) for part in re.findall(r'\d+', jar.parents[1].name)), jar.name)
        if key not in selected or rank > selected[key][0]:
            selected[key] = (rank, jar)
    main = selected.pop(('com.android.tools.build', 'bundletool'), None)
    require(main is not None, 'Gradle did not cache bundletool; run bundleRelease before verification.')
    classpath = os.pathsep.join(str(jar) for jar in [main[1], *(value[1] for value in selected.values())])
    checked_run([jdk_tool('java'), '-Xmx512m', '-cp', classpath,
                 'com.android.tools.build.bundletool.BundleToolMain', 'validate', '--bundle=' + str(path)],
                'Bundletool validation')


def validate_jarsigner_result(code, output):
    require(code == 0 and 'jar verified.' in output.lower()
            and not re.search(r'unsigned entr(?:y|ies)|not integrity.checked', output, re.I),
            'Bundle signature verification failed or contains unsigned entries.')


def verify_unsigned(path):
    with ZipFile(path) as archive:
        require(not any(is_jar_signature(name) for name in archive.namelist()), 'Unsigned artifact still contains JAR signing metadata.')
    output = checked_run([jdk_tool('jarsigner'), '-J-Duser.language=en', '-J-Duser.country=US', '-verify', str(path)],
                         'Unsigned bundle verification')
    require(b'jar is unsigned.' in output.lower(), 'Jarsigner did not confirm an unsigned artifact.')


def sign_bundle(source, destination, environment, temporary):
    expected = normalize_fingerprint(environment['PUSH_OFFICE_UPLOAD_CERT_SHA256'])
    try:
        encoded = ''.join(environment['PUSH_OFFICE_KEYSTORE_BASE64'].split())
        key_bytes = base64.b64decode(encoded, validate=True)
    except (ValueError, binascii.Error) as error:
        raise ReleaseError('Keystore base64 is malformed.') from error
    require(0 < len(key_bytes) <= 10 * 1024 * 1024, 'Keystore data is empty or exceeds the allowed size.')
    key_path = temporary / 'existing-upload-keystore'
    descriptor = os.open(key_path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, 'wb') as stream:
        stream.write(key_bytes)
    alias = environment['PUSH_OFFICE_KEY_ALIAS']
    keytool = [jdk_tool('keytool'), '-J-Duser.language=en', '-J-Duser.country=US']
    certificate = checked_run([*keytool, '-exportcert', '-keystore', str(key_path), '-alias', alias,
                               '-storepass:env', 'PUSH_OFFICE_KEYSTORE_PASSWORD'], 'Upload certificate export', env=environment)
    description = checked_run([*keytool, '-printcert'], 'Upload certificate inspection', input=certificate, env=environment).decode('utf-8', 'replace')
    validate_certificate_identity(description, alias, sha256(certificate), expected)
    checked_run([jdk_tool('jarsigner'), '-J-Duser.language=en', '-J-Duser.country=US',
                 '-keystore', str(key_path), '-storepass:env', 'PUSH_OFFICE_KEYSTORE_PASSWORD',
                 '-keypass:env', 'PUSH_OFFICE_KEY_PASSWORD', '-digestalg', 'SHA-256',
                 '-signedjar', str(destination), str(source), alias], 'Release signing', env=environment)
    verification = subprocess.run([jdk_tool('jarsigner'), '-J-Duser.language=en', '-J-Duser.country=US',
                                    '-verify', '-verbose', str(destination)], capture_output=True, text=True)
    validate_jarsigner_result(verification.returncode, verification.stdout + verification.stderr)
    signed_description = checked_run([*keytool, '-printcert', '-jarfile', str(destination)], 'Signed bundle certificate inspection').decode('utf-8', 'replace')
    validate_signed_certificate_description(signed_description, alias, expected)


def provenance(mode, environment):
    revision = environment.get('GITHUB_SHA') or None
    require(revision is None or bool(re.fullmatch(r'[0-9a-f]{40}', revision)), 'Source commit is malformed.')
    return {'source_commit': revision,
            'signer_certificate_sha256': normalize_fingerprint(environment['PUSH_OFFICE_UPLOAD_CERT_SHA256']) if mode == 'signed' else None}


def finalize(source, output_directory, config, environment, gradle_home):
    mode = signing_mode(environment)
    name = artifact_name(config['expo'], mode)
    output_directory = Path(output_directory).resolve()
    require('\n' not in str(output_directory) and '\r' not in str(output_directory), 'Artifact directory is invalid.')
    destination = output_directory / name
    require(not destination.exists(), 'Final artifact already exists; use a clean output directory.')
    with tempfile.TemporaryDirectory(prefix='push-office-release-', dir=environment.get('RUNNER_TEMP') or None) as directory:
        temporary = Path(directory)
        unsigned = temporary / 'candidate-unsigned.aab'
        preparation = strip_jar_signatures(source, unsigned)
        verify_unsigned(unsigned)
        payload = verify_payload(unsigned, config)
        validate_with_bundletool(unsigned, gradle_home)
        candidate = unsigned
        if mode == 'signed':
            candidate = temporary / 'candidate-signed.aab'
            sign_bundle(unsigned, candidate, environment, temporary)
            payload = verify_payload(candidate, config)
            validate_with_bundletool(candidate, gradle_home)
        output_directory.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(candidate, destination)
    proof = {'mode': mode, 'signature_verified': mode == 'signed',
             'signing_pending': mode == 'unsigned', 'play_upload_performed': False,
             'filename': name, 'sha256': sha256(destination.read_bytes()),
             'size_bytes': destination.stat().st_size,
             'preparation': preparation, 'bundletool_validated': True, **payload, **provenance(mode, environment)}
    report = destination.with_suffix('.verification.json')
    report.write_text(json.dumps(proof, indent=2) + '\n')
    destination.with_suffix('.aab.sha256').write_text(proof['sha256'] + '  ' + name + '\n')
    if environment.get('GITHUB_OUTPUT'):
        with Path(environment['GITHUB_OUTPUT']).open('a') as stream:
            stream.write(f'mode={mode}\nartifact_path={destination}\nreport_path={report}\n')
    if environment.get('GITHUB_STEP_SUMMARY'):
        with Path(environment['GITHUB_STEP_SUMMARY']).open('a') as stream:
            status = 'Upload certificate signature verified; Play upload not performed.' if mode == 'signed' else 'Unsigned preparation only. Signing is pending; do not upload to Play.'
            stream.write(f'### Android bundle: {mode}\n\n{status}\n\n`{name}`\n\nSHA-256: `{proof["sha256"]}`\n')
    return proof


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--output-directory', type=Path, required=True)
    parser.add_argument('--app-config', type=Path, default=Path('app.json'))
    parser.add_argument('--gradle-home', type=Path, default=Path(os.environ.get('GRADLE_USER_HOME', str(Path.home() / '.gradle'))))
    arguments = parser.parse_args()
    try:
        config = json.loads(arguments.app_config.read_text())
        proof = finalize(arguments.source, arguments.output_directory, config, dict(os.environ), arguments.gradle_home)
        print(f'Verified {proof["mode"]} artifact: {proof["filename"]}')
        if proof['signing_pending']:
            print('Signing is pending. This unsigned artifact must not be uploaded to Play.')
        return 0
    except ReleaseError as error:
        print(f'::error::Android release preparation failed: {error}', file=sys.stderr)
    except (OSError, BadZipFile, struct.error, KeyError, TypeError, ValueError):
        print('::error::Android release preparation failed; invalid input or unavailable build tooling. Details suppressed.', file=sys.stderr)
    return 1


if __name__ == '__main__':
    sys.exit(main())
