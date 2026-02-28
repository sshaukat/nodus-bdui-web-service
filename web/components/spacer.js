(function registerSpacerComponent(global) {
  const { register } = global.NodusComponents;
  const { applyLayout } = global.NodusComponentHelpers;

  register("spacer", {
    render(ctx, node) {
      const element = document.createElement("div");
      element.className = "node node-spacer";
      applyLayout(element, node.layout);
      return element;
    },
  });
})(window);
