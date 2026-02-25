from __future__ import annotations

from typing import Any

from .actions import validate_action
from .models import (
    ALLOWED_ICONBUTTON_ICONS,
    ALLOWED_ROW_ALIGN,
    ALLOWED_ROW_DISTRIBUTION,
    ALLOWED_ROW_JUSTIFY,
    ALLOWED_ROW_WRAP,
)


def validate_row(node: dict[str, Any], path: str, errors: list[dict[str, str]]) -> None:
    justify = node.get("justify")
    if justify is not None:
        if not isinstance(justify, str) or justify.lower() not in ALLOWED_ROW_JUSTIFY:
            errors.append({"path": f"{path}.justify", "message": "Unsupported row justify value"})

    distribution = node.get("distribution")
    if distribution is not None:
        if not isinstance(distribution, str) or distribution.lower() not in ALLOWED_ROW_DISTRIBUTION:
            errors.append({"path": f"{path}.distribution", "message": "Unsupported row distribution value"})

    align_items = node.get("alignItems")
    if align_items is not None:
        if not isinstance(align_items, str) or align_items.lower() not in ALLOWED_ROW_ALIGN:
            errors.append({"path": f"{path}.alignItems", "message": "Unsupported row alignItems value"})

    cross_align = node.get("crossAlign")
    if cross_align is not None:
        if not isinstance(cross_align, str) or cross_align.lower() not in ALLOWED_ROW_ALIGN:
            errors.append({"path": f"{path}.crossAlign", "message": "Unsupported row crossAlign value"})

    wrap = node.get("wrap")
    if wrap is not None and (not isinstance(wrap, str) or wrap.lower() not in ALLOWED_ROW_WRAP):
        errors.append({"path": f"{path}.wrap", "message": "Unsupported row wrap value"})

    gap = node.get("gap")
    if gap is not None and not isinstance(gap, (int, float)):
        errors.append({"path": f"{path}.gap", "message": "Row gap must be a number"})


def validate_node(node: dict[str, Any], path: str, errors: list[dict[str, str]], seen_ids: set[str]) -> None:
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
        validate_action(node.get("action"), f"{path}.action", errors)

    if node_type == "iconbutton":
        title = node.get("title")
        if title is not None and (not isinstance(title, str) or not title.strip()):
            errors.append({"path": path, "message": "IconButton field 'title' must not be blank"})

        icon = node.get("icon")
        if not isinstance(icon, str) or icon.lower() not in ALLOWED_ICONBUTTON_ICONS:
            errors.append({"path": path, "message": "IconButton field 'icon' has unsupported value"})

        validate_action(node.get("action"), f"{path}.action", errors)

    if node_type == "input":
        input_id = node.get("id")
        if not isinstance(input_id, str) or not input_id.strip():
            errors.append({"path": path, "message": "Input node requires non-empty id"})
        validate_action(node.get("onChange"), f"{path}.onChange", errors)

    if node_type == "row":
        validate_row(node, path, errors)

    for index, child in enumerate(node.get("children", [])):
        validate_node(child, f"{path}.children[{index}]", errors, seen_ids)
