# Nodus BDUI Web Service (Live Preview)

Nodus BDUI Web Service - это сервис и веб-песочница для сборки контрактов интерфейса в JSON (Backend-Driven UI).
Он нужен для быстрого проектирования экранов: можно собрать схему из компонентов, сразу проверить runtime-валидацию и тут же увидеть визуальный результат в предпросмотре.
Такой подход ускоряет согласование между продуктом, дизайном и разработкой до публикации контракта в целевом backend/runtime.

## Экран Playground

Основной экран песочницы разделен на четыре рабочие области:
- `Контекст контракта`: выбор `проект / контракт / версия / экран` и операции со схемой экрана.
- `Каталог компонентов` слева: готовые шаблоны узлов, добавление в JSON, создание/редактирование/удаление компонентов.
- `Редактор схемы` по центру: редактирование контракта экрана на базе CodeMirror 6 с форматированием и очисткой до базового шаблона формы.
- `Предпросмотр` справа: live-рендер схемы, обновление runtime и визуальная проверка результата.

Нижняя часть содержит:
- `Валидация`: ошибки/статус decode+validate.
- `Лента действий`: события редактора и runtime.

![Экран BDUI Playground](docs/images/bdui-playground-screen.png)

## Контекст контракта и публикация

Верхний блок `Контекст контракта` управляет тем, где именно хранится текущая схема:

- `Проект -> Контракт -> Версия -> Схема экрана`.
- `Сохранить экран` сохраняет JSON редактора в **выбранный экран выбранной версии**.
  Сохранение draft выполняется даже если JSON невалиден.
- `Загрузить` загружает произвольный `.json` и применяет его как шаблон для выбранного экрана.
- `Публиковать` создает новый immutable publication-артефакт для выбранной версии.

Важно:

- публикация **не** происходит автоматически при сохранении или загрузке экрана;
- публикация блокируется, если хотя бы один `active` экран версии содержит ошибку JSON или validation-ошибки;
- каждая публикация выполняется только по явной кнопке `Публиковать` (или `POST /api/publish`);
- поэтому у одной версии (`v0-1`) может быть несколько публикаций.

Получение опубликованных схем:

- список: `GET /schemas`
- конкретная схема: `GET /schema/<project>:<contract>:<version>:<screen>`
  пример: `GET /schema/demo:main-contract:v0-1:home`
- альтернативный формат: `GET /schema/<project>/<contract>/<version>/<screen>`
- получить конкретную публикацию: `GET /schema/<project>/<contract>/<version>/<screen>?pub_id=pub-...`

Политика хранения публикаций:

- хранятся публикации за последние 31 день (последний месяц);
- очистка старых публикаций выполняется автоматически.

## Frontend stack

Frontend migrated to **React + TypeScript** (Vite, folder `frontend/`).

- Production static bundle is built into `frontend/dist`.
- Python server (`server.py`) serves only `frontend/dist` (or custom path via `NODUS_WEB_DIR`).
- Legacy static folder `web/` removed.
- If `frontend/dist` is missing, static requests return `503 Service Unavailable` with a hint to run the frontend build.

## Run

### Frontend build (React + TypeScript)

```bash
cd bdui-web-service/frontend
npm install
npm run build
```

Then start backend server from repo root:

```bash
cd bdui-web-service
./start-service.sh
```

### Frontend dev mode (Vite + API proxy)

```bash
cd bdui-web-service/frontend
npm install
npm run dev
```

Run backend API in parallel:

```bash
cd bdui-web-service
./start-service.sh
```

### One-time foreground run

```bash
cd bdui-web-service
./start-service.sh
```

Open `http://127.0.0.1:8080`.

Custom host/port:

```bash
HOST=0.0.0.0 PORT=8090 ./start-service.sh
```

### Background service scripts

Restart service in background (single command):

```bash
cd bdui-web-service
./restart-service.sh
```

Stop background service:

```bash
cd bdui-web-service
./stop-service.sh
```

For background mode:

- PID file: `.server.pid`
- Log file: `.server.log`

## Live Preview: quick schema assembly

- In the left `Каталог компонентов / Component Library` panel choose a component card.
- Click `Добавить / Add` to insert that JSON template into the current cursor position in the schema editor.
- Open `JSON шаблон и поля / JSON template and fields` to inspect the exact JSON and field hints before inserting.
- Save changes into current context with `Сохранить экран / Save Screen`.
- `Сохранить экран / Save Screen` is highlighted while current JSON has unsaved changes and returns to normal state after a successful save.
- The schema editor expand/collapse button switches icon by state: expand uses `full-size`, collapse uses `minimize-arrows`.

## Component Library: storage and editor

- `Новый`, `✎`, `×` in `Каталог компонентов` open component CRUD flows.
- Component editor supports full JSON editing via CodeMirror (`Template JSON` field).
- Components are persisted on backend in files under `data/components/<type>.json`.
- Frontend uses backend as source of truth (`/api/components`) and keeps `localStorage` cache as fallback.
- On first load after update, local `localStorage` component catalog is migrated to backend if backend storage is empty.
- Write operations are protected by token (`NODUS_COMPONENTS_WRITE_TOKEN`, header `X-Components-Token`).
- Components support audit fields: `updated_by`, `change_note`.
- Bulk transfer endpoints: `GET /api/components/export`, `POST /api/components/import?strategy=skip|overwrite|merge`.

## Common node flags

All node types support:

- `visible: boolean` — hide/show node in preview (if `false`, node is not rendered).
- `enabled: boolean` — disable node interactions in preview.

Backward-compatibility:

- typo alias `viible` is treated as `visible`.

Schema versioning:

- payloads and stored drafts/publications include `schemaVersion` / `schema_version`;
- runtime decode/validate response returns `appliedSchemaVersion`;
- `v0_2` requires explicit schema version.

## Error envelope and metrics

- API errors are returned as structured envelope:
  `error.code`, `error.message`, `error.details`, `trace_id`, `timestamp`.
- Every response includes `X-Trace-Id`.
- Metrics endpoint: `GET /metrics`.

## Endpoints

- `GET /api/health`
- `POST /api/decode-validate`
- `GET /api/projects`
- `POST /api/projects`
- `GET /api/contracts?project_id=<id>`
- `POST /api/contracts`
- `GET /api/versions?project_id=<id>&contract_id=<id>`
- `POST /api/versions`
- `GET /api/screens?project_id=<id>&contract_id=<id>&version_id=<id>`
- `POST /api/screens`
- `PUT /api/screens/<screen_id>?project_id=<id>&contract_id=<id>&version_id=<id>`
- `PATCH /api/screens/<screen_id>/status?project_id=<id>&contract_id=<id>&version_id=<id>`
- `POST /api/publish`
- `GET /api/components`
- `POST /api/components`
- `PUT /api/components/<type>`
- `DELETE /api/components/<type>`
- `GET /api/components/export`
- `POST /api/components/import?strategy=skip|overwrite|merge`
- `GET /metrics`
- `GET /schemas`
- `GET /schema/<project>:<contract>:<version>:<screen>`
- `GET /schema/<project>/<contract>/<version>/<screen>`
- `GET /schema/<project>/<contract>/<version>/<screen>?pub_id=<pub_id>`

Example request:

```json
{
  "schema": {
    "type": "text",
    "value": "Hello"
  }
}
```
