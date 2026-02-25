# Component Catalog Ops

## Write security

Write operations are protected by token:

- header `X-Components-Token` (or `Authorization: Bearer ...`)
- token source: `NODUS_COMPONENTS_WRITE_TOKEN`

Protected endpoints:

- `POST /api/components`
- `PUT /api/components/<type>`
- `DELETE /api/components/<type>`
- `POST /api/components/import`

## Audit fields

Component entity supports:

- `updated_by`
- `change_note` (optional)

## Bulk transfer

- `GET /api/components/export`
- `POST /api/components/import?strategy=skip|overwrite|merge`

Import response includes summary counters:

- `created`
- `updated`
- `skipped`
- `failed`
