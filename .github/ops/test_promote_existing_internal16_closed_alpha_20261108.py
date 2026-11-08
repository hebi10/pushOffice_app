import copy
import unittest
from promote_existing_internal16_closed_alpha_20261108 import PlayFailure, clean_message, promote


class PlayMock:
    def __init__(self):
        self.tracks = [
            {'track': 'production', 'releases': []},
            {'track': 'internal', 'releases': [{'status': 'completed', 'versionCodes': ['16']}]},
            {'track': 'alpha', 'releases': []},
            {'track': '1차 테스트', 'releases': [{'status': 'completed', 'versionCodes': ['1']}]},
        ]
        self.edits, self.calls, self.error = {}, [], None
        self.next_id = 0

    def request(self, method, path, body=None):
        self.calls.append((method, path))
        if method == 'POST' and path.endswith('/edits'):
            self.next_id += 1
            eid = f'e{self.next_id}'
            self.edits[eid] = copy.deepcopy(self.tracks)
            return {'id': eid}
        eid = path.split('/edits/')[1].split('/')[0].split(':')[0]
        if method == 'DELETE':
            self.edits.pop(eid)
            return {}
        if method == 'GET' and path.endswith('/tracks'):
            return {'tracks': self.edits[eid]}
        if method == 'GET' and path.endswith('/bundles'):
            return {'bundles': [{'versionCode': '16'}, {'versionCode': '15'}]}
        if method == 'PUT' and path.endswith('/tracks/alpha'):
            self.edits[eid] = [body if t['track'] == 'alpha' else t for t in self.edits[eid]]
            return body
        if method == 'POST' and ':commit?' in path:
            if self.error:
                raise self.error
            self.tracks = self.edits.pop(eid)
            return {'id': eid}
        raise AssertionError((method, path))


class PromotionTests(unittest.TestCase):
    def test_promote_verifies_existing_bundle_and_preserves_all_other_tracks(self):
        client = PlayMock()
        before = copy.deepcopy(client.tracks)
        report = promote(client)
        self.assertEqual(report['status'], 'committed')
        self.assertTrue(report['track_verified'])
        self.assertTrue(report['api_accepted'])
        for i in (0, 1, 3):
            self.assertEqual(client.tracks[i], before[i])
        self.assertEqual(client.tracks[2]['releases'][0]['versionCodes'], ['16'])
        self.assertEqual(sum(':commit?' in path for _,path in client.calls), 1)
        self.assertFalse(any('/upload/' in path for _,path in client.calls))

    def test_permission_denial_preserves_alpha_and_deletes_edit(self):
        client = PlayMock()
        client.error = PlayFailure(403, 'PERMISSION_DENIED', 'TESTING_TRACK_RELEASE_PERMISSION_MISSING',
                                   'You need permission to release to testing tracks')
        report = promote(client)
        self.assertEqual(report['status'], 'failed')
        self.assertFalse(report['api_accepted'])
        self.assertTrue(report['temporary_edit_deleted'])
        self.assertEqual(client.tracks[2]['releases'], [])
        self.assertIn('TESTING_TRACK_RELEASE_PERMISSION_MISSING', report['error'])

    def test_never_overwrites_an_existing_closed_release(self):
        client = PlayMock()
        client.tracks[2]['releases'] = [{'status': 'completed', 'versionCodes': ['4']}]
        report = promote(client)
        self.assertEqual(report['status'], 'failed')
        self.assertFalse(any(method == 'PUT' for method, _ in client.calls))
        self.assertTrue(report['temporary_edit_deleted'])

    def test_rejects_unexpected_internal_source(self):
        client = PlayMock()
        client.tracks[1]['releases'][0]['versionCodes'] = ['15']
        self.assertEqual(promote(client)['status'], 'failed')
        self.assertFalse(any(method == 'PUT' for method, _ in client.calls))

    def test_uncertain_commit_does_not_retry_or_claim_acceptance(self):
        client = PlayMock()
        client.error = PlayFailure(message='Request response could not be confirmed.')
        report = promote(client)
        self.assertEqual(report['status'], 'commit_unknown')
        self.assertIsNone(report['api_accepted'])
        self.assertEqual(sum(':commit?' in path for _, path in client.calls), 1)

    def test_redaction(self):
        value = clean_message('user someone@gmail.com token Bearer aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa at https://example.com/secret ID 1234567890123456 denied')
        for secret in ('gmail.com', 'aaaaaa', 'example.com', '123456789'):
            self.assertNotIn(secret, value)


if __name__ == '__main__':
    unittest.main()
