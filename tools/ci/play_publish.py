#!/usr/bin/env python3
"""Allocate Play version codes and publish verified bundles to existing test tracks."""

import argparse
from datetime import datetime, timezone
from http.client import HTTPException
import json
import os
from pathlib import Path
import re
import sys
from urllib.error import HTTPError, URLError
from urllib.parse import quote, unquote
from urllib.request import HTTPRedirectHandler, Request, build_opener
from zipfile import BadZipFile

import release_aab
from release_aab import ReleaseError, require

PACKAGE = release_aab.PACKAGE
UPLOAD_CERT_SHA256 = '7704A1A8A8927701A6F86FE5100C633A0DE5A038D41AA7C65C8A56150DF55845'
ROOT = 'https://androidpublisher.googleapis.com'
EDITS = f'/androidpublisher/v3/applications/{PACKAGE}/edits'
RESERVED_TRACKS = {'production', 'beta', 'qa', 'internal'}
NOTES = Path(__file__).resolve().parents[2] / 'store-assets/release-notes-ko-KR.txt'
UPLOAD_KEY_ACTIVE_AT = datetime(2026, 11, 6, 3, 32, tzinfo=timezone.utc)


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, request, *args, **kwargs):
        return None


class ApiError(ReleaseError):
    def __init__(self, status=None):
        self.status = status
        super().__init__(f'Google Play API request failed (HTTP {status}).' if status else
                         'Google Play API response could not be confirmed.')


class PlayClient:
    """One request per operation, with an injectable urllib-compatible transport."""

    def __init__(self, token, transport=None):
        require(isinstance(token, str) and bool(token) and token.isascii()
                and not any(character.isspace() or ord(character) < 33 for character in token),
                'PLAY_ACCESS_TOKEN must contain a valid nonempty access token.')
        self._token = token
        self._transport = transport or build_opener(NoRedirect()).open
        self._created_edits = set()

    def request(self, method, path, data=None):
        if path == EDITS:
            require(method == 'POST', 'Invalid Play edit creation request.')
        else:
            match = re.fullmatch(
                re.escape(EDITS) + r'/([A-Za-z0-9_-]+)'
                r'(?:/(?:tracks(?:/((?:[A-Za-z0-9._~-]|%[0-9A-F]{2})+))?|bundles|apks)'
                r'|:validate|:commit\?changesInReviewBehavior=ERROR_IF_IN_REVIEW)?', path)
            upload = re.fullmatch(re.escape('/upload' + EDITS)
                                  + r'/([A-Za-z0-9_-]+)/bundles\?uploadType=media', path)
            require(bool(match or upload), 'The API request is outside the authorized application.')
            if match and match.group(2) is not None:
                encoded = match.group(2)
                try:
                    track = unquote(encoded, errors='strict')
                except UnicodeError:
                    raise ReleaseError('The API track identifier encoding is invalid.') from None
                require(selectable_track_identifier(track) and quote(track, safe='') == encoded,
                        'The API track identifier must be one canonically encoded path segment.')
            edit_id = (match or upload).group(1)
            require(EDITS + '/' + edit_id in self._created_edits,
                    'The API request must use an edit created by this client.')
            require(not upload or method == 'POST', 'Invalid Play bundle upload request.')
        headers = {'Authorization': 'Bearer ' + self._token, 'Accept': 'application/json'}
        if data is not None:
            headers['Content-Type'] = 'application/octet-stream' if isinstance(data, bytes) else 'application/json'
            if not isinstance(data, bytes):
                data = json.dumps(data).encode('utf-8')
        try:
            request = Request(ROOT + path, data=data, headers=headers, method=method)
            with self._transport(request, timeout=180) as response:
                raw = response.read()
            result = json.loads(raw) if raw else {}
            if not isinstance(result, dict):
                raise ValueError()
            return result
        except HTTPError as error:
            raise ApiError(error.code) from None
        except (URLError, OSError, HTTPException, ValueError, UnicodeError):
            raise ApiError() from None

    def create_edit(self):
        edit_id = self.request('POST', EDITS, {}).get('id')
        require(isinstance(edit_id, str) and bool(re.fullmatch(r'[A-Za-z0-9_-]+', edit_id)),
                'Google Play returned an invalid edit identifier.')
        edit = EDITS + '/' + edit_id
        require(edit not in self._created_edits, 'Google Play returned a reused edit identifier.')
        self._created_edits.add(edit)
        return edit

    def delete_edit(self, edit):
        require(edit in self._created_edits, 'Only an edit created by this client may be deleted.')
        try:
            self.request('DELETE', edit)
        except ApiError:
            return False
        self._created_edits.remove(edit)
        return True


def version_code(value):
    require(type(value) is int or isinstance(value, str) and bool(re.fullmatch(r'[1-9][0-9]{0,9}', value)),
            'A Play version code is missing or invalid.')
    code = int(value)
    require(1 <= code <= 2100000000, 'A Play version code is outside the Android range.')
    return code


def objects(response, key):
    values = response.get(key, [])
    require(isinstance(values, list) and all(isinstance(value, dict) for value in values),
            'Google Play returned an invalid resource list.')
    return values


def track_identifier(value):
    return isinstance(value, str) and bool(value.strip()) and value.isprintable()


def selectable_track_identifier(value):
    return (track_identifier(value) and value not in {'.', '..'}
            and not any(character in value for character in '/\\:?#%'))


def validate_target(target, closed_track):
    require(target in {'internal', 'closed'}, 'Select internal or closed testing.')
    if target == 'internal':
        require(closed_track is None, 'A closed track may only be selected for closed testing.')
    else:
        require(selectable_track_identifier(closed_track)
                and closed_track.strip().casefold() not in RESERVED_TRACKS,
                'Closed testing requires an exact existing closed track; reserved and form-factor tracks are forbidden.')


def inventory(client, edit, target, closed_track, report):
    tracks = objects(client.request('GET', edit + '/tracks'), 'tracks')
    report['available_track_ids'] = [track['track'] for track in tracks if track_identifier(track.get('track'))]
    used, names, public = set(), set(), []
    for track in tracks:
        name = track.get('track')
        require(track_identifier(name) and name not in names,
                'Google Play returned an invalid or duplicate track identifier.')
        names.add(name)
        releases = []
        for release in objects(track, 'releases'):
            status = release.get('status')
            codes = release.get('versionCodes', [])
            require(status in {'draft', 'completed', 'halted', 'inProgress'} and isinstance(codes, list),
                    'Google Play returned invalid track releases.')
            codes = [version_code(code) for code in codes]
            require(len(codes) == len(set(codes)) and (bool(codes) or status == 'draft'),
                    'Google Play returned invalid release version codes.')
            used.update(codes)
            releases.append({'status': status, 'version_codes': codes})
        public.append({'track': name, 'releases': releases})
    for resource in ('bundles', 'apks'):
        for artifact in objects(client.request('GET', edit + '/' + resource), resource):
            used.add(version_code(artifact.get('versionCode')))
    report.update(tracks=public, used_version_codes=sorted(used))
    if target == 'internal':
        aliases = names.intersection({'qa', 'internal'})
        require(len(aliases) == 1, 'Exactly one existing internal API track (qa or internal) is required.')
        selected = next(iter(aliases))
    else:
        selected = closed_track
        require(selected in names, 'The exact closed track does not exist; track creation is disabled.')
    report['api_track'] = selected
    return next(track for track in public if track['track'] == selected), used


def start_report(report, mode, target):
    result = report if report is not None else {}
    result.update(package=PACKAGE, mode=mode, target=target, status='started',
                  api_accepted=False, play_approval='not_confirmed', track_verified=False)
    return result


def preflight(client, target, *, closed_track=None, app_config=Path('app.json'), report=None):
    report = start_report(report, 'preflight', target)
    validate_target(target, closed_track)
    try:
        config = json.loads(Path(app_config).read_text(encoding='utf-8'))
        require(config['expo']['android']['package'] == PACKAGE, 'app.json must select the existing Play package.')
        configured = version_code(config['expo']['android']['versionCode'])
    except (OSError, ValueError, KeyError, TypeError, UnicodeError):
        raise ReleaseError('app.json must contain the existing package and a valid Android versionCode.') from None
    edit = client.create_edit()
    try:
        _, used = inventory(client, edit, target, closed_track, report)
        next_code = max(configured, max(used, default=0) + 1)
        version_code(next_code)
        report.update(next_version_code=next_code, status='checked')
    finally:
        report['temporary_edit_deleted'] = client.delete_edit(edit)
        if not report['temporary_edit_deleted']:
            report['status'] = 'cleanup_failed'
            raise ReleaseError('The preflight edit could not be deleted. Check Play Console before continuing.')
    return report


def load_inputs(bundle, verification, notes, *, app_config, source_commit):
    try:
        bundle, verification, notes = Path(bundle), Path(verification), Path(notes)
        require(all(path.is_file() and not path.is_symlink() for path in (bundle, verification, notes))
                and bundle.parent.resolve() == verification.parent.resolve(),
                'The verified bundle and matching report must be regular files in the same directory.')
        proof = json.loads(verification.read_text(encoding='utf-8'))
        payload = bundle.read_bytes()
        require(isinstance(proof, dict) and proof.get('mode') == 'signed'
                and proof.get('signature_verified') is True and proof.get('signing_pending') is False
                and proof.get('signer_certificate_sha256') == UPLOAD_CERT_SHA256
                and isinstance(proof.get('source_commit'), str)
                and bool(re.fullmatch(r'[0-9a-f]{40}', proof['source_commit']))
                and proof.get('bundletool_validated') is True and proof.get('elf_16kb_verified') is True,
                'A signed bundle verified with the approved upload certificate and source commit is required.')
        require(bool(payload) and proof.get('filename') == bundle.name
                and proof.get('sha256') == release_aab.sha256(payload)
                and type(proof.get('size_bytes')) is int and proof['size_bytes'] == len(payload),
                'The bundle filename, SHA-256 or size does not match its verification report.')
        require(isinstance(source_commit, str) and bool(re.fullmatch(r'[0-9a-f]{40}', source_commit))
                and proof['source_commit'] == source_commit,
                'The verified bundle source commit does not match the current release checkout.')
        manifest = proof['manifest']
        code = version_code(manifest['version_code'])
        config = json.loads(Path(app_config).read_text(encoding='utf-8'))
        release_aab.validate_metadata(manifest, config)
        require(bundle.name == release_aab.artifact_name(config['expo'], 'signed')
                and verification.name == bundle.with_suffix('.verification.json').name,
                'The bundle or verification filename does not match its signed version.')
        preparation = proof.get('preparation')
        require(isinstance(preparation, dict)
                and all(preparation.get(key) is True for key in (
                    'payloads_and_metadata_preserved', 'raw_local_records_preserved', 'source_unchanged')),
                'Bundle preparation preservation checks are missing.')
        actual = release_aab.verify_payload(bundle, config)
        require(all(proof.get(key) == value for key, value in actual.items()),
                'The actual AAB manifest or native payload does not match its verification report.')
        text = notes.read_text(encoding='utf-8').strip()
        wrapped = re.fullmatch(r'<ko-KR>\s*(.*?)\s*</ko-KR>', text, re.S)
        if wrapped:
            text = wrapped.group(1).strip()
        require(bool(text) and len(text) <= 500 and '<' not in text and '>' not in text
                and not any(ord(character) < 32 and character not in '\n\t' for character in text),
                'Korean release notes must contain 1–500 plain text characters.')
        return proof, code, payload, text
    except (OSError, ValueError, KeyError, TypeError, AttributeError, UnicodeError, BadZipFile):
        raise ReleaseError('The signed AAB, matching verification report or Korean release notes are invalid.') from None


def publish(client, target, *, source_commit, app_config=Path('app.json'), closed_track=None,
            bundle=None, verification=None, notes=NOTES, report=None):
    report = start_report(report, 'publish', target)
    validate_target(target, closed_track)
    proof, code, payload, text = load_inputs(bundle, verification, notes,
                                           app_config=app_config, source_commit=source_commit)
    report.update(version_code=code, version_name=proof['manifest']['version_name'],
                  source_commit=proof['source_commit'], bundle_sha256=proof['sha256'])
    edit = client.create_edit()
    try:
        selected, used = inventory(client, edit, target, closed_track, report)
        require(code > max(used, default=0),
                'Bundle versionCode must exceed every current Play APK, bundle and track version; rebuild after an external upload.')
        require(all(release['status'] == 'completed'
                    or release['status'] == 'draft' and not release['version_codes']
                    for release in selected['releases']),
                'The target has a nonempty draft, halted or in-progress release; resolve it in Play Console.')
        uploaded = client.request('POST', '/upload' + edit + '/bundles?uploadType=media', payload)
        require(version_code(uploaded.get('versionCode')) == code and uploaded.get('sha256') == proof['sha256'],
                'The uploaded bundle version or SHA-256 differs from the verified artifact.')
        track = report['api_track']
        release = {'name': proof['manifest']['version_name'], 'versionCodes': [str(code)], 'status': 'completed',
                   'releaseNotes': [{'language': 'ko-KR', 'text': text}]}
        client.request('PUT', edit + '/tracks/' + quote(track, safe=''), {'track': track, 'releases': [release]})
        client.request('POST', edit + ':validate')
        try:
            client.request('POST', edit + ':commit?changesInReviewBehavior=ERROR_IF_IN_REVIEW')
        except ApiError as error:
            if error.status is None or error.status >= 500:
                edit = None
                report.update(status='commit_unknown', api_accepted=None)
                raise ReleaseError('Commit outcome is unknown. Check Play Console before any retry; the commit was not retried.') from None
            raise
        edit = None
        report.update(status='committed_unverified', api_accepted=True)
        verification_edit = client.create_edit()
        try:
            actual = client.request('GET', verification_edit + '/tracks/' + quote(track, safe=''))
            releases = objects(actual, 'releases')
            require(actual.get('track') == track and len(releases) == 1
                    and releases[0].get('status') == 'completed'
                    and releases[0].get('versionCodes') == [str(code)],
                    'Commit was accepted, but fresh track verification failed. Check Play Console; approval and tester availability are not confirmed.')
            report.update(status='committed', track_verified=True)
        finally:
            report['verification_edit_deleted'] = client.delete_edit(verification_edit)
            if not report['verification_edit_deleted']:
                report['status'] = 'committed_cleanup_failed'
                raise ReleaseError('Commit was accepted, but the verification edit could not be deleted. Check Play Console before retrying.')
    finally:
        if edit is not None:
            report['temporary_edit_deleted'] = client.delete_edit(edit)
            if not report['temporary_edit_deleted']:
                report['status'] = 'cleanup_failed'
                raise ReleaseError('The uncommitted publication edit could not be deleted. Check Play Console before retrying.')
    return report


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('mode', choices=('preflight', 'publish'))
    parser.add_argument('--target', choices=('internal', 'closed'), default='internal')
    parser.add_argument('--closed-track')
    parser.add_argument('--app-config', type=Path, default=Path('app.json'))
    parser.add_argument('--bundle', type=Path)
    parser.add_argument('--verification', type=Path)
    parser.add_argument('--report', type=Path, required=True)
    arguments = parser.parse_args(argv)
    report = start_report(None, arguments.mode, arguments.target)
    result = 1
    try:
        if arguments.mode == 'publish' and datetime.now(timezone.utc) < UPLOAD_KEY_ACTIVE_AT:
            report['status'] = 'deferred'
            raise ReleaseError('Play upload is deferred until the approved upload key becomes active at 2026-11-06T03:32:00Z.')
        client = PlayClient(os.environ.get('PLAY_ACCESS_TOKEN', ''))
        if arguments.mode == 'preflight':
            preflight(client, arguments.target, closed_track=arguments.closed_track,
                      app_config=arguments.app_config, report=report)
            if os.environ.get('GITHUB_OUTPUT'):
                with Path(os.environ['GITHUB_OUTPUT']).open('a', encoding='utf-8') as stream:
                    stream.write(f'next_version_code={report["next_version_code"]}\napi_track={report["api_track"]}\n')
            print('Play preflight checked; next Android versionCode allocated.')
        else:
            require(arguments.bundle is not None and arguments.verification is not None,
                    'Publishing requires --bundle and --verification.')
            publish(client, arguments.target, closed_track=arguments.closed_track,
                    source_commit=os.environ.get('GITHUB_SHA'), app_config=arguments.app_config,
                    bundle=arguments.bundle, verification=arguments.verification, report=report)
            print('Google Play API accepted the release and its test track was verified. Google approval and tester availability are not confirmed.')
        result = 0
    except ReleaseError as error:
        if report['status'] == 'started':
            report['status'] = 'failed'
        report['message'] = str(error)
        print(f'::error::Play release failed: {error}', file=sys.stderr)
    except (OSError, ValueError, TypeError, KeyError, UnicodeError):
        if report['status'] in {'started', 'checked'}:
            report['status'] = 'failed'
        report['message'] = 'Play release inputs or output files are invalid; details suppressed.'
        print('::error::Play release failed; details suppressed.', file=sys.stderr)
    try:
        arguments.report.parent.mkdir(parents=True, exist_ok=True)
        arguments.report.write_text(json.dumps(report, indent=2, sort_keys=True) + '\n', encoding='utf-8')
    except (OSError, UnicodeError):
        print('::error::The public Play status report could not be written.', file=sys.stderr)
        return 1
    return result


if __name__ == '__main__':
    sys.exit(main())
