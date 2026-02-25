#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import logging
import mimetypes
import os
import re
import threading
import time
import uuid
from datetime import datetime, timedelta, timezone
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, unquote, urlparse

from runtime_core import decode_validate as runtime_decode_validate
from runtime_core.models import ALLOWED_SCHEMA_VERSIONS, normalize_schema_version

WEB_DIR = Path(__file__).resolve().parent / "web"
DATA_DIR = Path(os.getenv("NODUS_DATA_DIR", str(Path(__file__).resolve().parent / "data"))).resolve()
COMPONENTS_WRITE_TOKEN = str(os.getenv("NODUS_COMPONENTS_WRITE_TOKEN", "dev-components-token")).strip()

logging.basicConfig(level=logging.INFO, format="%(message)s")
LOGGER = logging.getLogger("nodus-bdui-web")


class ApiError(Exception):
    def __init__(self, status: HTTPStatus, message: str, code: str = "api_error", details: Any | None = None):
        super().__init__(message)
        self.status = status
        self.message = message
        self.code = code
        self.details = details


class BduiRuntime:
    NODE_TYPES = {"column", "row", "box", "text", "button", "iconbutton", "spacer", "input"}
    ACTION_TYPES = {"log", "open_url", "navigate"}

    @classmethod
    def decode_validate(
        cls,
        schema: Any,
        schema_rules_profile: str = "v0_2_strict",
        schema_version: str | None = None,
    ) -> dict[str, Any]:
        return runtime_decode_validate(
            schema,
            schema_rules_profile=schema_rules_profile,
            schema_version=schema_version,
        )

    @classmethod
    def _decode_node(cls, source: Any, path: str, errors: list[dict[str, str]]) -> dict[str, Any] | None:
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
        if "visible" in source:
            node["visible"] = source.get("visible")
        elif "viible" in source:
            # Backward-compatible alias for typo in payloads.
            node["visible"] = source.get("viible")
        if "enabled" in source:
            node["enabled"] = source.get("enabled")

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
    def _decode_children(cls, source: Any, path: str, errors: list[dict[str, str]]) -> list[dict[str, Any]]:
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
    def _decode_layout(cls, source: Any, path: str, errors: list[dict[str, str]]) -> dict[str, Any] | None:
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
    def _decode_spacing(cls, source: Any, path: str, errors: list[dict[str, str]]) -> dict[str, float]:
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
    def _decode_action(cls, source: Any, path: str, errors: list[dict[str, str]]) -> dict[str, Any] | None:
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
    def _validate_node(cls, node: dict[str, Any], path: str, errors: list[dict[str, str]], seen_ids: set[str]) -> None:
        if "visible" in node and not isinstance(node.get("visible"), bool):
            errors.append({"path": f"{path}.visible", "message": "Node field 'visible' must be boolean"})
        if "enabled" in node and not isinstance(node.get("enabled"), bool):
            errors.append({"path": f"{path}.enabled", "message": "Node field 'enabled' must be boolean"})

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
    def _validate_row(cls, node: dict[str, Any], path: str, errors: list[dict[str, str]]) -> None:
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
    def _validate_action(cls, action: dict[str, Any] | None, path: str, errors: list[dict[str, str]]) -> None:
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
            normalized_route = route.strip() if isinstance(route, str) else ""
            if not normalized_route:
                errors.append({"path": path, "message": "navigate action field 'route' is required"})
                return
            if normalized_route != "back" and not normalized_route.startswith("/"):
                errors.append({"path": path, "message": "navigate action field 'route' must be '/path' or 'back'"})

    @staticmethod
    def _to_float(value: Any, fallback: float) -> float:
        if isinstance(value, (int, float)):
            return float(value)
        return fallback


class Metrics:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self.requests_total = 0
        self.errors_total = 0
        self.publish_total = 0
        self.by_route: dict[str, int] = {}

    def inc_request(self, method: str, path: str) -> None:
        route = f"{method} {path}"
        with self._lock:
            self.requests_total += 1
            self.by_route[route] = self.by_route.get(route, 0) + 1

    def inc_error(self) -> None:
        with self._lock:
            self.errors_total += 1

    def inc_publish(self) -> None:
        with self._lock:
            self.publish_total += 1

    def snapshot(self) -> dict[str, Any]:
        with self._lock:
            return {
                "requests_total": self.requests_total,
                "errors_total": self.errors_total,
                "publish_total": self.publish_total,
                "routes": dict(self.by_route),
            }


metrics = Metrics()


class RegistryStorage:
    SLUG_RE = re.compile(r"^[a-z0-9][a-z0-9-_]{0,62}$")
    PUBLICATION_RETENTION_DAYS = 31
    DEFAULT_SCHEMA_VERSION = "v0_2"

    def __init__(self, base_dir: Path):
        self.base_dir = base_dir
        self.projects_dir = self.base_dir / "projects"
        self.components_dir = self.base_dir / "components"
        self.projects_dir.mkdir(parents=True, exist_ok=True)
        self.components_dir.mkdir(parents=True, exist_ok=True)
        self.cleanup_old_publications()

    @staticmethod
    def _now_iso() -> str:
        return datetime.now(tz=timezone.utc).isoformat()

    @staticmethod
    def _load_json(path: Path, fallback: Any = None) -> Any:
        if not path.exists():
            return fallback
        return json.loads(path.read_text(encoding="utf-8"))

    @staticmethod
    def _dump_json(path: Path, payload: Any) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    @staticmethod
    def _parse_iso_datetime(value: str | None) -> datetime | None:
        if not value or not isinstance(value, str):
            return None
        try:
            normalized = value.replace("Z", "+00:00")
            parsed = datetime.fromisoformat(normalized)
            if parsed.tzinfo is None:
                return parsed.replace(tzinfo=timezone.utc)
            return parsed.astimezone(timezone.utc)
        except Exception:
            return None

    def _normalize_schema_version(self, value: Any, fallback: str | None = None) -> str:
        normalized_fallback = fallback or self.DEFAULT_SCHEMA_VERSION
        raw = str(value or "").strip()
        if raw:
            normalized = normalize_schema_version(raw, fallback="")
            if normalized not in ALLOWED_SCHEMA_VERSIONS:
                raise ApiError(
                    HTTPStatus.BAD_REQUEST,
                    f"schema_version must be one of {sorted(ALLOWED_SCHEMA_VERSIONS)}",
                    code="invalid_schema_version",
                )
            return normalized
        normalized = normalize_schema_version("", fallback=normalized_fallback)
        if normalized not in ALLOWED_SCHEMA_VERSIONS:
            raise ApiError(
                HTTPStatus.BAD_REQUEST,
                f"schema_version must be one of {sorted(ALLOWED_SCHEMA_VERSIONS)}",
                code="invalid_schema_version",
            )
        return normalized

    @staticmethod
    def _schema_profile_for_version(schema_version: str) -> str:
        return "v0_2_strict" if schema_version == "v0_2" else "v0_1_default"

    def _extract_schema_version_from_content(self, content_json: Any) -> str | None:
        if isinstance(content_json, dict) and isinstance(content_json.get("schemaVersion"), str):
            return self._normalize_schema_version(content_json.get("schemaVersion"), fallback="v0_2")
        return None

    def _ensure_content_schema_version(self, content_json: Any, schema_version: str) -> Any:
        if isinstance(content_json, dict):
            patched = dict(content_json)
            patched["schemaVersion"] = schema_version
            return patched
        return content_json

    @staticmethod
    def _deep_merge_dicts(base: dict[str, Any], patch: dict[str, Any]) -> dict[str, Any]:
        merged = dict(base)
        for key, value in patch.items():
            existing = merged.get(key)
            if isinstance(existing, dict) and isinstance(value, dict):
                merged[key] = RegistryStorage._deep_merge_dicts(existing, value)
            else:
                merged[key] = value
        return merged

    def _validate_slug(self, value: str, field_name: str) -> str:
        if not isinstance(value, str):
            raise ApiError(HTTPStatus.BAD_REQUEST, f"{field_name} must be a string")
        normalized = value.strip().lower()
        if not normalized or not self.SLUG_RE.match(normalized):
            raise ApiError(
                HTTPStatus.BAD_REQUEST,
                f"{field_name} must match ^[a-z0-9][a-z0-9-_]{{0,62}}$",
            )
        return normalized

    def _project_dir(self, project_id: str) -> Path:
        return self.projects_dir / self._validate_slug(project_id, "project_id")

    def _contract_dir(self, project_id: str, contract_id: str) -> Path:
        return self._project_dir(project_id) / "contracts" / self._validate_slug(contract_id, "contract_id")

    def _version_dir(self, project_id: str, contract_id: str, version_id: str) -> Path:
        return self._contract_dir(project_id, contract_id) / "versions" / self._validate_slug(version_id, "version_id")

    def _draft_screens_dir(self, project_id: str, contract_id: str, version_id: str) -> Path:
        return self._version_dir(project_id, contract_id, version_id) / "draft" / "screens"

    def _draft_manifest_path(self, project_id: str, contract_id: str, version_id: str) -> Path:
        return self._version_dir(project_id, contract_id, version_id) / "draft" / "manifest.json"

    def _version_meta_path(self, project_id: str, contract_id: str, version_id: str) -> Path:
        return self._version_dir(project_id, contract_id, version_id) / "meta.json"

    def _ensure_project(self, project_id: str) -> None:
        path = self._project_dir(project_id) / "meta.json"
        if not path.exists():
            raise ApiError(HTTPStatus.NOT_FOUND, f"Project not found: {project_id}")

    def _ensure_contract(self, project_id: str, contract_id: str) -> None:
        path = self._contract_dir(project_id, contract_id) / "meta.json"
        if not path.exists():
            raise ApiError(HTTPStatus.NOT_FOUND, f"Contract not found: {project_id}/{contract_id}")

    def _ensure_version(self, project_id: str, contract_id: str, version_id: str) -> None:
        path = self._version_meta_path(project_id, contract_id, version_id)
        if not path.exists():
            raise ApiError(HTTPStatus.NOT_FOUND, f"Version not found: {project_id}/{contract_id}/{version_id}")

    def _component_file(self, component_type: str) -> Path:
        ctype = self._validate_slug(component_type, "component_type")
        return self.components_dir / f"{ctype}.json"

    @staticmethod
    def _normalize_locale_field(value: Any, fallback: str = "") -> dict[str, str]:
        if isinstance(value, dict):
            ru = str(value.get("ru") or fallback).strip()
            en = str(value.get("en") or fallback).strip()
            return {"ru": ru, "en": en}
        text = str(value or fallback).strip()
        return {"ru": text, "en": text}

    def _normalize_component_payload(
        self,
        payload: dict[str, Any],
        component_type: str | None = None,
    ) -> dict[str, Any]:
        if not isinstance(payload, dict):
            raise ApiError(HTTPStatus.BAD_REQUEST, "Component payload must be an object")

        raw_type = component_type if component_type is not None else payload.get("type")
        ctype = self._validate_slug(str(raw_type or ""), "component_type")

        mode_value = payload.get("mode")
        mode: str | None = None
        if isinstance(mode_value, str) and mode_value.strip():
            normalized_mode = mode_value.strip().lower()
            if normalized_mode != "replace-schema":
                raise ApiError(HTTPStatus.BAD_REQUEST, "component mode must be replace-schema")
            mode = "replace-schema"

        template = payload.get("template", {})
        if template is None:
            template = {}

        result: dict[str, Any] = {
            "type": ctype,
            "title": self._normalize_locale_field(payload.get("title"), ctype),
            "description": self._normalize_locale_field(payload.get("description"), ctype),
            "fields": self._normalize_locale_field(payload.get("fields"), ""),
            "template": template,
            "updated_by": str(payload.get("updated_by") or "system"),
        }
        change_note = str(payload.get("change_note") or "").strip()
        if change_note:
            result["change_note"] = change_note
        if mode:
            result["mode"] = mode
        return result

    def list_components(self) -> list[dict[str, Any]]:
        items: list[dict[str, Any]] = []
        for component_file in sorted(self.components_dir.glob("*.json")):
            payload = self._load_json(component_file, {})
            if not isinstance(payload, dict):
                continue
            try:
                normalized = self._normalize_component_payload(payload, component_type=component_file.stem)
            except ApiError:
                continue

            created_at = payload.get("created_at")
            updated_at = payload.get("updated_at")
            if created_at:
                normalized["created_at"] = created_at
            if updated_at:
                normalized["updated_at"] = updated_at
            if payload.get("updated_by"):
                normalized["updated_by"] = payload.get("updated_by")
            if payload.get("change_note"):
                normalized["change_note"] = payload.get("change_note")
            items.append(normalized)
        return items

    def create_component(self, payload: dict[str, Any]) -> dict[str, Any]:
        normalized = self._normalize_component_payload(payload)
        path = self._component_file(str(normalized.get("type") or ""))
        if path.exists():
            raise ApiError(HTTPStatus.CONFLICT, f"Component already exists: {normalized['type']}")

        now = self._now_iso()
        normalized["created_at"] = now
        normalized["updated_at"] = now
        self._dump_json(path, normalized)
        return normalized

    def upsert_component(self, component_type: str, payload: dict[str, Any]) -> dict[str, Any]:
        path = self._component_file(component_type)
        existing = self._load_json(path, {}) if path.exists() else {}
        merged: dict[str, Any] = {}
        if isinstance(existing, dict):
            merged.update(existing)
        if isinstance(payload, dict):
            merged.update(payload)
        merged["type"] = path.stem

        normalized = self._normalize_component_payload(merged, component_type=path.stem)
        now = self._now_iso()
        normalized["created_at"] = str(existing.get("created_at") or now) if isinstance(existing, dict) else now
        normalized["updated_at"] = now
        self._dump_json(path, normalized)
        return normalized

    def delete_component(self, component_type: str) -> dict[str, Any]:
        path = self._component_file(component_type)
        if not path.exists():
            raise ApiError(HTTPStatus.NOT_FOUND, f"Component not found: {path.stem}")
        path.unlink(missing_ok=True)
        return {"type": path.stem, "deleted": True}

    def export_components(self) -> dict[str, Any]:
        return {
            "exported_at": self._now_iso(),
            "items": self.list_components(),
        }

    def import_components(
        self,
        payload: dict[str, Any],
        strategy: str,
        requested_by: str = "system",
        change_note: str = "",
    ) -> dict[str, Any]:
        mode = str(strategy or "").strip().lower()
        if mode not in {"skip", "overwrite", "merge"}:
            raise ApiError(HTTPStatus.BAD_REQUEST, "strategy must be skip|overwrite|merge", code="invalid_strategy")

        raw_items = payload.get("items")
        if not isinstance(raw_items, list):
            raise ApiError(HTTPStatus.BAD_REQUEST, "import payload must contain array field 'items'", code="invalid_import_payload")

        summary = {"created": 0, "updated": 0, "skipped": 0, "failed": 0, "errors": []}

        for index, raw in enumerate(raw_items):
            try:
                if not isinstance(raw, dict):
                    raise ApiError(HTTPStatus.BAD_REQUEST, f"items[{index}] must be an object", code="invalid_component_payload")

                incoming = dict(raw)
                incoming["updated_by"] = str(raw.get("updated_by") or requested_by or "system")
                if change_note and not incoming.get("change_note"):
                    incoming["change_note"] = change_note

                normalized = self._normalize_component_payload(incoming)
                path = self._component_file(str(normalized.get("type") or ""))
                exists = path.exists()

                if exists and mode == "skip":
                    summary["skipped"] += 1
                    continue

                if exists and mode == "merge":
                    existing = self._load_json(path, {})
                    if not isinstance(existing, dict):
                        existing = {}
                    merged_payload = self._deep_merge_dicts(existing, incoming)
                    merged_payload["type"] = path.stem
                    normalized = self._normalize_component_payload(merged_payload, component_type=path.stem)

                if exists:
                    self.upsert_component(path.stem, normalized)
                    summary["updated"] += 1
                else:
                    self.create_component(normalized)
                    summary["created"] += 1
            except ApiError as exc:
                summary["failed"] += 1
                summary["errors"].append({"index": index, "error": exc.message, "code": exc.code})

        return {
            "strategy": mode,
            "requested_by": requested_by,
            "summary": summary,
            "updated_at": self._now_iso(),
        }

    def list_projects(self) -> list[dict[str, Any]]:
        projects: list[dict[str, Any]] = []
        for project_dir in sorted(self.projects_dir.glob("*")):
            meta_path = project_dir / "meta.json"
            if not meta_path.exists():
                continue
            projects.append(self._load_json(meta_path, {}))
        return projects

    def create_project(self, payload: dict[str, Any]) -> dict[str, Any]:
        project_id = self._validate_slug(payload.get("project_id") or payload.get("id") or "", "project_id")
        name = str(payload.get("name") or project_id)
        status = str(payload.get("status") or "active")

        meta_path = self._project_dir(project_id) / "meta.json"
        if meta_path.exists():
            raise ApiError(HTTPStatus.CONFLICT, f"Project already exists: {project_id}")

        meta = {
            "project_id": project_id,
            "name": name,
            "status": status,
            "created_at": self._now_iso(),
            "updated_at": self._now_iso(),
        }
        self._dump_json(meta_path, meta)
        return meta

    def list_contracts(self, project_id: str) -> list[dict[str, Any]]:
        self._ensure_project(project_id)
        root = self._project_dir(project_id) / "contracts"
        if not root.exists():
            return []

        contracts: list[dict[str, Any]] = []
        for contract_dir in sorted(root.glob("*")):
            meta_path = contract_dir / "meta.json"
            if meta_path.exists():
                contracts.append(self._load_json(meta_path, {}))
        return contracts

    def create_contract(self, payload: dict[str, Any]) -> dict[str, Any]:
        project_id = self._validate_slug(payload.get("project_id") or "", "project_id")
        self._ensure_project(project_id)

        contract_id = self._validate_slug(payload.get("contract_id") or payload.get("id") or "", "contract_id")
        name = str(payload.get("name") or contract_id)
        status = str(payload.get("status") or "active")

        meta_path = self._contract_dir(project_id, contract_id) / "meta.json"
        if meta_path.exists():
            raise ApiError(HTTPStatus.CONFLICT, f"Contract already exists: {contract_id}")

        meta = {
            "project_id": project_id,
            "contract_id": contract_id,
            "name": name,
            "description": str(payload.get("description") or ""),
            "status": status,
            "created_at": self._now_iso(),
            "updated_at": self._now_iso(),
        }
        self._dump_json(meta_path, meta)
        return meta

    def list_versions(self, project_id: str, contract_id: str) -> list[dict[str, Any]]:
        self._ensure_contract(project_id, contract_id)
        root = self._contract_dir(project_id, contract_id) / "versions"
        if not root.exists():
            return []

        versions: list[dict[str, Any]] = []
        for version_dir in sorted(root.glob("*")):
            meta_path = version_dir / "meta.json"
            if meta_path.exists():
                versions.append(self._load_json(meta_path, {}))
        return versions

    def _copy_parent_screens(self, project_id: str, contract_id: str, parent_version_id: str, version_id: str) -> None:
        parent_dir = self._draft_screens_dir(project_id, contract_id, parent_version_id)
        target_dir = self._draft_screens_dir(project_id, contract_id, version_id)
        target_dir.mkdir(parents=True, exist_ok=True)
        if not parent_dir.exists():
            return

        for screen_file in parent_dir.glob("*.json"):
            screen_payload = self._load_json(screen_file, {})
            screen_payload["updated_at"] = self._now_iso()
            self._dump_json(target_dir / screen_file.name, screen_payload)

        self._rebuild_draft_manifest(project_id, contract_id, version_id)

    def create_version(self, payload: dict[str, Any]) -> dict[str, Any]:
        project_id = self._validate_slug(payload.get("project_id") or "", "project_id")
        contract_id = self._validate_slug(payload.get("contract_id") or "", "contract_id")
        self._ensure_contract(project_id, contract_id)

        version_id = self._validate_slug(payload.get("version_id") or payload.get("id") or "", "version_id")
        based_on_version_id = payload.get("based_on_version_id")
        if based_on_version_id is not None:
            based_on_version_id = self._validate_slug(str(based_on_version_id), "based_on_version_id")
            self._ensure_version(project_id, contract_id, based_on_version_id)

        meta_path = self._version_meta_path(project_id, contract_id, version_id)
        if meta_path.exists():
            raise ApiError(HTTPStatus.CONFLICT, f"Version already exists: {version_id}")

        default_schema_version = self._normalize_schema_version(payload.get("default_schema_version"), fallback=self.DEFAULT_SCHEMA_VERSION)
        schema_rules_profile = str(payload.get("schema_rules_profile") or self._schema_profile_for_version(default_schema_version))

        meta = {
            "project_id": project_id,
            "contract_id": contract_id,
            "version_id": version_id,
            "based_on_version_id": based_on_version_id,
            "schema_rules_profile": schema_rules_profile,
            "default_schema_version": default_schema_version,
            "renderer_profile": str(payload.get("renderer_profile") or "web_v0_1"),
            "status": str(payload.get("status") or "draft"),
            "created_at": self._now_iso(),
            "updated_at": self._now_iso(),
        }
        self._dump_json(meta_path, meta)

        if based_on_version_id:
            self._copy_parent_screens(project_id, contract_id, based_on_version_id, version_id)
        else:
            self._rebuild_draft_manifest(project_id, contract_id, version_id)

        return meta

    def _screen_file(self, project_id: str, contract_id: str, version_id: str, screen_id: str) -> Path:
        sid = self._validate_slug(screen_id, "screen_id")
        return self._draft_screens_dir(project_id, contract_id, version_id) / f"{sid}.json"

    def _version_meta(self, project_id: str, contract_id: str, version_id: str) -> dict[str, Any]:
        return self._load_json(self._version_meta_path(project_id, contract_id, version_id), {})

    def _default_schema_version_for_version(self, project_id: str, contract_id: str, version_id: str) -> str:
        meta = self._version_meta(project_id, contract_id, version_id)
        return self._normalize_schema_version(meta.get("default_schema_version"), fallback="v0_2")

    def list_screens(self, project_id: str, contract_id: str, version_id: str, include_deleted: bool = False) -> list[dict[str, Any]]:
        self._ensure_version(project_id, contract_id, version_id)
        root = self._draft_screens_dir(project_id, contract_id, version_id)
        if not root.exists():
            return []

        items: list[dict[str, Any]] = []
        default_schema_version = self._default_schema_version_for_version(project_id, contract_id, version_id)
        for screen_file in sorted(root.glob("*.json")):
            payload = self._load_json(screen_file, {})
            status = str(payload.get("status") or "active")
            if status == "deleted" and not include_deleted:
                continue
            schema_version = payload.get("schema_version") or self._extract_schema_version_from_content(payload.get("content_json"))
            payload["schema_version"] = self._normalize_schema_version(schema_version, fallback=default_schema_version)
            items.append(payload)
        return items

    def get_screen(self, project_id: str, contract_id: str, version_id: str, screen_id: str) -> dict[str, Any]:
        self._ensure_version(project_id, contract_id, version_id)
        path = self._screen_file(project_id, contract_id, version_id, screen_id)
        if not path.exists():
            raise ApiError(HTTPStatus.NOT_FOUND, f"Screen not found: {screen_id}")
        payload = self._load_json(path, {})
        default_schema_version = self._default_schema_version_for_version(project_id, contract_id, version_id)
        schema_version = payload.get("schema_version") or self._extract_schema_version_from_content(payload.get("content_json"))
        payload["schema_version"] = self._normalize_schema_version(schema_version, fallback=default_schema_version)
        return payload

    def create_screen(self, payload: dict[str, Any]) -> dict[str, Any]:
        project_id = self._validate_slug(payload.get("project_id") or "", "project_id")
        contract_id = self._validate_slug(payload.get("contract_id") or "", "contract_id")
        version_id = self._validate_slug(payload.get("version_id") or "", "version_id")
        self._ensure_version(project_id, contract_id, version_id)

        screen_id = self._validate_slug(payload.get("screen_id") or payload.get("id") or "", "screen_id")
        path = self._screen_file(project_id, contract_id, version_id, screen_id)
        if path.exists():
            raise ApiError(HTTPStatus.CONFLICT, f"Screen already exists: {screen_id}")

        default_schema_version = self._default_schema_version_for_version(project_id, contract_id, version_id)
        schema_version = self._normalize_schema_version(payload.get("schema_version"), fallback=default_schema_version)
        content_json = payload.get("content_json")
        content_raw = payload.get("content_raw")
        content_parse_error = None
        if content_raw is not None:
            content_raw = str(content_raw)
            try:
                content_json = json.loads(content_raw)
                extracted = self._extract_schema_version_from_content(content_json)
                if extracted:
                    schema_version = extracted
            except json.JSONDecodeError as exc:
                content_json = None
                content_parse_error = f"Invalid schema JSON: {exc}"
        elif content_json is None:
            content_json = {
                "schemaVersion": schema_version,
                "type": "column",
                "id": "form",
                "layout": {"padding": {"top": 8, "right": 8, "bottom": 8, "left": 8}},
                "children": [],
            }
            content_raw = json.dumps(content_json, ensure_ascii=False, indent=2) + "\n"
        else:
            extracted = self._extract_schema_version_from_content(content_json)
            if extracted:
                schema_version = extracted
            content_json = self._ensure_content_schema_version(content_json, schema_version)
            content_raw = json.dumps(content_json, ensure_ascii=False, indent=2) + "\n"

        if content_json is not None:
            content_json = self._ensure_content_schema_version(content_json, schema_version)
            content_raw = json.dumps(content_json, ensure_ascii=False, indent=2) + "\n"

        record = {
            "project_id": project_id,
            "contract_id": contract_id,
            "version_id": version_id,
            "screen_id": screen_id,
            "name": str(payload.get("name") or screen_id),
            "status": str(payload.get("status") or "active"),
            "schema_version": schema_version,
            "content_json": content_json,
            "content_raw": content_raw,
            "content_parse_error": content_parse_error,
            "updated_at": self._now_iso(),
        }
        self._dump_json(path, record)
        self._rebuild_draft_manifest(project_id, contract_id, version_id)
        return record

    def update_screen(
        self,
        project_id: str,
        contract_id: str,
        version_id: str,
        screen_id: str,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        record = self.get_screen(project_id, contract_id, version_id, screen_id)
        default_schema_version = self._default_schema_version_for_version(project_id, contract_id, version_id)
        schema_version = self._normalize_schema_version(record.get("schema_version"), fallback=default_schema_version)
        if "schema_version" in payload:
            schema_version = self._normalize_schema_version(payload.get("schema_version"), fallback=schema_version)

        if "name" in payload:
            record["name"] = str(payload.get("name") or record.get("name") or screen_id)
        if "content_raw" in payload:
            content_raw = str(payload.get("content_raw") or "")
            record["content_raw"] = content_raw
            try:
                parsed_content = json.loads(content_raw)
                extracted = self._extract_schema_version_from_content(parsed_content)
                if extracted:
                    schema_version = extracted
                parsed_content = self._ensure_content_schema_version(parsed_content, schema_version)
                record["content_json"] = parsed_content
                record["content_raw"] = json.dumps(parsed_content, ensure_ascii=False, indent=2) + "\n"
                record["content_parse_error"] = None
            except json.JSONDecodeError as exc:
                record["content_json"] = None
                record["content_parse_error"] = f"Invalid schema JSON: {exc}"
        elif "content_json" in payload:
            incoming_content = payload.get("content_json")
            extracted = self._extract_schema_version_from_content(incoming_content)
            if extracted:
                schema_version = extracted
            incoming_content = self._ensure_content_schema_version(incoming_content, schema_version)
            record["content_json"] = incoming_content
            record["content_raw"] = json.dumps(incoming_content, ensure_ascii=False, indent=2) + "\n"
            record["content_parse_error"] = None
        if "status" in payload:
            record["status"] = str(payload.get("status") or record.get("status") or "active")
        record["schema_version"] = schema_version
        if record.get("content_json") is not None:
            content = self._ensure_content_schema_version(record.get("content_json"), schema_version)
            record["content_json"] = content
            record["content_raw"] = json.dumps(content, ensure_ascii=False, indent=2) + "\n"
        record["updated_at"] = self._now_iso()

        path = self._screen_file(project_id, contract_id, version_id, screen_id)
        self._dump_json(path, record)
        self._rebuild_draft_manifest(project_id, contract_id, version_id)
        return record

    def patch_screen_status(
        self,
        project_id: str,
        contract_id: str,
        version_id: str,
        screen_id: str,
        status: str,
    ) -> dict[str, Any]:
        status_value = str(status or "").strip().lower()
        if status_value not in {"active", "inactive", "deleted"}:
            raise ApiError(HTTPStatus.BAD_REQUEST, "status must be active|inactive|deleted")
        return self.update_screen(
            project_id,
            contract_id,
            version_id,
            screen_id,
            {"status": status_value},
        )

    def _rebuild_draft_manifest(self, project_id: str, contract_id: str, version_id: str) -> None:
        screens = self.list_screens(project_id, contract_id, version_id, include_deleted=True)
        screens_manifest = [
            {
                "screen_id": screen.get("screen_id"),
                "name": screen.get("name"),
                "status": screen.get("status"),
                "schema_version": screen.get("schema_version"),
                "updated_at": screen.get("updated_at"),
            }
            for screen in screens
        ]

        manifest = {
            "project_id": project_id,
            "contract_id": contract_id,
            "version_id": version_id,
            "updated_at": self._now_iso(),
            "screens": screens_manifest,
        }
        self._dump_json(self._draft_manifest_path(project_id, contract_id, version_id), manifest)

    def publish_version(self, payload: dict[str, Any]) -> dict[str, Any]:
        project_id = self._validate_slug(payload.get("project_id") or "", "project_id")
        contract_id = self._validate_slug(payload.get("contract_id") or "", "contract_id")
        version_id = self._validate_slug(payload.get("version_id") or "", "version_id")
        self._ensure_version(project_id, contract_id, version_id)

        version_meta = self._load_json(self._version_meta_path(project_id, contract_id, version_id), {})
        default_schema_version = self._normalize_schema_version(version_meta.get("default_schema_version"), fallback="v0_2")

        screens = [
            item for item in self.list_screens(project_id, contract_id, version_id, include_deleted=False) if item.get("status") == "active"
        ]
        validation_errors: list[dict[str, Any]] = []
        for screen in screens:
            screen_schema_version = self._normalize_schema_version(screen.get("schema_version"), fallback=default_schema_version)
            schema_rules_profile = self._schema_profile_for_version(screen_schema_version)
            if screen.get("content_parse_error"):
                validation_errors.append(
                    {
                        "screen_id": screen.get("screen_id"),
                        "schema_version": screen_schema_version,
                        "decodeErrors": [{"path": "$", "message": str(screen.get("content_parse_error"))}],
                        "validationErrors": [],
                    }
                )
                continue

            result = BduiRuntime.decode_validate(
                screen.get("content_json"),
                schema_rules_profile=schema_rules_profile,
                schema_version=screen_schema_version,
            )
            if not result.get("ok"):
                validation_errors.append(
                    {
                        "screen_id": screen.get("screen_id"),
                        "schema_version": screen_schema_version,
                        "appliedSchemaVersion": result.get("appliedSchemaVersion"),
                        "decodeErrors": result.get("decodeErrors", []),
                        "validationErrors": result.get("validationErrors", []),
                    }
                )

        if validation_errors:
            raise ApiError(
                HTTPStatus.BAD_REQUEST,
                "publish blocked by validation errors",
                code="publish_validation_failed",
                details=validation_errors,
            )

        pub_id = datetime.now(tz=timezone.utc).strftime("pub-%Y%m%dT%H%M%S%fZ")
        published_root = self._version_dir(project_id, contract_id, version_id) / "published" / pub_id
        screens_root = published_root / "screens"
        screens_root.mkdir(parents=True, exist_ok=True)

        screens_manifest: list[dict[str, Any]] = []
        schema_versions: set[str] = set()
        for screen in screens:
            sid = self._validate_slug(str(screen.get("screen_id") or ""), "screen_id")
            screen_schema_version = self._normalize_schema_version(screen.get("schema_version"), fallback=default_schema_version)
            schema_versions.add(screen_schema_version)
            content = self._ensure_content_schema_version(screen.get("content_json"), screen_schema_version)
            self._dump_json(screens_root / f"{sid}.json", content)
            screens_manifest.append(
                {
                    "screen_id": sid,
                    "name": screen.get("name"),
                    "status": screen.get("status"),
                    "schema_version": screen_schema_version,
                    "updated_at": screen.get("updated_at"),
                    "schema_id": f"{project_id}:{contract_id}:{version_id}:{sid}",
                }
            )

        publication = {
            "pub_id": pub_id,
            "project_id": project_id,
            "contract_id": contract_id,
            "version_id": version_id,
            "schema_rules_profile": version_meta.get("schema_rules_profile", self._schema_profile_for_version(default_schema_version)),
            "default_schema_version": default_schema_version,
            "schema_versions": sorted(schema_versions),
            "renderer_profile": version_meta.get("renderer_profile", "web_v0_1"),
            "published_at": self._now_iso(),
            "screens": screens_manifest,
        }
        self._dump_json(published_root / "manifest.json", publication)

        version_meta["status"] = "published"
        version_meta["updated_at"] = self._now_iso()
        self._dump_json(self._version_meta_path(project_id, contract_id, version_id), version_meta)
        self.cleanup_old_publications()
        return publication

    def cleanup_old_publications(self) -> dict[str, int]:
        cutoff = datetime.now(tz=timezone.utc) - timedelta(days=self.PUBLICATION_RETENTION_DAYS)
        removed_count = 0

        for project_dir in sorted(self.projects_dir.glob("*")):
            contracts_root = project_dir / "contracts"
            for contract_dir in sorted(contracts_root.glob("*")) if contracts_root.exists() else []:
                versions_root = contract_dir / "versions"
                for version_dir in sorted(versions_root.glob("*")) if versions_root.exists() else []:
                    published_root = version_dir / "published"
                    if not published_root.exists():
                        continue

                    for pub_dir in sorted((item for item in published_root.glob("*") if item.is_dir())):
                        manifest_path = pub_dir / "manifest.json"
                        published_at: datetime | None = None

                        if manifest_path.exists():
                            manifest = self._load_json(manifest_path, {})
                            published_at = self._parse_iso_datetime(manifest.get("published_at"))

                        if published_at is None:
                            published_at = datetime.fromtimestamp(pub_dir.stat().st_mtime, tz=timezone.utc)

                        if published_at < cutoff:
                            for path in sorted(pub_dir.rglob("*"), reverse=True):
                                if path.is_file():
                                    path.unlink(missing_ok=True)
                                elif path.is_dir():
                                    path.rmdir()
                            pub_dir.rmdir()
                            removed_count += 1

        return {"removed_publications": removed_count}

    def list_published_schemas(self, project_id: str | None, contract_id: str | None, version_id: str | None) -> list[dict[str, Any]]:
        manifests: list[dict[str, Any]] = []

        for project_dir in sorted(self.projects_dir.glob("*")):
            pid = project_dir.name
            if project_id and pid != project_id:
                continue

            contracts_root = project_dir / "contracts"
            for contract_dir in sorted(contracts_root.glob("*")) if contracts_root.exists() else []:
                cid = contract_dir.name
                if contract_id and cid != contract_id:
                    continue

                versions_root = contract_dir / "versions"
                for version_dir in sorted(versions_root.glob("*")) if versions_root.exists() else []:
                    vid = version_dir.name
                    if version_id and vid != version_id:
                        continue

                    published_root = version_dir / "published"
                    if not published_root.exists():
                        continue

                    for pub_dir in sorted(published_root.glob("*"), reverse=True):
                        manifest_path = pub_dir / "manifest.json"
                        if manifest_path.exists():
                            manifests.append(self._load_json(manifest_path, {}))

        schemas: list[dict[str, Any]] = []
        for manifest in manifests:
            for screen in manifest.get("screens", []):
                schemas.append(
                    {
                        "schema_id": screen.get("schema_id"),
                        "project_id": manifest.get("project_id"),
                        "contract_id": manifest.get("contract_id"),
                        "version_id": manifest.get("version_id"),
                        "schema_version": screen.get("schema_version"),
                        "pub_id": manifest.get("pub_id"),
                        "screen_id": screen.get("screen_id"),
                        "name": screen.get("name"),
                        "published_at": manifest.get("published_at"),
                    }
                )
        return schemas

    def _find_manifest(
        self,
        project_id: str,
        contract_id: str,
        version_id: str,
        pub_id: str | None = None,
    ) -> dict[str, Any]:
        published_root = self._version_dir(project_id, contract_id, version_id) / "published"
        if not published_root.exists():
            raise ApiError(HTTPStatus.NOT_FOUND, "No published schema for selected version")

        if pub_id:
            pubid = str(pub_id).strip()
            if not pubid:
                raise ApiError(HTTPStatus.BAD_REQUEST, "pub_id is empty")
            manifest_path = published_root / pubid / "manifest.json"
            if not manifest_path.exists():
                raise ApiError(HTTPStatus.NOT_FOUND, f"Publish not found: {pubid}")
            return self._load_json(manifest_path, {})

        manifests = sorted((item for item in published_root.glob("*") if item.is_dir()), reverse=True)
        for pub_dir in manifests:
            manifest_path = pub_dir / "manifest.json"
            if manifest_path.exists():
                return self._load_json(manifest_path, {})

        raise ApiError(HTTPStatus.NOT_FOUND, "No published manifest found")

    def get_published_schema_by_parts(
        self,
        project_id: str,
        contract_id: str,
        version_id: str,
        screen_id: str,
        pub_id: str | None = None,
    ) -> dict[str, Any]:
        pid = self._validate_slug(project_id, "project_id")
        cid = self._validate_slug(contract_id, "contract_id")
        vid = self._validate_slug(version_id, "version_id")
        sid = self._validate_slug(screen_id, "screen_id")

        manifest = self._find_manifest(pid, cid, vid, pub_id=pub_id)
        resolved_pub_id = manifest.get("pub_id")
        if not resolved_pub_id:
            raise ApiError(HTTPStatus.NOT_FOUND, "Published artifact is invalid")

        schema_path = self._version_dir(pid, cid, vid) / "published" / str(resolved_pub_id) / "screens" / f"{sid}.json"
        if not schema_path.exists():
            raise ApiError(HTTPStatus.NOT_FOUND, f"Published screen not found: {sid}")

        return {
            "schema_id": f"{pid}:{cid}:{vid}:{sid}",
            "project_id": pid,
            "contract_id": cid,
            "version_id": vid,
            "schema_version": next(
                (
                    screen.get("schema_version")
                    for screen in manifest.get("screens", [])
                    if screen.get("screen_id") == sid
                ),
                manifest.get("default_schema_version"),
            ),
            "pub_id": resolved_pub_id,
            "screen_id": sid,
            "schema": self._load_json(schema_path, {}),
        }

    def get_published_schema_by_id(self, schema_id: str, pub_id: str | None = None) -> dict[str, Any]:
        parts = str(schema_id or "").split(":")
        if len(parts) != 4:
            raise ApiError(HTTPStatus.BAD_REQUEST, "schema id must be project:contract:version:screen")
        return self.get_published_schema_by_parts(parts[0], parts[1], parts[2], parts[3], pub_id=pub_id)


storage = RegistryStorage(DATA_DIR)


class RequestHandler(BaseHTTPRequestHandler):
    server_version = "NodusBDUIWeb/0.2"

    def do_GET(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        path = parsed.path
        query = parse_qs(parsed.query)
        self._prepare_request("GET", path)
        try:
            if path == "/api/health":
                self._json_response(HTTPStatus.OK, {"status": "ok", "service": "nodus-bdui-web"})
                return

            if path == "/metrics":
                snapshot = metrics.snapshot()
                route_lines = []
                for route, count in sorted(snapshot.get("routes", {}).items()):
                    escaped = route.replace("\\", "\\\\").replace('"', '\\"')
                    route_lines.append(f'nodus_requests_by_route{{route="{escaped}"}} {count}')
                lines = [
                    f"nodus_requests_total {snapshot.get('requests_total', 0)}",
                    f"nodus_errors_total {snapshot.get('errors_total', 0)}",
                    f"nodus_publish_total {snapshot.get('publish_total', 0)}",
                    *route_lines,
                    "",
                ]
                self._text_response(HTTPStatus.OK, "\n".join(lines), content_type="text/plain; version=0.0.4")
                return

            if path == "/api/projects":
                self._json_response(HTTPStatus.OK, {"items": storage.list_projects()})
                return

            if path == "/api/contracts":
                project_id = self._required_query(query, "project_id")
                self._json_response(HTTPStatus.OK, {"items": storage.list_contracts(project_id)})
                return

            if path == "/api/versions":
                project_id = self._required_query(query, "project_id")
                contract_id = self._required_query(query, "contract_id")
                self._json_response(HTTPStatus.OK, {"items": storage.list_versions(project_id, contract_id)})
                return

            if path == "/api/screens":
                project_id = self._required_query(query, "project_id")
                contract_id = self._required_query(query, "contract_id")
                version_id = self._required_query(query, "version_id")
                include_deleted = self._optional_query(query, "include_deleted") == "1"
                self._json_response(
                    HTTPStatus.OK,
                    {"items": storage.list_screens(project_id, contract_id, version_id, include_deleted=include_deleted)},
                )
                return

            if path == "/api/components":
                self._json_response(HTTPStatus.OK, {"items": storage.list_components()})
                return

            if path == "/api/components/export":
                self._json_response(HTTPStatus.OK, storage.export_components())
                return

            if path == "/schemas":
                project_id = self._optional_query(query, "project")
                contract_id = self._optional_query(query, "contract")
                version_id = self._optional_query(query, "version")
                self._json_response(HTTPStatus.OK, {"items": storage.list_published_schemas(project_id, contract_id, version_id)})
                return

            if path.startswith("/schema/"):
                tail = path[len("/schema/") :]
                parts = [unquote(part) for part in tail.split("/") if part]
                pub_id = self._optional_query(query, "pub_id")
                if len(parts) == 1:
                    payload = storage.get_published_schema_by_id(parts[0], pub_id=pub_id)
                elif len(parts) == 4:
                    payload = storage.get_published_schema_by_parts(parts[0], parts[1], parts[2], parts[3], pub_id=pub_id)
                else:
                    raise ApiError(
                        HTTPStatus.BAD_REQUEST,
                        "Use /schema/<id> or /schema/<project>/<contract>/<version>/<screen>",
                        code="invalid_schema_path",
                    )
                self._json_response(HTTPStatus.OK, payload)
                return

            if path == "/":
                self._serve_file("index.html")
                return

            relative_path = path.lstrip("/") or "index.html"
            self._serve_file(relative_path)
        except ApiError as exc:
            self._error_response(exc)
        except Exception as exc:
            self._error_response(ApiError(HTTPStatus.INTERNAL_SERVER_ERROR, f"Unhandled server error: {exc}", code="internal_error"))

    def do_POST(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        path = parsed.path
        query = parse_qs(parsed.query)
        self._prepare_request("POST", path)

        try:
            payload = self._read_json_body()

            if path == "/api/decode-validate":
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
                                "appliedSchemaVersion": "v0_2",
                            },
                        )
                        return

                schema_version = payload.get("schema_version") or payload.get("schemaVersion")
                if schema_version is None and isinstance(schema, dict):
                    schema_version = schema.get("schemaVersion")
                if schema_version:
                    normalized_explicit = normalize_schema_version(str(schema_version), fallback="")
                    if normalized_explicit not in ALLOWED_SCHEMA_VERSIONS:
                        raise ApiError(
                            HTTPStatus.BAD_REQUEST,
                            f"schema_version must be one of {sorted(ALLOWED_SCHEMA_VERSIONS)}",
                            code="invalid_schema_version",
                        )
                normalized_schema_version = normalize_schema_version(str(schema_version or ""), fallback="v0_2")
                schema_rules_profile = str(
                    payload.get("schema_rules_profile") or ("v0_1_default" if normalized_schema_version == "v0_1" else "v0_2_strict")
                )
                result = BduiRuntime.decode_validate(
                    schema,
                    schema_rules_profile=schema_rules_profile,
                    schema_version=schema_version if isinstance(schema_version, str) else None,
                )
                self._json_response(HTTPStatus.OK, result)
                return

            if path == "/api/projects":
                self._json_response(HTTPStatus.CREATED, storage.create_project(payload))
                return

            if path == "/api/contracts":
                self._json_response(HTTPStatus.CREATED, storage.create_contract(payload))
                return

            if path == "/api/versions":
                self._json_response(HTTPStatus.CREATED, storage.create_version(payload))
                return

            if path == "/api/screens":
                self._json_response(HTTPStatus.CREATED, storage.create_screen(payload))
                return

            if path == "/api/components":
                self._require_components_write_access()
                payload["updated_by"] = str(payload.get("updated_by") or self._actor())
                self._json_response(HTTPStatus.CREATED, storage.create_component(payload))
                return

            if path == "/api/components/import":
                self._require_components_write_access()
                strategy = self._optional_query(query, "strategy") or str(payload.get("strategy") or "skip")
                change_note = str(payload.get("change_note") or "")
                self._json_response(
                    HTTPStatus.OK,
                    storage.import_components(payload, strategy, requested_by=self._actor(), change_note=change_note),
                )
                return

            if path == "/api/publish":
                result = storage.publish_version(payload)
                metrics.inc_publish()
                self._json_response(HTTPStatus.OK, result)
                return

            self._error_response(ApiError(HTTPStatus.NOT_FOUND, "Not found", code="not_found"))
        except ApiError as exc:
            self._error_response(exc)
        except json.JSONDecodeError as exc:
            self._error_response(ApiError(HTTPStatus.BAD_REQUEST, f"Invalid JSON body: {exc}", code="invalid_json"))
        except Exception as exc:
            self._error_response(ApiError(HTTPStatus.INTERNAL_SERVER_ERROR, f"Unhandled server error: {exc}", code="internal_error"))

    def do_PUT(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        path = parsed.path
        query = parse_qs(parsed.query)
        self._prepare_request("PUT", path)

        if path.startswith("/api/components/"):
            component_type = path.split("/")[-1]
            try:
                self._require_components_write_access()
                payload = self._read_json_body()
                payload["updated_by"] = str(payload.get("updated_by") or self._actor())
                updated = storage.upsert_component(component_type, payload)
                self._json_response(HTTPStatus.OK, updated)
            except ApiError as exc:
                self._error_response(exc)
            except json.JSONDecodeError as exc:
                self._error_response(ApiError(HTTPStatus.BAD_REQUEST, f"Invalid JSON body: {exc}", code="invalid_json"))
            except Exception as exc:
                self._error_response(ApiError(HTTPStatus.INTERNAL_SERVER_ERROR, f"Unhandled server error: {exc}", code="internal_error"))
            return

        if not path.startswith("/api/screens/"):
            self._error_response(ApiError(HTTPStatus.NOT_FOUND, "Not found", code="not_found"))
            return

        try:
            payload = self._read_json_body()
            screen_id = path.split("/")[-1]
            project_id = self._required_query(query, "project_id")
            contract_id = self._required_query(query, "contract_id")
            version_id = self._required_query(query, "version_id")
            updated = storage.update_screen(project_id, contract_id, version_id, screen_id, payload)
            self._json_response(HTTPStatus.OK, updated)
        except ApiError as exc:
            self._error_response(exc)
        except json.JSONDecodeError as exc:
            self._error_response(ApiError(HTTPStatus.BAD_REQUEST, f"Invalid JSON body: {exc}", code="invalid_json"))
        except Exception as exc:
            self._error_response(ApiError(HTTPStatus.INTERNAL_SERVER_ERROR, f"Unhandled server error: {exc}", code="internal_error"))

    def do_DELETE(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        path = parsed.path
        self._prepare_request("DELETE", path)

        if path.startswith("/api/components/"):
            component_type = path.split("/")[-1]
            try:
                self._require_components_write_access()
                self._json_response(HTTPStatus.OK, storage.delete_component(component_type))
            except ApiError as exc:
                self._error_response(exc)
            except Exception as exc:
                self._error_response(ApiError(HTTPStatus.INTERNAL_SERVER_ERROR, f"Unhandled server error: {exc}", code="internal_error"))
            return

        self._error_response(ApiError(HTTPStatus.NOT_FOUND, "Not found", code="not_found"))

    def do_PATCH(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        path = parsed.path
        query = parse_qs(parsed.query)
        self._prepare_request("PATCH", path)

        if not path.endswith("/status") or not path.startswith("/api/screens/"):
            self._error_response(ApiError(HTTPStatus.NOT_FOUND, "Not found", code="not_found"))
            return

        try:
            payload = self._read_json_body()
            screen_id = path.split("/")[-2]
            project_id = self._required_query(query, "project_id")
            contract_id = self._required_query(query, "contract_id")
            version_id = self._required_query(query, "version_id")
            status = str(payload.get("status") or "")
            updated = storage.patch_screen_status(project_id, contract_id, version_id, screen_id, status)
            self._json_response(HTTPStatus.OK, updated)
        except ApiError as exc:
            self._error_response(exc)
        except json.JSONDecodeError as exc:
            self._error_response(ApiError(HTTPStatus.BAD_REQUEST, f"Invalid JSON body: {exc}", code="invalid_json"))
        except Exception as exc:
            self._error_response(ApiError(HTTPStatus.INTERNAL_SERVER_ERROR, f"Unhandled server error: {exc}", code="internal_error"))

    def _read_json_body(self) -> dict[str, Any]:
        content_length = int(self.headers.get("Content-Length", "0"))
        raw_body = self.rfile.read(content_length)
        if not raw_body:
            return {}
        decoded = json.loads(raw_body.decode("utf-8"))
        if not isinstance(decoded, dict):
            raise ApiError(HTTPStatus.BAD_REQUEST, "JSON body must be an object", code="invalid_json")
        return decoded

    @staticmethod
    def _optional_query(query: dict[str, list[str]], key: str) -> str | None:
        values = query.get(key) or []
        if not values:
            return None
        value = values[0].strip()
        return value if value else None

    def _required_query(self, query: dict[str, list[str]], key: str) -> str:
        value = self._optional_query(query, key)
        if not value:
            raise ApiError(HTTPStatus.BAD_REQUEST, f"Missing query param: {key}", code="missing_query_param")
        return value

    def _serve_file(self, relative_path: str) -> None:
        clean_path = relative_path.split("?", 1)[0]
        file_path = (WEB_DIR / clean_path).resolve()

        try:
            file_path.relative_to(WEB_DIR)
        except ValueError:
            self._error_response(ApiError(HTTPStatus.FORBIDDEN, "Forbidden", code="forbidden"))
            return

        if not file_path.exists() or not file_path.is_file():
            self._error_response(ApiError(HTTPStatus.NOT_FOUND, "Not found", code="not_found"))
            return

        content_type = mimetypes.guess_type(str(file_path))[0] or "application/octet-stream"
        data = file_path.read_bytes()
        self._raw_response(HTTPStatus.OK, data, content_type)

    def _prepare_request(self, method: str, path: str) -> None:
        incoming_trace = str(self.headers.get("X-Trace-Id") or self.headers.get("X-Request-Id") or "").strip()
        self._trace_id = incoming_trace or str(uuid.uuid4())
        self._request_method = method
        self._request_path = path
        self._request_started_at = time.monotonic()
        metrics.inc_request(method, path)
        self._log_event("request_started", method=method, path=path)

    def _actor(self) -> str:
        for key in ("X-Actor", "X-User", "X-Updated-By"):
            value = str(self.headers.get(key) or "").strip()
            if value:
                return value
        return "system"

    def _token_from_headers(self) -> str:
        token = str(self.headers.get("X-Components-Token") or self.headers.get("X-API-Token") or "").strip()
        if token:
            return token
        auth_header = str(self.headers.get("Authorization") or "").strip()
        if auth_header.lower().startswith("bearer "):
            return auth_header[7:].strip()
        return ""

    def _require_components_write_access(self) -> None:
        if not COMPONENTS_WRITE_TOKEN:
            return
        if self._token_from_headers() != COMPONENTS_WRITE_TOKEN:
            raise ApiError(HTTPStatus.FORBIDDEN, "Forbidden", code="forbidden")

    def _error_response(self, error: ApiError) -> None:
        metrics.inc_error()
        payload = {
            "error": {
                "code": error.code,
                "message": error.message,
                "details": error.details,
            },
            "trace_id": self._trace_id,
            "timestamp": datetime.now(tz=timezone.utc).isoformat(),
        }
        self._json_response(error.status, payload)

    def _json_response(self, status_code: HTTPStatus, payload: dict[str, Any]) -> None:
        if int(status_code) >= 400 and "error" in payload and not isinstance(payload.get("error"), dict):
            payload = {
                "error": {
                    "code": "http_error",
                    "message": str(payload.get("error")),
                    "details": None,
                },
                "trace_id": getattr(self, "_trace_id", str(uuid.uuid4())),
                "timestamp": datetime.now(tz=timezone.utc).isoformat(),
            }
            metrics.inc_error()
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self._raw_response(status_code, body, "application/json; charset=utf-8")

    def _text_response(self, status_code: HTTPStatus, content: str, content_type: str = "text/plain; charset=utf-8") -> None:
        body = content.encode("utf-8")
        self._raw_response(status_code, body, content_type)

    def _raw_response(self, status_code: HTTPStatus, body: bytes, content_type: str) -> None:
        self.send_response(status_code)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("X-Trace-Id", getattr(self, "_trace_id", ""))
        self.end_headers()
        self.wfile.write(body)
        self._log_event("request_finished", status=int(status_code), bytes=len(body))

    def _log_event(self, event: str, **fields: Any) -> None:
        duration_ms = 0.0
        started = getattr(self, "_request_started_at", None)
        if isinstance(started, float):
            duration_ms = round((time.monotonic() - started) * 1000.0, 2)
        payload = {
            "event": event,
            "trace_id": getattr(self, "_trace_id", None),
            "method": getattr(self, "_request_method", None),
            "path": getattr(self, "_request_path", None),
            "duration_ms": duration_ms,
            "timestamp": datetime.now(tz=timezone.utc).isoformat(),
        }
        payload.update(fields)
        LOGGER.info(json.dumps(payload, ensure_ascii=False))

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
