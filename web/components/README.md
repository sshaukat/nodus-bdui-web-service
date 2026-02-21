# Nodus Web Renderer Components

Each node type is rendered by a separate component file.

## Stable component interface

Every component must register itself in the registry and expose the same method:

```js
window.NodusComponents.register("node_type", {
  render(ctx, node) {
    // return HTMLElement
  },
});
```

Where:

- `ctx.renderNode(childNode)` renders nested nodes.
- `ctx.dispatchAction(action, context)` dispatches runtime actions.
- `ctx.t(key)` returns localized strings.
- `ctx.inputState` is local state storage for inputs.

## Current components

- `column.js`
- `row.js`
- `box.js`
- `text.js`
- `button.js`
- `iconbutton.js`
- `spacer.js`
- `input.js`

You can change layout/markup/styles inside any component without changing runtime API.
