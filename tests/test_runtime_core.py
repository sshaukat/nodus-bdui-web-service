import unittest

from runtime_core import decode_validate


class RuntimeCoreTest(unittest.TestCase):
    def test_v0_2_requires_schema_version(self):
        result = decode_validate(
            {"type": "text", "value": "hello"},
            schema_rules_profile="v0_2_strict",
            schema_version=None,
        )
        self.assertFalse(result["ok"])
        self.assertTrue(any(err["path"] == "$.schemaVersion" for err in result["decodeErrors"]))

    def test_viible_alias_is_rejected_in_v0_2(self):
        result = decode_validate(
            {"schemaVersion": "v0_2", "type": "text", "value": "hello", "viible": True},
            schema_rules_profile="v0_2_strict",
            schema_version="v0_2",
        )
        self.assertFalse(result["ok"])
        self.assertTrue(any("viible" in err["path"] for err in result["decodeErrors"]))

    def test_viible_alias_is_accepted_in_v0_1(self):
        result = decode_validate(
            {"type": "text", "value": "hello", "viible": True},
            schema_rules_profile="v0_1_default",
            schema_version="v0_1",
        )
        self.assertTrue(result["ok"])
        self.assertEqual(result["node"].get("visible"), True)


if __name__ == "__main__":
    unittest.main()
