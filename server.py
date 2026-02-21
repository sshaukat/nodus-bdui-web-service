#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import mimetypes
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

WEB_DIR = Path(__file__).resolve().parent / "web"


class BduiRuntime:
    NODE_TYPES = {"column", "row", "box", "text", "button", "iconbutton", "spacer", "input"}
    ACTION_TYPES = {"log", "open_url", "navigate"}

    @classmethod
    def decode_validate(cls, schema: Any) -> dict[str, Any]:
        decode_errors: list[dict[str, str]] = []
        node = cls._decode_node(schema, "$", decode_errors)

        validation_errors: list[dict[str, str]] = []
        if node is not None:
            cls._validate_node(node, "$", validation_errors, seen_ids=set())

        return {
            "ok": node is not None and not decode_errors and not validation_errors,
            "node": node,
            "decodeErrors": decode_errors,
            "validationErrors": validation_errors,
        }

    @classmethod
    def _decode_node(
        cls,
        source: Any,
        path: str,
        errors: list[dict[str, str]],
    ) -> dict[str, Any] | None:
        if not isinstance(source, dict):
            errors.append({"path": path, "message": "Node must be an object"})
            return None

        raw_type = source.get("type")
        if not isinstance(raw_type, str) or not raw_type.strip():
            errors.append({"path": path, "message": "Node field 'type' is required"})
            return None

        node_type = raw_type.strip().lower()
        if node_type not in cls.NODE_TYPES:
            errors.append({"path": path, "message": f"Unsupported node type: {node_type}"})
            return None

        node: dict[str, Any] = {"type": node_type}
        if "id" in source:
            node["id"] = source.get("id")

        layout = cls._decode_layout(source.get("layout"), f"{path}.layout", errors)
        if layout is not None:
            node["layout"] = layout

        if node_type in {"column", "row", "box"}:
            node["children"] = cls._decode_children(source.get("children"), f"{path}.children", errors)
        if node_type == "row":
            if "justify" in source:
                node["justify"] = source.get("justify")
            if "distribution" in source:
                node["distribution"] = source.get("distribution")
            if "alignItems" in source:
                node["alignItems"] = source.get("alignItems")
            if "crossAlign" in source:
                node["crossAlign"] = source.get("crossAlign")
            if "wrap" in source:
                node["wrap"] = source.get("wrap")
            if "gap" in source:
                node["gap"] = source.get("gap")

        if node_type == "text":
            node["value"] = source.get("value")

        if node_type == "button":
            node["title"] = source.get("title")
            action = cls._decode_action(source.get("action"), f"{path}.action", errors)
            if action is not None:
                node["action"] = action

        if node_type == "iconbutton":
            node["title"] = source.get("title")
            node["icon"] = source.get("icon")
            action = cls._decode_action(source.get("action"), f"{path}.action", errors)
            if action is not None:
                node["action"] = action

        if node_type == "input":
            node["placeholder"] = source.get("placeholder")
            node["value"] = source.get("value")
            on_change = cls._decode_action(source.get("onChange"), f"{path}.onChange", errors)
            if on_change is not None:
                node["onChange"] = on_change

        return node

    @classmethod
    def _decode_children(
        cls,
        source: Any,
        path: str,
        errors: list[dict[str, str]],
    ) -> list[dict[str, Any]]:
        if source is None:
            return []
        if not isinstance(source, list):
            errors.append({"path": path, "message": "'children' must be an array"})
            return []

        decoded: list[dict[str, Any]] = []
        for index, child in enumerate(source):
            child_node = cls._decode_node(child, f"{path}[{index}]", errors)
            if child_node is not None:
                decoded.append(child_node)
        return decoded

    @classmethod
    def _decode_layout(
        cls,
        source: Any,
        path: str,
        errors: list[dict[str, str]],
    ) -> dict[str, Any] | None:
        if source is None:
            return None
        if not isinstance(source, dict):
            errors.append({"path": path, "message": "'layout' must be an object"})
            return None

        return {
            "padding": cls._decode_spacing(source.get("padding"), f"{path}.padding", errors),
            "margin": cls._decode_spacing(source.get("margin"), f"{path}.margin", errors),
            "width": source.get("width"),
            "height": source.get("height"),
            "weight": source.get("weight"),
            "alignment": source.get("alignment"),
        }

    @classmethod
    def _decode_spacing(
        cls,
        source: Any,
        path: str,
        errors: list[dict[str, str]],
    ) -> dict[str, float]:
        if source is None:
            return {"top": 0.0, "right": 0.0, "bottom": 0.0, "left": 0.0}
        if not isinstance(source, dict):
            errors.append({"path": path, "message": "Spacing must be an object"})
            return {"top": 0.0, "right": 0.0, "bottom": 0.0, "left": 0.0}

        return {
            "top": cls._to_float(source.get("top"), 0.0),
            "right": cls._to_float(source.get("right"), 0.0),
            "bottom": cls._to_float(source.get("bottom"), 0.0),
            "left": cls._to_float(source.get("left"), 0.0),
        }

    @classmethod
    def _decode_action(
        cls,
        source: Any,
        path: str,
        errors: list[dict[str, str]],
    ) -> dict[str, Any] | None:
        if source is None:
            return None
        if not isinstance(source, dict):
            errors.append({"path": path, "message": "Action must be an object"})
            return None

        raw_type = source.get("type")
        if not isinstance(raw_type, str) or not raw_type.strip():
            errors.append({"path": path, "message": "Action field 'type' is required"})
            return None

        action_type = raw_type.strip().lower()
        action: dict[str, Any] = {"type": action_type}

        if action_type == "log":
            action["value"] = source.get("value")
        elif action_type == "open_url":
            action["url"] = source.get("url")
        elif action_type == "navigate":
            action["route"] = source.get("route")

        return action

    @classmethod
    def _validate_node(
        cls,
        node: dict[str, Any],
        path: str,
        errors: list[dict[str, str]],
        seen_ids: set[str],
    ) -> None:
        node_id = node.get("id")
        if node_id is not None:
            if not isinstance(node_id, str) or not node_id.strip():
                errors.append({"path": path, "message": "Node id must not be blank"})
            elif node_id in seen_ids:
                errors.append({"path": path, "message": f"Duplicate node id: {node_id}"})
            else:
                seen_ids.add(node_id)

        node_type = node["type"]

        if node_type == "text":
            value = node.get("value")
            if not isinstance(value, str) or not value.strip():
                errors.append({"path": path, "message": "Text node field 'value' is required"})

        if node_type == "button":
            title = node.get("title")
            if not isinstance(title, str) or not title.strip():
                errors.append({"path": path, "message": "Button node field 'title' is required"})
            cls._validate_action(node.get("action"), f"{path}.action", errors)

        if node_type == "iconbutton":
            title = node.get("title")
            if title is not None and (not isinstance(title, str) or not title.strip()):
                errors.append({"path": path, "message": "IconButton field 'title' must not be blank"})

            icon = node.get("icon")
            allowed_icons = {
                "plus",
                "minus",
                "edit",
                "trash",
                "search",
                "settings",
                "check",
                "close",
                "arrow-left",
                "arrow-right",
                "menu",
            }
            if not isinstance(icon, str) or icon.lower() not in allowed_icons:
                errors.append({"path": path, "message": "IconButton field 'icon' has unsupported value"})

            cls._validate_action(node.get("action"), f"{path}.action", errors)

        if node_type == "input":
            input_id = node.get("id")
            if not isinstance(input_id, str) or not input_id.strip():
                errors.append({"path": path, "message": "Input node requires non-empty id"})
            cls._validate_action(node.get("onChange"), f"{path}.onChange", errors)

        if node_type == "row":
            cls._validate_row(node, path, errors)

        for index, child in enumerate(node.get("children", [])):
            cls._validate_node(child, f"{path}.children[{index}]", errors, seen_ids)

    @classmethod
    def _validate_row(
        cls,
        node: dict[str, Any],
        path: str,
        errors: list[dict[str, str]],
    ) -> None:
        justify = node.get("justify")
        if justify is not None:
            allowed_justify = {
                "left",
                "start",
                "flex-start",
                "right",
                "end",
                "flex-end",
                "center",
                "space-between",
                "between",
                "space-around",
                "space-evenly",
            }
            if not isinstance(justify, str) or justify.lower() not in allowed_justify:
                errors.append({"path": f"{path}.justify", "message": "Unsupported row justify value"})

        distribution = node.get("distribution")
        if distribution is not None:
            allowed_distribution = {"space-between", "between", "space-around", "space-evenly"}
            if not isinstance(distribution, str) or distribution.lower() not in allowed_distribution:
                errors.append({"path": f"{path}.distribution", "message": "Unsupported row distribution value"})

        align_items = node.get("alignItems")
        if align_items is not None:
            allowed_align = {"top", "start", "flex-start", "bottom", "end", "flex-end", "center", "stretch", "baseline"}
            if not isinstance(align_items, str) or align_items.lower() not in allowed_align:
                errors.append({"path": f"{path}.alignItems", "message": "Unsupported row alignItems value"})

        cross_align = node.get("crossAlign")
        if cross_align is not None:
            allowed_cross = {"top", "start", "flex-start", "bottom", "end", "flex-end", "center", "stretch", "baseline"}
            if not isinstance(cross_align, str) or cross_align.lower() not in allowed_cross:
                errors.append({"path": f"{path}.crossAlign", "message": "Unsupported row crossAlign value"})

        wrap = node.get("wrap")
        if wrap is not None:
            if not isinstance(wrap, str) or wrap.lower() not in {"wrap", "nowrap", "wrap-reverse"}:
                errors.append({"path": f"{path}.wrap", "message": "Unsupported row wrap value"})

        gap = node.get("gap")
        if gap is not None and not isinstance(gap, (int, float)):
            errors.append({"path": f"{path}.gap", "message": "Row gap must be a number"})

    @classmethod
    def _validate_action(
        cls,
        action: dict[str, Any] | None,
        path: str,
        errors: list[dict[str, str]],
    ) -> None:
        if action is None:
            return

        action_type = action.get("type")
        if action_type not in cls.ACTION_TYPES:
            errors.append({"path": path, "message": f"Unknown action type: {action_type}"})
            return

        if action_type == "log":
            value = action.get("value")
            if not isinstance(value, str) or not value.strip():
                errors.append({"path": path, "message": "Log action field 'value' is required"})

        if action_type == "open_url":
            url = action.get("url")
            if not isinstance(url, str) or not (url.startswith("http://") or url.startswith("https://")):
                errors.append({"path": path, "message": "open_url action field 'url' must start with http:// or https://"})

        if action_type == "navigate":
            route = action.get("route")
            if not isinstance(route, str) or not route.startswith("/"):
                errors.append({"path": path, "message": "navigate action field 'route' must start with '/'"})

    @staticmethod
    def _to_float(value: Any, fallback: float) -> float:
        if isinstance(value, (int, float)):
            return float(value)
        return fallback


class RequestHandler(BaseHTTPRequestHandler):
    server_version = "NodusBDUIWeb/0.1"

    def do_GET(self) -> None:  # noqa: N802
        if self.path == "/api/health":
            self._json_response(HTTPStatus.OK, {"status": "ok", "service": "nodus-bdui-web"})
            return

        if self.path == "/":
            self._serve_file("index.html")
            return

        relative_path = self.path.lstrip("/")
        if not relative_path:
            relative_path = "index.html"

        self._serve_file(relative_path)

    def do_POST(self) -> None:  # noqa: N802
        if self.path != "/api/decode-validate":
            self._json_response(HTTPStatus.NOT_FOUND, {"error": "Not found"})
            return

        content_length = int(self.headers.get("Content-Length", "0"))
        raw_body = self.rfile.read(content_length)

        try:
            payload = json.loads(raw_body.decode("utf-8") or "{}")
        except json.JSONDecodeError as exc:
            self._json_response(HTTPStatus.BAD_REQUEST, {"error": f"Invalid JSON body: {exc}"})
            return

        schema = payload.get("schema", payload)
        if isinstance(schema, str):
            try:
                schema = json.loads(schema)
            except json.JSONDecodeError as exc:
                self._json_response(
                    HTTPStatus.OK,
                    {
                        "ok": False,
                        "node": None,
                        "decodeErrors": [{"path": "$", "message": f"Invalid schema JSON: {exc}"}],
                        "validationErrors": [],
                    },
                )
                return

        result = BduiRuntime.decode_validate(schema)
        self._json_response(HTTPStatus.OK, result)

    def _serve_file(self, relative_path: str) -> None:
        clean_path = relative_path.split("?", 1)[0]
        file_path = (WEB_DIR / clean_path).resolve()

        try:
            file_path.relative_to(WEB_DIR)
        except ValueError:
            self._json_response(HTTPStatus.FORBIDDEN, {"error": "Forbidden"})
            return

        if not file_path.exists() or not file_path.is_file():
            self._json_response(HTTPStatus.NOT_FOUND, {"error": "Not found"})
            return

        content_type = mimetypes.guess_type(str(file_path))[0] or "application/octet-stream"
        data = file_path.read_bytes()

        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _json_response(self, status_code: HTTPStatus, payload: dict[str, Any]) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format_string: str, *args: Any) -> None:
        return


def main() -> None:
    parser = argparse.ArgumentParser(description="Nodus BDUI web-first development server")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8080)
    args = parser.parse_args()

    server = ThreadingHTTPServer((args.host, args.port), RequestHandler)
    print(f"Nodus BDUI server running at http://{args.host}:{args.port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
