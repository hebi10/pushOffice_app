#!/usr/bin/env python3
"""Guarded one-time promotion of the already verified internal AAB to existing closed alpha."""
import json
import os
import re
import sys
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import HTTPRedirectHandler, Request, build_opener

PACKAGE = 'com.hebi96.pushOffice_app'
ROOT = 'https://androidpublisher.googleapis.com'
API = f'/androidpublisher/v3/applications/{PACKAGE}/edits'
VERSION = '16'
ALPHA = 'alpha'
INTERNAL = 'internal'
REVIEW_GUARD = 'changesInReviewBehavior=ERROR_IF_IN_REVIEW'


def clean_message(message):
    if not isinstance(message, str):
        return ''
    message = re.sub(r'https?://\S+', ' [link] ', message, flags=re.I)
    message = re.sub(r'[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', ' [email] ', message)
    message = re.sub(r'(?i)\b(?:bearer\s+)?[a-z0-9_\-]{40,}\b', ' [redacted] ', message)
    message = re.sub(r'\b\d{7,}\b', ' [number] ', message)
    message = re.sub(r'[^A-Za-z0-9가-힣\s.,;:!?()_\-/\[\]]', ' ', message)
    return ' '.join(message.split())[:200]


class PlayFailure(Exception):
    def __init__(self, code=None, status='', reason='', message=''):
        self.code = code
        self.status = status if re.fullmatch('[A-Z_]{1,64}', status or '') else ''
        self.reason = reason if re.fullmatch('[A-Z_]{1,80}', reason or '') else ''
        self.message = clean_message(message)
        super().__init__(f'Play API HTTP {code or "unknown"}: status={self.status or "unavailable"}, '
                         f'reason={self.reason or "unavailable"}, detail={self.message or "unavailable"}')


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


class Client:
    def __init__(self, token):
        if not token or not token.isascii() or any(c.isspace() for c in token):
            raise ValueError('Play token is missing or invalid.')
        self.token = token
        self.opener = build_opener(NoRedirect())

    def request(self, method, path, body=None):
        if not path.startswith(API) or not (path == API or path.startswith(API + '/')):
            raise ValueError('Unapproved Google Play API path.')
        headers = {'Authorization': 'Bearer ' + self.token, 'Accept': 'application/json'}
        payload = None
        if body is not None:
            payload = json.dumps(body, separators=(',', ':')).encode('utf-8')
            headers['Content-Type'] = 'application/json'
        try:
            with self.opener.open(Request(ROOT + path, method=method, headers=headers, data=payload), timeout=75) as response:
                data = response.read()
            value = json.loads(data) if data else {}
            if not isinstance(value, dict):
                raise ValueError('Invalid Google Play API response shape')
            return value
        except HTTPError as exc:
            body = {}
            try:
                body = json.loads(exc.read(8192).decode('utf-8', 'replace'))
            except (ValueError, UnicodeError, OSError):
                pass
            error = body.get('error', {}) if isinstance(body, dict) else {}
            if not isinstance(error, dict):
                error = {}
            reason = ''
            for detail in (error.get('details') or []):
                if isinstance(detail, dict) and isinstance(detail.get('reason'), str):
                    reason = detail['reason']
                    break
            if not reason:
                for sub in (error.get('errors') or []):
                    if isinstance(sub, dict) and isinstance(sub.get('reason'), str):
                        reason = sub['reason']
                        break
            raise PlayFailure(exc.code, error.get('status', ''), reason, error.get('message', '')) from None
        except (URLError, OSError, ValueError):
            raise PlayFailure(message='Request response could not be confirmed.') from None


def api_edit(value):
    edit_id = value.get('id')
    if not isinstance(edit_id, str) or not re.fullmatch(r'[A-Za-z0-9_-]{1,128}', edit_id):
        raise ValueError('Invalid Play edit ID')
    return API + '/' + edit_id


def only_release(items, track, version):
    if not isinstance(items, list):
        return False
    found = [x for x in items if isinstance(x, dict) and x.get('track') == track]
    if len(found) != 1:
        return False
    releases = found[0].get('releases', [])
    return (isinstance(releases, list) and len(releases) == 1
            and isinstance(releases[0], dict)
            and releases[0].get('status') == 'completed'
            and releases[0].get('versionCodes') == [version])


def promote(client):
    report = {'package': PACKAGE, 'target': ALPHA, 'source_track': INTERNAL,
              'expected_version_code': int(VERSION), 'api_accepted': False,
              'track_verified': False, 'status': 'started', 'stage': 'create_edit'}
    edit = None
    verification_edit = None
    try:
        edit = api_edit(client.request('POST', API, {}))
        report['stage'] = 'inventory'
        found = client.request('GET', edit + '/tracks').get('tracks', [])
        if not isinstance(found, list) or not only_release(found, INTERNAL, VERSION):
            raise ValueError('Internal release 16 is not exactly completed; promotion refused.')
        alpha = [t for t in found if isinstance(t, dict) and t.get('track') == ALPHA]
        if len(alpha) != 1:
            raise ValueError('Exact closed alpha track was not found.')
        if alpha[0].get('releases', []) != []:
            raise ValueError('Closed alpha is no longer empty. Refusing to replace an existing release.')
        artifacts = client.request('GET', edit + '/bundles').get('bundles', [])
        if not isinstance(artifacts, list) or sum(str(a.get('versionCode')) == VERSION for a in artifacts if isinstance(a, dict)) != 1:
            raise ValueError('Previously uploaded, signed internal AAB version 16 was not found.')
        report['stage'] = 'update_alpha'
        release = {'name': '1.1.0', 'versionCodes': [VERSION], 'status': 'completed',
                   'releaseNotes': [{'language': 'ko-KR', 'text':
                   '기기 AI 모델 다운로드와 알림 일정 후보 추천 기능을 추가하고 빠른 설정 및 안정성을 개선했습니다.'}]}
        client.request('PUT', edit + '/tracks/alpha', {'track': ALPHA, 'releases': [release]})
        report['stage'] = 'commit'
        try:
            client.request('POST', edit + ':commit?' + REVIEW_GUARD)
        except PlayFailure as exc:
            if exc.code is None or exc.code >= 500:
                report['api_accepted'] = None
                report['status'] = 'commit_unknown'
                edit = None
            raise
        report['api_accepted'] = True
        report['status'] = 'committed_unverified'
        edit = None
        report['stage'] = 'verify_track'
        verification_edit = api_edit(client.request('POST', API, {}))
        tracks = client.request('GET', verification_edit + '/tracks').get('tracks', [])
        if not only_release(tracks, ALPHA, VERSION) or not only_release(tracks, INTERNAL, VERSION):
            raise ValueError('Committed release could not be independently verified on both test tracks.')
        report.update(stage='complete', status='committed', track_verified=True)
    except (PlayFailure, ValueError) as exc:
        if report['status'] == 'started':
            report['status'] = 'failed'
        report['error'] = str(exc)
    finally:
        for key, current in (('verification_edit_deleted', verification_edit), ('temporary_edit_deleted', edit)):
            if current is None:
                continue
            try:
                client.request('DELETE', current)
                report[key] = True
            except PlayFailure:
                report[key] = False
                if report['status'] == 'committed':
                    report['status'] = 'cleanup_failed'
    return report


def main():
    dest = Path(os.environ.get('RUNNER_TEMP', '.')) / 'push-office-closed-promotion-report.json'
    result = {'status': 'not_started'}
    try:
        result = promote(Client(os.environ.get('PLAY_ACCESS_TOKEN', '')))
    except (ValueError, PlayFailure) as exc:
        result = {'status': 'failed', 'error': str(exc)}
    dest.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print('Google Play closed-alpha promotion: ' + result['status'])
    if 'error' in result:
        print('::error::' + result['error'], file=sys.stderr)
    return 0 if result['status'] == 'committed' else 1


if __name__ == '__main__':
    sys.exit(main())
