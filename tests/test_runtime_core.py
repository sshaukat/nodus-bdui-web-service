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

    def test_custom_nav_bar_is_normalized_to_navbar(self):
        result = decode_validate(
            {
                "schemaVersion": "v0_2",
                "type": "custom-nav-bar",
                "id": "header",
                "title": "Screen title",
                "subtitle": "Screen subtitle",
                "titleHorizontalAlign": "center",
                "leftIcon": "arrow-left",
                "leftAction": {"type": "navigate", "route": "back"},
                "actions": [{"icon": "custom:help", "title": "Help", "action": {"type": "log", "value": "help"}}],
                "centerContent": {"type": "text", "id": "center_cta", "value": "CTA"},
            },
            schema_rules_profile="v0_2_strict",
            schema_version="v0_2",
        )
        self.assertTrue(result["ok"])
        node = result["node"] or {}
        self.assertEqual(node.get("type"), "navbar")
        self.assertEqual(node.get("sourceType"), "custom-nav-bar")
        self.assertEqual(node.get("titleAlign"), "center")
        self.assertEqual(node.get("backIcon"), "arrow-left")
        self.assertEqual(node.get("actions", [])[0].get("icon"), "custom:help")
        self.assertEqual(node.get("centerContent", {}).get("type"), "text")

    def test_custom_nav_bar_invalid_align_returns_decode_error(self):
        result = decode_validate(
            {
                "schemaVersion": "v0_2",
                "type": "custom-nav-bar",
                "id": "header",
                "titleHorizontalAlign": "diagonal",
            },
            schema_rules_profile="v0_2_strict",
            schema_version="v0_2",
        )
        self.assertFalse(result["ok"])
        self.assertTrue(any("titleHorizontalAlign" in err["path"] for err in result["decodeErrors"]))

    def test_custom_nav_bar_invalid_custom_icon_returns_decode_error(self):
        result = decode_validate(
            {
                "schemaVersion": "v0_2",
                "type": "custom-nav-bar",
                "id": "header",
                "actions": [{"icon": "custom:../../secret"}],
            },
            schema_rules_profile="v0_2_strict",
            schema_version="v0_2",
        )
        self.assertFalse(result["ok"])
        self.assertTrue(any("actions" in err["path"] for err in result["decodeErrors"]))

    def test_navbar_wrap_alias_maps_to_max_lines(self):
        result = decode_validate(
            {
                "schemaVersion": "v0_2",
                "type": "navbar",
                "id": "header",
                "title": "Main title",
                "subtitle": "Sub title",
                "titleWrap": True,
                "subtitleWrap": False,
            },
            schema_rules_profile="v0_2_strict",
            schema_version="v0_2",
        )
        self.assertTrue(result["ok"])
        node = result["node"] or {}
        self.assertEqual(node.get("titleMaxLines"), 2)
        self.assertEqual(node.get("subtitleMaxLines"), 1)

    def test_navbar_invalid_max_lines_returns_decode_error(self):
        result = decode_validate(
            {
                "schemaVersion": "v0_2",
                "type": "custom-nav-bar",
                "id": "header",
                "titleMaxLines": 0,
            },
            schema_rules_profile="v0_2_strict",
            schema_version="v0_2",
        )
        self.assertFalse(result["ok"])
        self.assertTrue(any(err["path"] == "$.titleMaxLines" for err in result["decodeErrors"]))


if __name__ == "__main__":
    unittest.main()
