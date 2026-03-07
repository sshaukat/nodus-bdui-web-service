from __future__ import annotations

from typing import Any

from .actions import validate_action
from .models import (
    ALLOWED_ICONBUTTON_ICONS,
    ALLOWED_NAVBAR_TITLE_ALIGN,
    ALLOWED_ROW_ALIGN,
    ALLOWED_ROW_DISTRIBUTION,
    ALLOWED_ROW_JUSTIFY,
    ALLOWED_ROW_WRAP,
    normalize_custom_icon_name,
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


def validate_icon_reference(icon: Any, path: str, errors: list[dict[str, str]], allow_custom: bool = False) -> None:
    if not isinstance(icon, str) or not icon.strip():
        errors.append({"path": path, "message": "Icon value must be a non-empty string"})
        return

    normalized = icon.strip().lower()

    if normalized.startswith("custom:"):
        if not allow_custom:
            errors.append({"path": path, "message": "Custom icons are not supported for this field"})
            return
        icon_name = normalize_custom_icon_name(normalized[len("custom:") :])
        if not icon_name:
            errors.append({"path": path, "message": "Invalid custom icon name"})
        return

    if normalized.startswith("library:"):
        normalized = normalized[len("library:") :]

    if normalized not in ALLOWED_ICONBUTTON_ICONS:
        errors.append({"path": path, "message": "Icon has unsupported value"})


def validate_navbar(node: dict[str, Any], path: str, errors: list[dict[str, str]], seen_ids: set[str]) -> None:
    show_back = node.get("showBack")
    if show_back is not None and not isinstance(show_back, bool):
        errors.append({"path": f"{path}.showBack", "message": "Navbar field 'showBack' must be boolean"})

    if "backIcon" in node:
        validate_icon_reference(node.get("backIcon"), f"{path}.backIcon", errors, allow_custom=True)

    back_title = node.get("backTitle")
    if back_title is not None and not isinstance(back_title, str):
        errors.append({"path": f"{path}.backTitle", "message": "Navbar field 'backTitle' must be a string"})

    validate_action(node.get("backAction"), f"{path}.backAction", errors)

    title = node.get("title")
    if title is not None and not isinstance(title, str):
        errors.append({"path": f"{path}.title", "message": "Navbar field 'title' must be a string"})

    subtitle = node.get("subtitle")
    if subtitle is not None and not isinstance(subtitle, str):
        errors.append({"path": f"{path}.subtitle", "message": "Navbar field 'subtitle' must be a string"})

    title_align = node.get("titleAlign")
    if title_align is not None and (not isinstance(title_align, str) or title_align.lower() not in ALLOWED_NAVBAR_TITLE_ALIGN):
        errors.append({"path": f"{path}.titleAlign", "message": "Navbar field 'titleAlign' must be start|center"})

    title_max_lines = node.get("titleMaxLines")
    if title_max_lines is not None:
        if isinstance(title_max_lines, bool) or not isinstance(title_max_lines, int) or title_max_lines < 1:
            errors.append({"path": f"{path}.titleMaxLines", "message": "Navbar field 'titleMaxLines' must be an integer >= 1"})

    subtitle_max_lines = node.get("subtitleMaxLines")
    if subtitle_max_lines is not None:
        if isinstance(subtitle_max_lines, bool) or not isinstance(subtitle_max_lines, int) or subtitle_max_lines < 1:
            errors.append({"path": f"{path}.subtitleMaxLines", "message": "Navbar field 'subtitleMaxLines' must be an integer >= 1"})

    center_content = node.get("centerContent")
    if center_content is not None:
        if not isinstance(center_content, dict):
            errors.append({"path": f"{path}.centerContent", "message": "Navbar field 'centerContent' must be a node object"})
        else:
            validate_node(center_content, f"{path}.centerContent", errors, seen_ids)

    actions = node.get("actions")
    if actions is not None:
        if not isinstance(actions, list):
            errors.append({"path": f"{path}.actions", "message": "Navbar field 'actions' must be an array"})
        else:
            for index, item in enumerate(actions):
                if not isinstance(item, dict):
                    errors.append({"path": f"{path}.actions[{index}]", "message": "Navbar action must be an object"})
                    continue

                validate_icon_reference(item.get("icon"), f"{path}.actions[{index}].icon", errors, allow_custom=True)
                title_value = item.get("title")
                if title_value is not None and (not isinstance(title_value, str) or not title_value.strip()):
                    errors.append({"path": f"{path}.actions[{index}].title", "message": "Navbar action title must not be blank"})
                validate_action(item.get("action"), f"{path}.actions[{index}].action", errors)


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

        validate_icon_reference(node.get("icon"), f"{path}.icon", errors, allow_custom=False)

        validate_action(node.get("action"), f"{path}.action", errors)

    if node_type == "input":
        input_id = node.get("id")
        if not isinstance(input_id, str) or not input_id.strip():
            errors.append({"path": path, "message": "Input node requires non-empty id"})
        validate_action(node.get("onChange"), f"{path}.onChange", errors)

    if node_type == "row":
        validate_row(node, path, errors)

    if node_type == "navbar":
        validate_navbar(node, path, errors, seen_ids)

    for index, child in enumerate(node.get("children", [])):
        validate_node(child, f"{path}.children[{index}]", errors, seen_ids)
