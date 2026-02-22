# Nodus BDUI Web Service (Live Preview)

Nodus BDUI Web Service - это сервис и веб-песочница для сборки контрактов интерфейса в JSON (Backend-Driven UI).
Он нужен для быстрого проектирования экранов: можно собрать схему из компонентов, сразу проверить runtime-валидацию и тут же увидеть визуальный результат в предпросмотре.
Такой подход ускоряет согласование между продуктом, дизайном и разработкой до публикации контракта в целевом backend/runtime.

## Экран Playground

Основной экран песочницы разделен на четыре рабочие области:
- `Контекст контракта`: выбор `проект / контракт / версия / экран` и операции со схемой экрана.
- `Каталог компонентов` слева: готовые шаблоны узлов и кнопка быстрого добавления в JSON.
- `Редактор схемы` по центру: редактирование контракта экрана с форматированием и очисткой до базового шаблона формы.
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

## Run

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
