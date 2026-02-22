import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

from server import ApiError, RegistryStorage


class RegistryStorageTest(unittest.TestCase):
    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.storage = RegistryStorage(Path(self.tmpdir.name))

    def tearDown(self):
        self.tmpdir.cleanup()

    def test_create_entities_and_publish(self):
        self.storage.create_project({"project_id": "demo", "name": "Demo"})
        self.storage.create_contract({"project_id": "demo", "contract_id": "main", "name": "Main"})
        self.storage.create_version({"project_id": "demo", "contract_id": "main", "version_id": "v0-1"})

        self.storage.create_screen(
            {
                "project_id": "demo",
                "contract_id": "main",
                "version_id": "v0-1",
                "screen_id": "home",
                "name": "Home",
                "content_json": {"type": "column", "id": "form", "children": []},
            }
        )

        publication = self.storage.publish_version(
            {"project_id": "demo", "contract_id": "main", "version_id": "v0-1"}
        )

        self.assertEqual(publication["project_id"], "demo")
        self.assertEqual(publication["contract_id"], "main")
        self.assertEqual(publication["version_id"], "v0-1")
        self.assertEqual(len(publication["screens"]), 1)

        schemas = self.storage.list_published_schemas("demo", "main", "v0-1")
        self.assertEqual(len(schemas), 1)
        self.assertEqual(schemas[0]["schema_id"], "demo:main:v0-1:home")

        resolved = self.storage.get_published_schema_by_id("demo:main:v0-1:home")
        self.assertEqual(resolved["screen_id"], "home")
        self.assertEqual(resolved["schema"]["id"], "form")

    def test_get_specific_publication(self):
        self.storage.create_project({"project_id": "demo", "name": "Demo"})
        self.storage.create_contract({"project_id": "demo", "contract_id": "main", "name": "Main"})
        self.storage.create_version({"project_id": "demo", "contract_id": "main", "version_id": "v0-1"})
        self.storage.create_screen(
            {
                "project_id": "demo",
                "contract_id": "main",
                "version_id": "v0-1",
                "screen_id": "home",
                "name": "Home",
                "content_json": {"type": "column", "id": "form", "children": [{"type": "text", "id": "t1", "value": "A"}]},
            }
        )
        first = self.storage.publish_version({"project_id": "demo", "contract_id": "main", "version_id": "v0-1"})

        self.storage.update_screen(
            "demo",
            "main",
            "v0-1",
            "home",
            {"content_json": {"type": "column", "id": "form", "children": [{"type": "text", "id": "t1", "value": "B"}]}},
        )
        second = self.storage.publish_version({"project_id": "demo", "contract_id": "main", "version_id": "v0-1"})

        specific = self.storage.get_published_schema_by_parts(
            "demo",
            "main",
            "v0-1",
            "home",
            pub_id=first["pub_id"],
        )
        latest = self.storage.get_published_schema_by_parts("demo", "main", "v0-1", "home")

        self.assertNotEqual(first["pub_id"], second["pub_id"])
        self.assertEqual(specific["pub_id"], first["pub_id"])
        self.assertEqual(latest["pub_id"], second["pub_id"])
        self.assertEqual(specific["schema"]["children"][0]["value"], "A")
        self.assertEqual(latest["schema"]["children"][0]["value"], "B")

    def test_create_version_with_inheritance(self):
        self.storage.create_project({"project_id": "demo", "name": "Demo"})
        self.storage.create_contract({"project_id": "demo", "contract_id": "main", "name": "Main"})
        self.storage.create_version({"project_id": "demo", "contract_id": "main", "version_id": "v0-1"})
        self.storage.create_screen(
            {
                "project_id": "demo",
                "contract_id": "main",
                "version_id": "v0-1",
                "screen_id": "home",
                "name": "Home",
                "content_json": {"type": "column", "id": "form", "children": []},
            }
        )

        self.storage.create_version(
            {
                "project_id": "demo",
                "contract_id": "main",
                "version_id": "v0-2",
                "based_on_version_id": "v0-1",
            }
        )

        inherited = self.storage.list_screens("demo", "main", "v0-2")
        self.assertEqual(len(inherited), 1)
        self.assertEqual(inherited[0]["screen_id"], "home")

    def test_cleanup_publications_older_than_month(self):
        self.storage.create_project({"project_id": "demo", "name": "Demo"})
        self.storage.create_contract({"project_id": "demo", "contract_id": "main", "name": "Main"})
        self.storage.create_version({"project_id": "demo", "contract_id": "main", "version_id": "v0-1"})
        self.storage.create_screen(
            {
                "project_id": "demo",
                "contract_id": "main",
                "version_id": "v0-1",
                "screen_id": "home",
                "name": "Home",
                "content_json": {"type": "column", "id": "form", "children": []},
            }
        )

        publication = self.storage.publish_version({"project_id": "demo", "contract_id": "main", "version_id": "v0-1"})
        old_manifest = (
            Path(self.tmpdir.name)
            / "projects"
            / "demo"
            / "contracts"
            / "main"
            / "versions"
            / "v0-1"
            / "published"
            / publication["pub_id"]
            / "manifest.json"
        )

        old_payload = self.storage._load_json(old_manifest, {})
        old_payload["published_at"] = (datetime.now(tz=timezone.utc) - timedelta(days=45)).isoformat()
        self.storage._dump_json(old_manifest, old_payload)

        removed = self.storage.cleanup_old_publications()
        self.assertGreaterEqual(removed["removed_publications"], 1)
        self.assertFalse(old_manifest.exists())

    def test_save_invalid_screen_draft_and_block_publish(self):
        self.storage.create_project({"project_id": "demo", "name": "Demo"})
        self.storage.create_contract({"project_id": "demo", "contract_id": "main", "name": "Main"})
        self.storage.create_version({"project_id": "demo", "contract_id": "main", "version_id": "v0-1"})
        self.storage.create_screen(
            {
                "project_id": "demo",
                "contract_id": "main",
                "version_id": "v0-1",
                "screen_id": "home",
                "name": "Home",
                "content_json": {"type": "column", "id": "form", "children": []},
            }
        )

        updated = self.storage.update_screen(
            "demo",
            "main",
            "v0-1",
            "home",
            {"content_raw": "{\"type\":\"column\",\"id\":\"form\",\"children\":[}"},
        )
        self.assertIsNotNone(updated.get("content_parse_error"))
        self.assertIsNone(updated.get("content_json"))

        with self.assertRaises(ApiError):
            self.storage.publish_version({"project_id": "demo", "contract_id": "main", "version_id": "v0-1"})


if __name__ == "__main__":
    unittest.main()
