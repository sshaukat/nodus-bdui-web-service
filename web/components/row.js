(function registerRowComponent(global) {
  const { register } = global.NodusComponents;
  const { applyLayout } = global.NodusComponentHelpers;

  register("row", {
    render(ctx, node) {
      const element = document.createElement("div");
      element.className = "node node-row";
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
