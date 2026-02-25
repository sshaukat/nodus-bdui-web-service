from __future__ import annotations

from typing import Any

from .decode import decode_node
from .models import normalize_schema_version, rules_for_profile
from .validate import validate_node


def decode_validate(
    schema: Any,
    schema_rules_profile: str = "v0_2_strict",
    schema_version: str | None = None,
) -> dict[str, Any]:
    resolved_schema_version = schema_version
    if resolved_schema_version is None and isinstance(schema, dict):
        candidate = schema.get("schemaVersion")
        if isinstance(candidate, str):
            resolved_schema_version = candidate

    rules = rules_for_profile(schema_rules_profile=schema_rules_profile, schema_version=resolved_schema_version)

    decode_errors: list[dict[str, str]] = []
    validation_errors: list[dict[str, str]] = []

    applied_schema_version = normalize_schema_version(resolved_schema_version, fallback=rules.schema_version)

    if rules.require_explicit_schema_version and not resolved_schema_version:
        decode_errors.append({"path": "$.schemaVersion", "message": "schemaVersion is required for v0_2"})

    node = decode_node(schema, "$", decode_errors, rules)
    if node is not None:
        validate_node(node, "$", validation_errors, seen_ids=set())

    return {
        "ok": node is not None and not decode_errors and not validation_errors,
        "node": node,
        "decodeErrors": decode_errors,
        "validationErrors": validation_errors,
        "appliedSchemaVersion": applied_schema_version,
    }
