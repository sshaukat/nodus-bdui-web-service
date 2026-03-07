import tempfile
import unittest
from pathlib import Path

import server
from server import ApiError, RequestHandler


class CustomIconsApiTest(unittest.TestCase):
    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.original_icons_dir = server.CUSTOM_ICONS_DIR
        server.CUSTOM_ICONS_DIR = Path(self.tmpdir.name) / "icons" / "custom"
        server.CUSTOM_ICONS_DIR.mkdir(parents=True, exist_ok=True)

    def tearDown(self):
        server.CUSTOM_ICONS_DIR = self.original_icons_dir
        self.tmpdir.cleanup()

    def test_icons_payload_lists_library_and_custom(self):
        (server.CUSTOM_ICONS_DIR / "help.svg").write_text('<svg xmlns="http://www.w3.org/2000/svg"></svg>', encoding="utf-8")
        (server.CUSTOM_ICONS_DIR / "help.png").write_bytes(b"PNG")
        (server.CUSTOM_ICONS_DIR / "invalid name.svg").write_text("x", encoding="utf-8")

        handler = RequestHandler.__new__(RequestHandler)
        payload = handler._icons_payload()

        self.assertIn("menu", payload.get("library", []))
        custom = payload.get("custom", [])
        self.assertEqual(len(custom), 1)
        self.assertEqual(custom[0]["name"], "help")
        self.assertEqual(custom[0]["ext"], ".svg")
        self.assertEqual(custom[0]["url"], "/assets/icons/custom/help.svg")

    def test_resolve_custom_icon_file_supports_with_and_without_extension(self):
        icon_path = server.CUSTOM_ICONS_DIR / "help.png"
        icon_path.write_bytes(b"PNG")

        resolved_without_ext = RequestHandler._resolve_custom_icon_file("/assets/icons/custom/help")
        resolved_with_ext = RequestHandler._resolve_custom_icon_file("/assets/icons/custom/help.png")

        self.assertEqual(resolved_without_ext.resolve(), icon_path.resolve())
        self.assertEqual(resolved_with_ext.resolve(), icon_path.resolve())

    def test_resolve_custom_icon_file_blocks_path_traversal(self):
        with self.assertRaises(ApiError):
            RequestHandler._resolve_custom_icon_file("/assets/icons/custom/../secret.svg")


if __name__ == "__main__":
    unittest.main()
