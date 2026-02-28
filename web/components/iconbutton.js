(function registerIconButtonComponent(global) {
  const { register } = global.NodusComponents;
  const { applyLayout } = global.NodusComponentHelpers;

  const ICONS = {
    plus: "M12 5v14M5 12h14",
    minus: "M5 12h14",
    edit: "M4 20h4l10.5-10.5-4-4L4 16v4zM13.5 6.5l4 4",
    trash: "M5 7h14M9 7V5h6v2M8 7l1 12h6l1-12",
    search: "M11 5a6 6 0 1 1 0 12a6 6 0 0 1 0-12zm5 10l3 3",
    settings: "M12 8a4 4 0 1 1 0 8a4 4 0 0 1 0-8zm0-4v2m0 12v2M4 12h2m12 0h2M6.2 6.2l1.4 1.4m8.8 8.8l1.4 1.4m0-11.6l-1.4 1.4M7.6 16.4l-1.4 1.4",
    check: "M5 12l4 4l10-10",
    close: "M6 6l12 12M18 6l-12 12",
    "arrow-left": "M19 12H6M11 7l-5 5l5 5",
    "arrow-right": "M5 12h13M13 7l5 5l-5 5",
    menu: "M5 7h14M5 12h14M5 17h14",
  };

  register("iconbutton", {
    render(ctx, node) {
      const element = document.createElement("button");
      element.className = "node node-icon-button";
      element.type = "button";
      applyLayout(element, node.layout);

      const iconName = typeof node.icon === "string" ? node.icon.toLowerCase() : "plus";
      const iconPath = ICONS[iconName] || ICONS.plus;

      const iconSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      iconSvg.setAttribute("viewBox", "0 0 24 24");
      iconSvg.setAttribute("aria-hidden", "true");
      iconSvg.setAttribute("focusable", "false");
      iconSvg.classList.add("node-icon-button-svg");

      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", iconPath);
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", "currentColor");
      path.setAttribute("stroke-width", "2");
      path.setAttribute("stroke-linecap", "round");
      path.setAttribute("stroke-linejoin", "round");
      iconSvg.appendChild(path);

      const label = typeof node.title === "string" && node.title.trim() ? node.title.trim() : "";
      element.appendChild(iconSvg);
      element.setAttribute("aria-label", label || `icon ${iconName}`);
      if (label) {
        element.setAttribute("title", label);
      }

      element.addEventListener("click", () => ctx.dispatchAction(node.action, { sourceId: node.id, icon: iconName }));
      return element;
    },
  });
})(window);
