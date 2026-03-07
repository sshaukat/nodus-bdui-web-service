# 10. Custom Icons

## Purpose

Добавить безопасный pipeline для пользовательских иконок в `custom-nav-bar` и `navbar` actions.

## Storage

По умолчанию иконки читаются из:

- `data/icons/custom`

Переопределение через env:

- `NODUS_CUSTOM_ICONS_DIR`

## Supported formats

- `.svg`
- `.png`
- `.jpg`
- `.jpeg`
- `.webp`

## Naming rules

Имя иконки (без расширения) должно удовлетворять regex:

- `^[a-z0-9][a-z0-9._-]{0,63}$`

Примеры:

- valid: `help`, `settings-outline`, `kebab.menu`
- invalid: `../secret`, `icon name`, `/abs/path`

## API

1. `GET /api/icons`
- Возвращает `library` и `custom` список.
- Для `custom` возвращается `name`, `ext`, `url`.

2. `GET /assets/icons/custom/<name>`
3. `GET /assets/icons/custom/<name>.<ext>`
- Без расширения backend выбирает первый доступный формат (приоритет: svg -> png -> webp -> jpg -> jpeg).

## Security

- path traversal блокируется;
- невалидные имена отклоняются;
- расширения вне allowlist отклоняются.

## Frontend behavior

- `custom:<name>` рендерится через `<img src="/assets/icons/custom/<name>">`;
- при ошибке загрузки применяется fallback-иконка `menu`.
