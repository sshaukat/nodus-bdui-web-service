from __future__ import annotations

from dataclasses import dataclass

NODE_TYPES = {"column", "row", "box", "text", "button", "iconbutton", "spacer", "input", "navbar"}
ACTION_TYPES = {"log", "open_url", "navigate"}

ALLOWED_ROW_JUSTIFY = {
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
ALLOWED_ROW_DISTRIBUTION = {"space-between", "between", "space-around", "space-evenly"}
ALLOWED_ROW_ALIGN = {"top", "start", "flex-start", "bottom", "end", "flex-end", "center", "stretch", "baseline"}
ALLOWED_ROW_WRAP = {"wrap", "nowrap", "wrap-reverse"}

ALLOWED_ICONBUTTON_ICONS = {
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

ALLOWED_SCHEMA_VERSIONS = {"v0_1", "v0_2"}


@dataclass(frozen=True)
class RuntimeRules:
    schema_version: str
    allow_visible_typo_alias: bool
    require_explicit_schema_version: bool


def normalize_schema_version(value: str | None, fallback: str = "v0_1") -> str:
    raw = str(value or "").strip().lower().replace("-", "_")
    if raw in ALLOWED_SCHEMA_VERSIONS:
        return raw
    return fallback


def rules_for_profile(schema_rules_profile: str | None, schema_version: str | None) -> RuntimeRules:
    profile = str(schema_rules_profile or "").strip().lower().replace("-", "_")

    if schema_version:
        normalized_version = normalize_schema_version(schema_version, fallback="v0_1")
    elif profile in {"v0_2", "v0_2_strict"}:
        normalized_version = "v0_2"
    else:
        normalized_version = "v0_1"

    if normalized_version == "v0_2":
        return RuntimeRules(
            schema_version="v0_2",
            allow_visible_typo_alias=False,
            require_explicit_schema_version=True,
        )

    return RuntimeRules(
        schema_version="v0_1",
        allow_visible_typo_alias=True,
        require_explicit_schema_version=False,
    )
