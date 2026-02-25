# CI and Quality Gates

## Pipeline

GitHub Actions workflow (`.github/workflows/ci.yml`) runs:

1. syntax check (`py_compile`)
2. unit + golden tests (`unittest discover`)
3. smoke API test (`tests/smoke_api.sh`)

## Gate policy

PR is considered non-ready for merge if any CI step fails.

## Test contour

1. unit tests: runtime/storage critical paths
2. golden tests: fixed schema fixtures with expected decode/validate outcomes
3. smoke tests: end-to-end API sanity flow (health, registry, publish, components, metrics)
