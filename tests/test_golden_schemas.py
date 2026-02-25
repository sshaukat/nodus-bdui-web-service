import json
import unittest
from pathlib import Path

from runtime_core import decode_validate


class GoldenSchemasTest(unittest.TestCase):
    def test_golden_fixtures(self):
        golden_dir = Path(__file__).resolve().parent / "golden"
        fixture_paths = sorted(golden_dir.glob("*.json"))
        self.assertGreater(len(fixture_paths), 0)

        for path in fixture_paths:
            with self.subTest(fixture=path.name):
                payload = json.loads(path.read_text(encoding="utf-8"))
                result = decode_validate(
                    payload.get("schema"),
                    schema_rules_profile=payload.get("schema_rules_profile") or "v0_1_default",
                    schema_version=payload.get("schema_version"),
                )
                expect = payload.get("expect", {})
                self.assertEqual(result.get("ok"), expect.get("ok"), msg=payload.get("name"))
                self.assertEqual(len(result.get("decodeErrors", [])), expect.get("decode_errors"), msg=payload.get("name"))
                self.assertEqual(
                    len(result.get("validationErrors", [])),
                    expect.get("validation_errors"),
                    msg=payload.get("name"),
                )
                self.assertEqual(
                    result.get("appliedSchemaVersion"),
                    expect.get("applied_schema_version"),
                    msg=payload.get("name"),
                )


if __name__ == "__main__":
    unittest.main()
