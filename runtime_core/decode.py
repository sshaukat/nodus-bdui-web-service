from __future__ import annotations

from typing import Any

from .actions import decode_action
from .models import ALLOWED_ICONBUTTON_ICONS, NODE_TYPES, RuntimeRules, normalize_custom_icon_name


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


def decode_icon_reference(source: Any, path: str, errors: list[dict[str, str]], default_icon: str = "menu") -> str:
    fallback = default_icon.lower()

    if source is None:
        return fallback

    if isinstance(source, dict):
        embedded = source.get("icon")
        if embedded is not None and ("name" not in source and "source" not in source):
            return decode_icon_reference(embedded, path, errors, default_icon=fallback)

        icon_name = str(source.get("name") or "").strip().lower()
        icon_source = str(source.get("source") or "").strip().lower() or "library"
        if icon_source not in {"library", "custom"}:
            errors.append({"path": f"{path}.source", "message": "Icon source must be 'library' or 'custom'"})
            return fallback
        if not icon_name:
            errors.append({"path": f"{path}.name", "message": "Icon name is required"})
            return fallback
        if icon_source == "custom":
            normalized_custom = normalize_custom_icon_name(icon_name)
            if not normalized_custom:
                errors.append({"path": f"{path}.name", "message": "Invalid custom icon name"})
                return fallback
            return f"custom:{normalized_custom}"
        if icon_name not in ALLOWED_ICONBUTTON_ICONS:
            errors.append({"path": path, "message": f"Unsupported icon value: {icon_name}"})
            return fallback
        return icon_name

    if not isinstance(source, str):
        errors.append({"path": path, "message": "Icon must be a string or object"})
        return fallback

    normalized = source.strip().lower()
    if not normalized:
        return fallback

    if normalized.startswith("custom:"):
        custom_name = normalize_custom_icon_name(normalized[len("custom:") :])
        if not custom_name:
            errors.append({"path": path, "message": "Invalid custom icon name"})
            return fallback
        return f"custom:{custom_name}"

    if normalized.startswith("library:"):
        normalized = normalized[len("library:") :]

    if normalized not in ALLOWED_ICONBUTTON_ICONS:
        errors.append({"path": path, "message": f"Unsupported icon value: {normalized}"})
        return fallback
    return normalized


def decode_navbar_action_item(source: Any, path: str, index: int, errors: list[dict[str, str]]) -> dict[str, Any]:
    default_title = f"action {index + 1}"
    default_action: dict[str, Any] = {"type": "log", "value": f"navbar action {index + 1}"}

    if isinstance(source, str):
        return {
            "icon": decode_icon_reference(source, path, errors),
            "title": default_title,
            "action": default_action,
        }

    if not isinstance(source, dict):
        errors.append({"path": path, "message": "Navbar action item must be a string or object"})
        return {
            "icon": "menu",
            "title": default_title,
            "action": default_action,
        }

    icon_source = source.get("icon")
    if icon_source is None and ("name" in source or "source" in source):
        icon_source = {"name": source.get("name"), "source": source.get("source")}

    title_value = source.get("title")
    title = default_title
    if title_value is not None:
        if isinstance(title_value, str):
            trimmed = title_value.strip()
            if trimmed:
                title = trimmed
        else:
            errors.append({"path": f"{path}.title", "message": "Navbar action title must be a string"})

    action = decode_action(source.get("action"), f"{path}.action", errors) or default_action

    return {
        "icon": decode_icon_reference(icon_source, f"{path}.icon", errors),
        "title": title,
        "action": action,
    }


def decode_navbar_actions(source: Any, path: str, errors: list[dict[str, str]]) -> list[dict[str, Any]]:
    if source is None:
        return []
    if not isinstance(source, list):
        errors.append({"path": path, "message": "Navbar field 'actions' must be an array"})
        return []

    actions: list[dict[str, Any]] = []
    for index, item in enumerate(source):
        actions.append(decode_navbar_action_item(item, f"{path}[{index}]", index, errors))
    return actions


def decode_max_lines(
    source: dict[str, Any],
    max_lines_field: str,
    wrap_field: str,
    path: str,
    errors: list[dict[str, str]],
    default: int = 1,
) -> int:
    raw_max_lines = source.get(max_lines_field)
    if raw_max_lines is not None:
        if isinstance(raw_max_lines, bool):
            errors.append({"path": f"{path}.{max_lines_field}", "message": f"Field '{max_lines_field}' must be an integer >= 1"})
            return default
        if isinstance(raw_max_lines, (int, float)) and float(raw_max_lines).is_integer():
            normalized = int(raw_max_lines)
            if normalized >= 1:
                return normalized
        errors.append({"path": f"{path}.{max_lines_field}", "message": f"Field '{max_lines_field}' must be an integer >= 1"})
        return default

    raw_wrap = source.get(wrap_field)
    if raw_wrap is None:
        return default
    if not isinstance(raw_wrap, bool):
        errors.append({"path": f"{path}.{wrap_field}", "message": f"Field '{wrap_field}' must be boolean"})
        return default
    return 2 if raw_wrap else 1


def decode_navbar_fields(
    node: dict[str, Any],
    source: dict[str, Any],
    path: str,
    errors: list[dict[str, str]],
    rules: RuntimeRules,
    source_type: str,
) -> None:
    if "children" in source:
        node["children"] = decode_children(source.get("children"), f"{path}.children", errors, rules)

    show_back_path = f"{path}.showBack"
    show_back_value = source.get("showBack")
    if "showLeftButton" in source:
        show_back_path = f"{path}.showLeftButton"
        show_back_value = source.get("showLeftButton")
    if show_back_value is None:
        show_back = True
    elif isinstance(show_back_value, bool):
        show_back = show_back_value
    else:
        errors.append({"path": show_back_path, "message": "Navbar left button visibility must be boolean"})
        show_back = True
    node["showBack"] = show_back

    back_icon_path = f"{path}.backIcon"
    back_icon_source = source.get("backIcon")
    if "leftIcon" in source:
        back_icon_path = f"{path}.leftIcon"
        back_icon_source = source.get("leftIcon")
    node["backIcon"] = decode_icon_reference(back_icon_source, back_icon_path, errors, default_icon="arrow-left")

    back_title_path = f"{path}.backTitle"
    back_title_value = source.get("backTitle")
    if "leftTitle" in source:
        back_title_path = f"{path}.leftTitle"
        back_title_value = source.get("leftTitle")
    if back_title_value is None:
        node["backTitle"] = "Back"
    elif isinstance(back_title_value, str):
        node["backTitle"] = back_title_value
    else:
        errors.append({"path": back_title_path, "message": "Navbar left button title must be a string"})
        node["backTitle"] = "Back"

    back_action_path = f"{path}.backAction"
    back_action_source = source.get("backAction")
    if "leftAction" in source:
        back_action_path = f"{path}.leftAction"
        back_action_source = source.get("leftAction")
    elif "backButtonClick" in source:
        back_action_path = f"{path}.backButtonClick"
        back_action_source = source.get("backButtonClick")
    node["backAction"] = decode_action(back_action_source, back_action_path, errors) or {"type": "navigate", "route": "back"}

    title = source.get("title")
    if title is None:
        node["title"] = ""
    elif isinstance(title, str):
        node["title"] = title
    else:
        errors.append({"path": f"{path}.title", "message": "Navbar title must be a string"})
        node["title"] = ""

    subtitle = source.get("subtitle")
    if subtitle is None:
        node["subtitle"] = ""
    elif isinstance(subtitle, str):
        node["subtitle"] = subtitle
    else:
        errors.append({"path": f"{path}.subtitle", "message": "Navbar subtitle must be a string"})
        node["subtitle"] = ""

    title_align_path = f"{path}.titleAlign"
    raw_align = source.get("titleAlign")
    if "titleHorizontalAlign" in source:
        title_align_path = f"{path}.titleHorizontalAlign"
        raw_align = source.get("titleHorizontalAlign")

    normalized_title_align = "center"
    if raw_align is not None:
        if not isinstance(raw_align, str):
            errors.append({"path": title_align_path, "message": "Navbar title alignment must be a string"})
        else:
            lowered = raw_align.strip().lower()
            if lowered in {"start", "left", "flex-start"}:
                normalized_title_align = "start"
            elif lowered == "center":
                normalized_title_align = "center"
            else:
                errors.append({"path": title_align_path, "message": "Navbar title alignment must be start|center"})
    node["titleAlign"] = normalized_title_align
    node["titleMaxLines"] = decode_max_lines(source, "titleMaxLines", "titleWrap", path, errors, default=1)
    node["subtitleMaxLines"] = decode_max_lines(source, "subtitleMaxLines", "subtitleWrap", path, errors, default=1)

    center_content = source.get("centerContent")
    if center_content is not None:
        decoded_center = decode_node(center_content, f"{path}.centerContent", errors, rules)
        if decoded_center is not None:
            node["centerContent"] = decoded_center

    node["actions"] = decode_navbar_actions(source.get("actions"), f"{path}.actions", errors)
    node["sourceType"] = source_type


def decode_node(source: Any, path: str, errors: list[dict[str, str]], rules: RuntimeRules) -> dict[str, Any] | None:
    if not isinstance(source, dict):
        errors.append({"path": path, "message": "Node must be an object"})
        return None

    raw_type = source.get("type")
    if not isinstance(raw_type, str) or not raw_type.strip():
        errors.append({"path": path, "message": "Node field 'type' is required"})
        return None

    original_node_type = raw_type.strip().lower()
    if original_node_type not in NODE_TYPES:
        errors.append({"path": path, "message": f"Unsupported node type: {original_node_type}"})
        return None

    node_type = "navbar" if original_node_type == "custom-nav-bar" else original_node_type

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

    if node_type in {"column", "row", "box"}:
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

    if node_type == "navbar":
        decode_navbar_fields(node, source, path, errors, rules, source_type=original_node_type)

    return node
