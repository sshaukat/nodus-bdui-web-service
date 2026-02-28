(function registerInputComponent(global) {
  const { register } = global.NodusComponents;
  const { applyLayout } = global.NodusComponentHelpers;

  register("input", {
    render(ctx, node) {
      const input = document.createElement("input");
      input.className = "node node-input";
      input.type = "text";
      input.placeholder = node.placeholder || "";

      if (node.id && ctx.inputState.has(node.id)) {
        input.value = ctx.inputState.get(node.id);
      } else if (typeof node.value === "string") {
        input.value = node.value;
      }

      applyLayout(input, node.layout);

      input.addEventListener("input", (event) => {
        const value = event.target.value;
        if (node.id) {
          ctx.inputState.set(node.id, value);
        }
        ctx.dispatchAction(node.onChange, { sourceId: node.id, value });
      });

      return input;
    },
  });
})(window);
