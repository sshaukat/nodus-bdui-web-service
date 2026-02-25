from __future__ import annotations

from typing import Any

from .actions import decode_action
from .models import NODE_TYPES, RuntimeRules


def to_float(value: Any, fallback: float) -> float:
    if isinstance(value, (int, float)):
        return float(value)
    return fallback


def decode_spacing(source: Any, path: str, errors: list[dict[str, str]]) -> dict[str, float]:
    if source is None:
        return {"top": 0.0, "right": 0.0, "bottom": 0.0, "left": 0.0}
    if not isinstance(source, dict):
        errors.append({"path": path, "message": "Spacing must be an object"})
        return {"top": 0.0, "right": 0.0, "bottom": 0.0, "left": 0.0}

    return {
        "top": to_float(source.get("top"), 0.0),
        "right": to_float(source.get("right"), 0.0),
        "bottom": to_float(source.get("bottom"), 0.0),
        "left": to_float(source.get("left"), 0.0),
    }


def decode_layout(source: Any, path: str, errors: list[dict[str, str]]) -> dict[str, Any] | None:
    if source is None:
        return None
    if not isinstance(source, dict):
        errors.append({"path": path, "message": "'layout' must be an object"})
        return None

    return {
        "padding": decode_spacing(source.get("padding"), f"{path}.padding", errors),
        "margin": decode_spacing(source.get("margin"), f"{path}.margin", errors),
        "width": source.get("width"),
        "height": source.get("height"),
        "weight": source.get("weight"),
        "alignment": source.get("alignment"),
    }


def decode_children(source: Any, path: str, errors: list[dict[str, str]], rules: RuntimeRules) -> list[dict[str, Any]]:
    if source is None:
        return []
    if not isinstance(source, list):
        errors.append({"path": path, "message": "'children' must be an array"})
        return []

    decoded: list[dict[str, Any]] = []
    for index, child in enumerate(source):
        child_node = decode_node(child, f"{path}[{index}]", errors, rules)
        if child_node is not None:
            decoded.append(child_node)
    return decoded


def decode_node(source: Any, path: str, errors: list[dict[str, str]], rules: RuntimeRules) -> dict[str, Any] | None:
    if not isinstance(source, dict):
        errors.append({"path": path, "message": "Node must be an object"})
        return None

    raw_type = source.get("type")
    if not isinstance(raw_type, str) or not raw_type.strip():
        errors.append({"path": path, "message": "Node field 'type' is required"})
        return None

    node_type = raw_type.strip().lower()
    if node_type not in NODE_TYPES:
        errors.append({"path": path, "message": f"Unsupported node type: {node_type}"})
        return None

    node: dict[str, Any] = {"type": node_type}
    if "id" in source:
        node["id"] = source.get("id")

    if "visible" in source:
        node["visible"] = source.get("visible")
    elif "viible" in source:
        if rules.allow_visible_typo_alias:
            node["visible"] = source.get("viible")
        else:
            errors.append({"path": f"{path}.viible", "message": "Field 'viible' is not supported in v0_2, use 'visible'"})

    if "enabled" in source:
        node["enabled"] = source.get("enabled")

    layout = decode_layout(source.get("layout"), f"{path}.layout", errors)
    if layout is not None:
        node["layout"] = layout

    if node_type in {"column", "row", "box", "navbar"}:
        node["children"] = decode_children(source.get("children"), f"{path}.children", errors, rules)

    if node_type == "row":
        for field in ("justify", "distribution", "alignItems", "crossAlign", "wrap", "gap"):
            if field in source:
                node[field] = source.get(field)

    if node_type == "text":
        node["value"] = source.get("value")

    if node_type == "button":
        node["title"] = source.get("title")
        action = decode_action(source.get("action"), f"{path}.action", errors)
        if action is not None:
            node["action"] = action

    if node_type == "iconbutton":
        node["title"] = source.get("title")
        node["icon"] = source.get("icon")
        action = decode_action(source.get("action"), f"{path}.action", errors)
        if action is not None:
            node["action"] = action

    if node_type == "input":
        node["placeholder"] = source.get("placeholder")
        node["value"] = source.get("value")
        on_change = decode_action(source.get("onChange"), f"{path}.onChange", errors)
        if on_change is not None:
            node["onChange"] = on_change

    return node
