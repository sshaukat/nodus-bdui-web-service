# Migration Note: FastAPI + TS/React Transition

## Objective

Move transport/UI stack to FastAPI + TS/React without breaking schema contract behavior.

## Locked invariants

1. `schemaVersion` semantics remain unchanged.
2. Runtime core remains source of decode/validate rules.
3. Delivery IDs and publication model stay backward-compatible.

## Suggested migration path

1. Keep `runtime_core/` unchanged as domain module.
2. Add FastAPI adapter layer calling runtime/storage APIs.
3. Move web UI to TS/React against unchanged HTTP contract.
4. Retain legacy endpoints until client compatibility window closes.

## Exit criteria

1. New API/UI stack passes same unit/golden/smoke suites.
2. No contract regressions for `v0_1` and `v0_2` payloads.
