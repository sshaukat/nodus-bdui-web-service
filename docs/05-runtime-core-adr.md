# ADR: Runtime Core Extraction

## Status

Accepted.

## Context

Runtime decode/validate rules were previously embedded in `server.py`, tightly coupled to HTTP handling.

## Decision

Create dedicated `runtime_core/` package:

- `runtime_core/models.py`
- `runtime_core/actions.py`
- `runtime_core/decode.py`
- `runtime_core/validate.py`
- `runtime_core/__init__.py`

HTTP layer now calls runtime public API (`decode_validate`) instead of owning runtime logic.

## Consequences

1. Runtime behavior can be unit-tested without HTTP server.
2. Contract evolution (`v0_1` -> `v0_2`) is isolated in core rules.
3. Reduced risk of transport/runtime rule drift.
