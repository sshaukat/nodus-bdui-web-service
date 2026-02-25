(function registerTextComponent(global) {
  const { register } = global.NodusComponents;
  const { applyLayout } = global.NodusComponentHelpers;

  register("text", {
    render(ctx, node) {
      const element = document.createElement("p");
      element.className = "node node-text";
      element.textContent = node.value || "";
      applyLayout(element, node.layout);
      applyTextAlignment(element, node.layout);
      return element;
    },
  });

  function applyTextAlignment(element, layout) {
    if (!layout || typeof layout !== "object") {
      return;
    }

    if (typeof layout.weight === "number") {
      // Let weighted text occupy the full flexible middle slot.
      element.style.flexBasis = "0";
    }

    if (typeof layout.alignment !== "string") {
      return;
    }

    const value = layout.alignment.toLowerCase();
    if (value === "center") {
      element.style.textAlign = "center";
      return;
    }
    if (value === "end" || value === "right") {
      element.style.textAlign = "right";
      return;
    }
    element.style.textAlign = "left";
  }
})(window);
