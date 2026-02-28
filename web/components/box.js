(function registerBoxComponent(global) {
  const { register } = global.NodusComponents;
  const { applyLayout } = global.NodusComponentHelpers;

  register("box", {
    render(ctx, node) {
      const element = document.createElement("div");
      element.className = "node node-box";
      applyLayout(element, node.layout);

      const children = Array.isArray(node.children) ? node.children : [];
      children.forEach((child) => {
        const rendered = ctx.renderNode(child);
        if (rendered) {
          element.appendChild(rendered);
        }
      });

      return element;
    },
  });
})(window);
