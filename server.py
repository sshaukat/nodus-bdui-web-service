#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import mimetypes
import re
from datetime import datetime, timedelta, timezone
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, unquote, urlparse

WEB_DIR = Path(__file__).resolve().parent / "web"
DATA_DIR = Path(__file__).resolve().parent / "data"


class ApiError(Exception):
    def __init__(self, status: HTTPStatus, message: str):
        super().__init__(message)
        self.status = status
        self.message = message


class BduiRuntime:
    NODE_TYPES = {"column", "row", "box", "text", "button", "iconbutton", "spacer", "input"}
    ACTION_TYPES = {"log", "open_url", "navigate"}

    @classmethod
    def decode_validate(cls, schema: Any, schema_rules_profile: str = "v0_1_default") -> dict[str, Any]:
        # Profile lookup point for future versions. Currently, all profiles map to v0.1 rules.
        _ = schema_rules_profile

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


class RegistryStorage:
    SLUG_RE = re.compile(r"^[a-z0-9][a-z0-9-_]{0,62}$")
    PUBLICATION_RETENTION_DAYS = 31

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
        }
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

        meta = {
            "project_id": project_id,
            "contract_id": contract_id,
            "version_id": version_id,
            "based_on_version_id": based_on_version_id,
            "schema_rules_profile": str(payload.get("schema_rules_profile") or "v0_1_default"),
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

    def list_screens(self, project_id: str, contract_id: str, version_id: str, include_deleted: bool = False) -> list[dict[str, Any]]:
        self._ensure_version(project_id, contract_id, version_id)
        root = self._draft_screens_dir(project_id, contract_id, version_id)
        if not root.exists():
            return []

        items: list[dict[str, Any]] = []
        for screen_file in sorted(root.glob("*.json")):
            payload = self._load_json(screen_file, {})
            status = str(payload.get("status") or "active")
            if status == "deleted" and not include_deleted:
                continue
            items.append(payload)
        return items

    def get_screen(self, project_id: str, contract_id: str, version_id: str, screen_id: str) -> dict[str, Any]:
        self._ensure_version(project_id, contract_id, version_id)
        path = self._screen_file(project_id, contract_id, version_id, screen_id)
        if not path.exists():
            raise ApiError(HTTPStatus.NOT_FOUND, f"Screen not found: {screen_id}")
        return self._load_json(path, {})

    def create_screen(self, payload: dict[str, Any]) -> dict[str, Any]:
        project_id = self._validate_slug(payload.get("project_id") or "", "project_id")
        contract_id = self._validate_slug(payload.get("contract_id") or "", "contract_id")
        version_id = self._validate_slug(payload.get("version_id") or "", "version_id")
        self._ensure_version(project_id, contract_id, version_id)

        screen_id = self._validate_slug(payload.get("screen_id") or payload.get("id") or "", "screen_id")
        path = self._screen_file(project_id, contract_id, version_id, screen_id)
        if path.exists():
            raise ApiError(HTTPStatus.CONFLICT, f"Screen already exists: {screen_id}")

        content_json = payload.get("content_json")
        content_raw = payload.get("content_raw")
        content_parse_error = None
        if content_raw is not None:
            content_raw = str(content_raw)
            try:
                content_json = json.loads(content_raw)
            except json.JSONDecodeError as exc:
                content_json = None
                content_parse_error = f"Invalid schema JSON: {exc}"
        elif content_json is None:
            content_json = {
                "type": "column",
                "id": "form",
                "layout": {"padding": {"top": 8, "right": 8, "bottom": 8, "left": 8}},
                "children": [],
            }
            content_raw = json.dumps(content_json, ensure_ascii=False, indent=2) + "\n"
        else:
            content_raw = json.dumps(content_json, ensure_ascii=False, indent=2) + "\n"

        record = {
            "project_id": project_id,
            "contract_id": contract_id,
            "version_id": version_id,
            "screen_id": screen_id,
            "name": str(payload.get("name") or screen_id),
            "status": str(payload.get("status") or "active"),
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
        if "name" in payload:
            record["name"] = str(payload.get("name") or record.get("name") or screen_id)
        if "content_raw" in payload:
            content_raw = str(payload.get("content_raw") or "")
            record["content_raw"] = content_raw
            try:
                record["content_json"] = json.loads(content_raw)
                record["content_parse_error"] = None
            except json.JSONDecodeError as exc:
                record["content_json"] = None
                record["content_parse_error"] = f"Invalid schema JSON: {exc}"
        elif "content_json" in payload:
            record["content_json"] = payload.get("content_json")
            record["content_raw"] = json.dumps(record["content_json"], ensure_ascii=False, indent=2) + "\n"
            record["content_parse_error"] = None
        if "status" in payload:
            record["status"] = str(payload.get("status") or record.get("status") or "active")
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
        schema_rules_profile = str(version_meta.get("schema_rules_profile") or "v0_1_default")

        screens = [
            item for item in self.list_screens(project_id, contract_id, version_id, include_deleted=False) if item.get("status") == "active"
        ]
        validation_errors: list[dict[str, Any]] = []
        for screen in screens:
            if screen.get("content_parse_error"):
                validation_errors.append(
                    {
                        "screen_id": screen.get("screen_id"),
                        "decodeErrors": [{"path": "$", "message": str(screen.get("content_parse_error"))}],
                        "validationErrors": [],
                    }
                )
                continue

            result = BduiRuntime.decode_validate(screen.get("content_json"), schema_rules_profile=schema_rules_profile)
            if not result.get("ok"):
                validation_errors.append(
                    {
                        "screen_id": screen.get("screen_id"),
                        "decodeErrors": result.get("decodeErrors", []),
                        "validationErrors": result.get("validationErrors", []),
                    }
                )

        if validation_errors:
            raise ApiError(HTTPStatus.BAD_REQUEST, json.dumps({"message": "publish blocked by validation errors", "details": validation_errors}, ensure_ascii=False))

        pub_id = datetime.now(tz=timezone.utc).strftime("pub-%Y%m%dT%H%M%S%fZ")
        published_root = self._version_dir(project_id, contract_id, version_id) / "published" / pub_id
        screens_root = published_root / "screens"
        screens_root.mkdir(parents=True, exist_ok=True)

        screens_manifest: list[dict[str, Any]] = []
        for screen in screens:
            sid = self._validate_slug(str(screen.get("screen_id") or ""), "screen_id")
            content = screen.get("content_json")
            self._dump_json(screens_root / f"{sid}.json", content)
            screens_manifest.append(
                {
                    "screen_id": sid,
                    "name": screen.get("name"),
                    "status": screen.get("status"),
                    "updated_at": screen.get("updated_at"),
                    "schema_id": f"{project_id}:{contract_id}:{version_id}:{sid}",
                }
            )

        publication = {
            "pub_id": pub_id,
            "project_id": project_id,
            "contract_id": contract_id,
            "version_id": version_id,
            "schema_rules_profile": schema_rules_profile,
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

        if path == "/api/health":
            self._json_response(HTTPStatus.OK, {"status": "ok", "service": "nodus-bdui-web"})
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
            try:
                if len(parts) == 1:
                    payload = storage.get_published_schema_by_id(parts[0], pub_id=pub_id)
                elif len(parts) == 4:
                    payload = storage.get_published_schema_by_parts(
                        parts[0],
                        parts[1],
                        parts[2],
                        parts[3],
                        pub_id=pub_id,
                    )
                else:
                    raise ApiError(HTTPStatus.BAD_REQUEST, "Use /schema/<id> or /schema/<project>/<contract>/<version>/<screen>")
            except ApiError as exc:
                self._json_response(exc.status, {"error": exc.message})
                return
            self._json_response(HTTPStatus.OK, payload)
            return

        if path == "/":
            self._serve_file("index.html")
            return

        relative_path = path.lstrip("/") or "index.html"
        self._serve_file(relative_path)

    def do_POST(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        path = parsed.path

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
                            },
                        )
                        return

                schema_rules_profile = str(payload.get("schema_rules_profile") or "v0_1_default")
                result = BduiRuntime.decode_validate(schema, schema_rules_profile=schema_rules_profile)
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
                self._json_response(HTTPStatus.CREATED, storage.create_component(payload))
                return

            if path == "/api/publish":
                self._json_response(HTTPStatus.OK, storage.publish_version(payload))
                return

            self._json_response(HTTPStatus.NOT_FOUND, {"error": "Not found"})

        except ApiError as exc:
            self._json_response(exc.status, {"error": exc.message})
        except json.JSONDecodeError as exc:
            self._json_response(HTTPStatus.BAD_REQUEST, {"error": f"Invalid JSON body: {exc}"})

    def do_PUT(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        path = parsed.path
        query = parse_qs(parsed.query)

        if path.startswith("/api/components/"):
            component_type = path.split("/")[-1]
            try:
                payload = self._read_json_body()
                updated = storage.upsert_component(component_type, payload)
                self._json_response(HTTPStatus.OK, updated)
            except ApiError as exc:
                self._json_response(exc.status, {"error": exc.message})
            except json.JSONDecodeError as exc:
                self._json_response(HTTPStatus.BAD_REQUEST, {"error": f"Invalid JSON body: {exc}"})
            return

        if not path.startswith("/api/screens/"):
            self._json_response(HTTPStatus.NOT_FOUND, {"error": "Not found"})
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
            self._json_response(exc.status, {"error": exc.message})
        except json.JSONDecodeError as exc:
            self._json_response(HTTPStatus.BAD_REQUEST, {"error": f"Invalid JSON body: {exc}"})

    def do_DELETE(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        path = parsed.path

        if path.startswith("/api/components/"):
            component_type = path.split("/")[-1]
            try:
                self._json_response(HTTPStatus.OK, storage.delete_component(component_type))
            except ApiError as exc:
                self._json_response(exc.status, {"error": exc.message})
            return

        self._json_response(HTTPStatus.NOT_FOUND, {"error": "Not found"})

    def do_PATCH(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        path = parsed.path
        query = parse_qs(parsed.query)

        if not path.endswith("/status") or not path.startswith("/api/screens/"):
            self._json_response(HTTPStatus.NOT_FOUND, {"error": "Not found"})
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
            self._json_response(exc.status, {"error": exc.message})
        except json.JSONDecodeError as exc:
            self._json_response(HTTPStatus.BAD_REQUEST, {"error": f"Invalid JSON body: {exc}"})

    def _read_json_body(self) -> dict[str, Any]:
        content_length = int(self.headers.get("Content-Length", "0"))
        raw_body = self.rfile.read(content_length)
        if not raw_body:
            return {}
        decoded = json.loads(raw_body.decode("utf-8"))
        if not isinstance(decoded, dict):
            raise ApiError(HTTPStatus.BAD_REQUEST, "JSON body must be an object")
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
            raise ApiError(HTTPStatus.BAD_REQUEST, f"Missing query param: {key}")
        return value

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
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
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
