# 11. Custom Nav Bar Rollout

## Delivery summary

PRD-05 закрывает перевод `custom-nav-bar` в базовый компонент на backend + frontend.

## What changed

1. Runtime
- `custom-nav-bar` добавлен в поддерживаемые типы;
- parser-нормализация в `navbar`;
- расширенная валидация `navbar` полей и actions.

2. API
- `GET /api/icons`;
- безопасная выдача custom icons через `/assets/icons/custom/*`.

3. Frontend preview
- поддержка custom icon references;
- поддержка `centerContent`;
- режимы `titleAlign: start|center`;
- левый control (`showLeftButton`, `leftAction`, `leftIcon`).

4. Catalog defaults
- обновлен default template `custom-nav-bar`.

## Rollout checklist

1. Убедиться, что каталог `data/icons/custom` содержит только допустимые имена и форматы.
2. Прогнать тесты:
- `python3 -m unittest ...`
- `bash tests/smoke_api.sh`
- `cd frontend && npm run build`
3. Проверить UI-сценарии:
- `titleAlign=center` не сдвигается при нескольких actions;
- `titleAlign=start` начинается после левой кнопки;
- `centerContent` имеет приоритет над `title/subtitle`.

## Fallback policy

- `navbar` остается поддерживаемым;
- при невалидной/отсутствующей custom icon используется fallback `menu`;
- при ошибках контракта publish блокируется с explicit validation details.
