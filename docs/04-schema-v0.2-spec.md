# Schema v0.2 Spec

## Goal

Stabilize contract behavior with explicit `schemaVersion` and deterministic validation rules.

## Supported versions

- `v0_1`
- `v0_2`

## Contract rules

1. New and updated schemas must carry `schemaVersion`.
2. `v0_2` uses strict profile behavior.
3. Legacy payloads can still be interpreted via `v0_1` fallback flow.

## Capability matrix highlights

1. Common node flags: `visible`, `enabled`.
2. `viible` typo alias:
- accepted in `v0_1` for backward compatibility;
- rejected in `v0_2` with explicit decode error.
3. Action types: `log`, `open_url`, `navigate`.

## Validation behavior

1. `v0_2` requires explicit `schemaVersion`.
2. `navigate.route` must be `/path` or `back`.
3. `input` requires non-empty `id`.
4. Duplicate node ids are rejected.

## API impact

- `POST /api/decode-validate` returns `appliedSchemaVersion`.
- Draft/publish entities store `schema_version`.
