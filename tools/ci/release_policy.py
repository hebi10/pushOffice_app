"""Select Push Office test releases and prepare the ephemeral build configuration."""
import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import re
import sys

from release_aab import ReleaseError, require

PACKAGE = 'com.hebi96.pushOffice_app'
CERTIFICATE = '7704A1A8A8927701A6F86FE5100C633A0DE5A038D41AA7C65C8A56150DF55845'
ACTIVATION = datetime(2026, 11, 6, 3, 32, tzinfo=timezone.utc)
PRIVATE_SIGNING_SECRETS = ('PUSH_OFFICE_KEYSTORE_BASE64', 'PUSH_OFFICE_KEYSTORE_PASSWORD',
                           'PUSH_OFFICE_KEY_ALIAS', 'PUSH_OFFICE_KEY_PASSWORD')


def release_request(event, ref, repository, inputs):
    require(repository == 'hebi10/pushOffice_app' and ref == 'refs/heads/main',
            'Releases require the original repository main branch.')
    require(event in {'push', 'workflow_dispatch'}, 'Unsupported release event.')
    mode = inputs.get('mode') or 'deploy' if event == 'workflow_dispatch' else 'deploy'
    target = inputs.get('target') or 'internal' if event == 'workflow_dispatch' else 'internal'
    require(mode in {'check', 'build', 'deploy'} and target in {'internal', 'closed'},
            'Select check/build/deploy and internal/closed testing.')
    return {'mode': mode, 'target': target}


def upload_allowed(now=None):
    return (now or datetime.now(timezone.utc)) >= ACTIVATION


def require_signing(environment):
    missing = [name for name in PRIVATE_SIGNING_SECRETS if not environment.get(name)]
    require(not missing, 'Missing GitHub signing settings: ' + ', '.join(missing))


def set_version(path, code):
    document = json.loads(path.read_text(encoding='utf-8'))
    android = document['expo']['android']
    require(android['package'] == PACKAGE, 'Build package does not match Push Office.')
    require(type(code) is int and type(android['versionCode']) is int
            and android['versionCode'] <= code <= 2100000000 and code > 0,
            'Effective versionCode must not decrease or exceed the Android range.')
    android['versionCode'] = code
    path.write_text(json.dumps(document, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def build_version(current, run_number):
    require(type(current) is int and 0 < current <= 2100000000
            and isinstance(run_number, str) and bool(re.fullmatch(r'[1-9][0-9]*', run_number)),
            'Build-only version allocation needs a valid source code and GitHub run number.')
    code = current + int(run_number)
    require(code <= 2100000000, 'Build-only versionCode exceeds the Android range.')
    return code


def output(values):
    if os.environ.get('GITHUB_OUTPUT'):
        with Path(os.environ['GITHUB_OUTPUT']).open('a', encoding='utf-8') as stream:
            for key, value in values.items():
                stream.write(f'{key}={value}\n')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['request', 'check-signing', 'set-version', 'build-version', 'upload-gate'])
    parser.add_argument('--app-config', type=Path, default=Path('app.json'))
    parser.add_argument('--version-code', type=int)
    args = parser.parse_args()
    try:
        if args.command == 'request':
            event = json.loads(Path(os.environ['GITHUB_EVENT_PATH']).read_text())
            values = release_request(os.environ['GITHUB_EVENT_NAME'], os.environ['GITHUB_REF'],
                                     os.environ['GITHUB_REPOSITORY'], event.get('inputs') or {})
            output(values)
            print(f"Selected {values['mode']} / {values['target']}.")
        elif args.command == 'check-signing':
            require_signing(os.environ)
            print('All four private signing settings are present.')
        elif args.command == 'set-version':
            set_version(args.app_config, args.version_code)
            print('Effective build versionCode prepared.')
        elif args.command == 'build-version':
            config = json.loads(args.app_config.read_text())
            code = build_version(config['expo']['android']['versionCode'], os.environ['GITHUB_RUN_NUMBER'])
            output({'next_version_code': code})
        else:
            allowed = upload_allowed()
            output({'allowed': str(allowed).lower()})
            if not allowed:
                notice = 'Play upload deferred: approved upload key activates 2026-11-06 12:32 KST. Signed artifacts are retained; no Play release was made.'
                print('::notice::' + notice)
                if os.environ.get('GITHUB_STEP_SUMMARY'):
                    with Path(os.environ['GITHUB_STEP_SUMMARY']).open('a', encoding='utf-8') as stream:
                        stream.write('\n' + notice + '\n')
        return 0
    except ReleaseError as error:
        print(f'::error::Release policy check failed: {error}', file=sys.stderr)
        return 1
    except (OSError, ValueError, KeyError, TypeError):
        print('::error::Release policy check failed. Check main-branch selection, versionCode and the four PUSH_OFFICE signing settings.', file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())
