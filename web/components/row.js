(function registerRowComponent(global) {
  const { register } = global.NodusComponents;
  const { applyLayout } = global.NodusComponentHelpers;

  register("row", {
    render(ctx, node) {
      const element = document.createElement("div");
      element.className = "node node-row";
      applyLayout(element, node.layout);
      element.style.justifyContent = resolveRowJustify(node);
      element.style.alignItems = resolveRowCrossAlign(node);

      if (typeof node.wrap === "string") {
        const wrapValue = node.wrap.toLowerCase();
        if (wrapValue === "nowrap" || wrapValue === "wrap" || wrapValue === "wrap-reverse") {
          element.style.flexWrap = wrapValue;
        }
      }

      if (Number.isFinite(node.gap)) {
        element.style.gap = `${node.gap}px`;
      }

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

  function resolveRowJustify(node) {
    const source = [
      node && node.justify,
      node && node.distribution,
      node && node.layout && node.layout.justify,
      node && node.layout && node.layout.distribution,
    ]
      .find((value) => typeof value === "string") || "left";

    switch (source.toLowerCase()) {
      case "left":
      case "start":
      case "flex-start":
        return "flex-start";
      case "right":
      case "end":
      case "flex-end":
        return "flex-end";
      case "center":
        return "center";
      case "space-between":
      case "between":
        return "space-between";
      case "space-around":
        return "space-around";
      case "space-evenly":
        return "space-evenly";
      default:
        return "flex-start";
    }
  }

  function resolveRowCrossAlign(node) {
    const source = [
      node && node.crossAlign,
      node && node.alignItems,
      node && node.layout && node.layout.crossAlign,
      node && node.layout && node.layout.alignItems,
    ].find((value) => typeof value === "string");

    if (!source) {
      return "center";
    }

    switch (source.toLowerCase()) {
      case "top":
      case "start":
      case "flex-start":
        return "flex-start";
      case "bottom":
      case "end":
      case "flex-end":
        return "flex-end";
      case "stretch":
        return "stretch";
      case "baseline":
        return "baseline";
      default:
        return "center";
    }
  }
})(window);
