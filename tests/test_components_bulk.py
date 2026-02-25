import tempfile
import unittest
from pathlib import Path

from server import RegistryStorage


class ComponentBulkTest(unittest.TestCase):
    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.storage = RegistryStorage(Path(self.tmpdir.name))

    def tearDown(self):
        self.tmpdir.cleanup()

    def test_export_and_import_skip(self):
        created = self.storage.create_component(
            {
                "type": "custom_text",
                "title": {"ru": "Текст", "en": "Text"},
                "description": {"ru": "Описание", "en": "Description"},
                "fields": {"ru": "Поля", "en": "Fields"},
                "template": {"type": "text", "value": "Hello"},
                "updated_by": "tester",
            }
        )
        self.assertEqual(created["updated_by"], "tester")

        exported = self.storage.export_components()
        self.assertEqual(len(exported["items"]), 1)

        summary = self.storage.import_components(
            {"items": exported["items"]},
            strategy="skip",
            requested_by="importer",
        )
        self.assertEqual(summary["summary"]["skipped"], 1)

    def test_import_merge_updates_fields(self):
        self.storage.create_component(
            {
                "type": "mergeable",
                "title": {"ru": "Старый", "en": "Old"},
                "description": {"ru": "Старое", "en": "Old"},
                "fields": {"ru": "Поля", "en": "Fields"},
                "template": {"type": "text", "value": "A"},
                "updated_by": "seed",
            }
        )

        result = self.storage.import_components(
            {
                "items": [
                    {
                        "type": "mergeable",
                        "title": {"ru": "Новый", "en": "New"},
                        "description": {"ru": "Новое", "en": "New"},
                        "fields": {"ru": "Поля", "en": "Fields"},
                        "template": {"type": "text", "value": "B"},
                    }
                ]
            },
            strategy="merge",
            requested_by="bulk-user",
            change_note="bulk merge",
        )

        self.assertEqual(result["summary"]["updated"], 1)
        merged = self.storage.list_components()[0]
        self.assertEqual(merged["template"]["value"], "B")
        self.assertEqual(merged["updated_by"], "bulk-user")
        self.assertEqual(merged["change_note"], "bulk merge")


if __name__ == "__main__":
    unittest.main()
