(function registerButtonComponent(global) {
  const { register } = global.NodusComponents;
  const { applyLayout } = global.NodusComponentHelpers;

  register("button", {
    render(ctx, node) {
      const element = document.createElement("button");
      element.className = "node node-button";
      element.textContent = node.title || ctx.t("buttonFallback");
      element.type = "button";
      applyLayout(element, node.layout);

      element.addEventListener("click", () => ctx.dispatchAction(node.action, { sourceId: node.id }));
      return element;
    },
  });
})(window);
