(function initNodusShared(global) {
  function numberOrZero(value) {
    return Number.isFinite(value) ? value : 0;
  }

  function toSpacing(spacing) {
    const top = numberOrZero(spacing.top);
    const right = numberOrZero(spacing.right);
    const bottom = numberOrZero(spacing.bottom);
    const left = numberOrZero(spacing.left);
    return `${top}px ${right}px ${bottom}px ${left}px`;
  }

  function applyLayout(element, layout) {
    if (!layout || typeof layout !== "object") {
      return;
    }

    if (layout.padding) {
      element.style.padding = toSpacing(layout.padding);
    }

    if (layout.margin) {
      element.style.margin = toSpacing(layout.margin);
    }

    if (typeof layout.width === "string") {
      element.style.width = layout.width;
    }

    if (typeof layout.height === "string") {
      element.style.height = layout.height;
    }

    if (typeof layout.weight === "number") {
      element.style.flexGrow = String(layout.weight);
    }

    if (typeof layout.alignment === "string") {
      const value = layout.alignment.toLowerCase();
      if (value === "center") {
        element.style.alignSelf = "center";
      } else if (value === "end") {
        element.style.alignSelf = "flex-end";
      } else {
        element.style.alignSelf = "flex-start";
      }
    }
  }

  global.NodusComponentHelpers = {
    applyLayout,
  };
})(window);
