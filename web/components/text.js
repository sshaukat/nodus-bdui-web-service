(function registerTextComponent(global) {
  const { register } = global.NodusComponents;
  const { applyLayout } = global.NodusComponentHelpers;

  register("text", {
    render(ctx, node) {
      const element = document.createElement("p");
      element.className = "node node-text";
      element.textContent = node.value || "";
      applyLayout(element, node.layout);
      return element;
    },
  });
})(window);
