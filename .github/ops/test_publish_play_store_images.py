"""Isolated tests for Play listing updates; never access network or credentials."""
import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import publish_play_store_images as publisher


class FakePlay:
    def __init__(self, deny_commit=False, tamper_order=False):
        self.deny_commit = deny_commit
        self.tamper_order = tamper_order
        self.calls = []
        self.sequence = 0
        self.image_counts = {"icon": 1, "featureGraphic": 1, "phoneScreenshots": 6}
        self.images = {
            kind: [{"id": f"old-{kind}-{index}"} for index in range(count)]
            for kind, count in self.image_counts.items()
        }
        self.commits = 0
        self.closed = []
        self.listing = {
            "title": publisher.CURRENT_TITLE,
            "shortDescription": "Existing short listing",
            "fullDescription": "Existing long listing",
        }

    def new_edit(self):
        self.sequence += 1
        return f"{publisher.API}/testedit{self.sequence}"

    def request(self, method, path, body=None, mime=None):
        self.calls.append((method, path))
        if path.endswith(":validate"):
            raise AssertionError("No additional edits.validate call is permitted")
        if method == "DELETE" and path.endswith(("testedit1", "testedit2")):
            self.closed.append(path)
            return {}
        if path.endswith("/listings/ko-KR") and method == "GET":
            return dict(self.listing)
        for kind in publisher.TYPES:
            if method == "GET" and path.endswith("/listings/ko-KR/" + kind):
                images = list(self.images[kind])
                if self.tamper_order and kind == "phoneScreenshots" and images[0]["id"].startswith("new-"):
                    images.reverse()
                return {"images": images}
            if method == "DELETE" and path.endswith("/listings/ko-KR/" + kind):
                self.images[kind].clear()
                return {}
            if method == "POST" and "/listings/ko-KR/" + kind + "?uploadType=media" in path:
                if not isinstance(body, bytes) or mime != "image/png":
                    raise AssertionError("Expected PNG upload bytes")
                ident = "new-" + kind + "-" + str(len(self.images[kind]))
                image = {"id": ident}
                self.images[kind].append(image)
                return {"image": image}
        if method == "POST" and path.endswith(":commit?changesInReviewBehavior=ERROR_IF_IN_REVIEW"):
            self.commits += 1
            if self.deny_commit:
                raise publisher.ListingError("Google Play POST request failed (HTTP 403). Permission check")
            return {"id": "committed"}
        raise AssertionError(f"Unexpected Play API call: {method} {path}")


class PlayListingCommitTest(unittest.TestCase):
    def execute(self, fake):
        with tempfile.TemporaryDirectory() as tmp, \
             patch.dict(os.environ, {"PLAY_ACCESS_TOKEN": "example", "RUNNER_TEMP": tmp}), \
             patch.object(publisher, "Play", lambda token: fake), \
             patch.object(publisher, "validated_assets", return_value={
                 "icon": [b"icon"],
                 "featureGraphic": [b"feature"],
                 "phoneScreenshots": [f"image{i}".encode() for i in range(6)],
             }):
            code = publisher.run()
            report = json.loads((Path(tmp) / "push-office-play-store-publication.json").read_text())
        return code, report

    def test_commit_validates_and_verifies_uploaded_identity_without_explicit_validate(self):
        fake = FakePlay()
        code, report = self.execute(fake)
        self.assertEqual(0, code)
        self.assertEqual(1, fake.commits)
        self.assertEqual("committed", report["status"])
        self.assertEqual("complete", report["stage"])
        self.assertTrue(report["api_accepted"])
        self.assertTrue(report["verified"])
        self.assertTrue(report["text_preserved"])
        self.assertEqual({"icon": 1, "featureGraphic": 1, "phoneScreenshots": 6}, report["image_counts_after"])
        self.assertEqual(1, len(fake.closed))
        self.assertFalse(any(":validate" in path for _, path in fake.calls))

    def test_denied_commit_is_not_retried_and_abandons_edit(self):
        fake = FakePlay(deny_commit=True)
        code, report = self.execute(fake)
        self.assertEqual(1, code)
        self.assertEqual(1, fake.commits)
        self.assertEqual("commit_unconfirmed", report["status"])
        self.assertEqual("commit", report["stage"])
        self.assertFalse(report["api_accepted"])
        self.assertFalse(report["verified"])
        self.assertTrue(report["temporary_edit_deleted"])
        self.assertEqual(1, len(fake.closed))

    def test_mismatched_upload_order_aborts_before_commit(self):
        fake = FakePlay(tamper_order=True)
        code, report = self.execute(fake)
        self.assertEqual(1, code)
        self.assertEqual(0, fake.commits)
        self.assertFalse(report["api_accepted"])
        self.assertEqual("upload_phoneScreenshots", report["stage"])
        self.assertEqual(1, len(fake.closed))


    def test_screenshot_only_update_does_not_touch_icon_or_feature_graphic(self):
        fake = FakePlay()
        original_icons = {key: list(fake.images[key]) for key in ('icon', 'featureGraphic')}
        with patch.object(publisher, 'TYPES', ('phoneScreenshots',)):
            code, report = self.execute(fake)
        self.assertEqual(0, code)
        self.assertEqual(1, fake.commits)
        self.assertEqual('committed', report['status'])
        self.assertEqual(['phoneScreenshots'], report['changed_fields'])
        self.assertEqual({'phoneScreenshots': 6}, report['image_counts_after'])
        for key, prior in original_icons.items():
            self.assertEqual(prior, fake.images[key], key + ' must remain unchanged')
            self.assertFalse(any(method == 'DELETE' and uri.endswith('/' + key)
                                 for method, uri in fake.calls))



if __name__ == "__main__":
    unittest.main()
