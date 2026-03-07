# 09. Custom Nav Bar Contract (PRD-05)

## Goal

Сделать `custom-nav-bar` базовым компонентом со стабильным parser-поведением и совместимостью на decode/validate/publish путях.

## Supported node types

- source: `custom-nav-bar`
- canonical runtime node: `navbar`

## Contract fields

`custom-nav-bar` поддерживает:

- `showLeftButton: boolean` (default: `true`)
- `leftIcon: string | { source, name }` (default: `arrow-left`)
- `leftAction: BduiAction` (default: `{ type: "navigate", route: "back" }`)
- `leftTitle: string` (default: `Back`)
- `title: string`
- `subtitle: string`
- `titleHorizontalAlign: start | center` (default: `center`)
- `centerContent: BduiNode`
- `actions: Array<string | IconRef | NavbarActionItem>`

## Parser normalization

`custom-nav-bar` нормализуется в `navbar`:

- `showLeftButton -> showBack`
- `leftIcon -> backIcon`
- `leftAction -> backAction`
- `leftTitle -> backTitle`
- `titleHorizontalAlign -> titleAlign`
- `actions[*] -> { icon, title, action }`
- `sourceType = "custom-nav-bar"`

## Action defaults

- левая кнопка: `navigate back` по умолчанию;
- правые actions без action: `log` с сообщением `navbar action N`.

## Icon references

Поддерживаются варианты:

1. Library icon string: `"menu"`, `"search"`, ...
2. Prefixed custom icon: `"custom:help"`
3. Object form:

```json
{ "source": "custom", "name": "help" }
```

## Validation highlights

- `titleAlign` только `start | center`;
- custom icon name: regex `^[a-z0-9][a-z0-9._-]{0,63}$`;
- `actions` должен быть массивом;
- `centerContent` должен быть валидным node object.

## Backward compatibility

- `navbar` остается поддерживаемым типом.
- legacy alias (`showBack`, `backIcon`, `backAction`, `backTitle`) поддерживаются.
