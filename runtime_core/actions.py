from __future__ import annotations

from typing import Any

from .models import ACTION_TYPES


def decode_action(source: Any, path: str, errors: list[dict[str, str]]) -> dict[str, Any] | None:
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


def validate_action(action: dict[str, Any] | None, path: str, errors: list[dict[str, str]]) -> None:
    if action is None:
        return

    action_type = action.get("type")
    if action_type not in ACTION_TYPES:
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
