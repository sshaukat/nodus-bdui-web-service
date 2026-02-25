(function registerNavbarComponent(global) {
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

  register("navbar", {
    render(ctx, node) {
      const element = document.createElement("header");
      element.className = "node node-navbar";
      applyLayout(element, node.layout);

      const left = document.createElement("div");
      left.className = "node-navbar-left";
      const showBack = node.showBack !== false;
      if (showBack) {
        left.appendChild(
          createIconButton({
            icon: typeof node.backIcon === "string" ? node.backIcon : "arrow-left",
            title: typeof node.backTitle === "string" ? node.backTitle : "Back",
            action: resolveBackAction(node),
            sourceId: node.id,
            ctx,
          }),
        );
      }

      const center = document.createElement("div");
      center.className = "node-navbar-center";

      const title = document.createElement("p");
      title.className = "node-navbar-title";
      title.textContent = typeof node.title === "string" && node.title.trim() ? node.title : "";
      center.appendChild(title);

      if (typeof node.subtitle === "string" && node.subtitle.trim()) {
        const subtitle = document.createElement("p");
        subtitle.className = "node-navbar-subtitle";
        subtitle.textContent = node.subtitle.trim();
        center.appendChild(subtitle);
      }

      const right = document.createElement("div");
      right.className = "node-navbar-actions";
      normalizeActions(node.actions).forEach((actionItem) => {
        right.appendChild(
          createIconButton({
            icon: actionItem.icon,
            title: actionItem.title,
            action: actionItem.action,
            sourceId: node.id,
            ctx,
          }),
        );
      });

      element.appendChild(left);
      element.appendChild(center);
      element.appendChild(right);
      return element;
    },
  });

  function resolveBackAction(node) {
    if (node && node.backButtonClick && typeof node.backButtonClick === "object") {
      return node.backButtonClick;
    }
    if (node && node.backAction && typeof node.backAction === "object") {
      return node.backAction;
    }
    return {
      type: "navigate",
      route: "back",
    };
  }

  function normalizeActions(actions) {
    if (!Array.isArray(actions)) {
      return [];
    }

    return actions
      .map((item, index) => {
        if (typeof item === "string") {
          return {
            icon: item,
            title: `action ${index + 1}`,
            action: { type: "log", value: `navbar action ${index + 1}` },
          };
        }
        if (!item || typeof item !== "object") {
          return null;
        }
        return {
          icon: typeof item.icon === "string" ? item.icon : "menu",
          title: typeof item.title === "string" && item.title.trim() ? item.title.trim() : `action ${index + 1}`,
          action: typeof item.action === "object" ? item.action : { type: "log", value: `navbar action ${index + 1}` },
        };
      })
      .filter(Boolean);
  }

  function createIconButton({ icon, title, action, sourceId, ctx }) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "node node-icon-button node-navbar-icon-button";

    const iconName = typeof icon === "string" ? icon.toLowerCase() : "menu";
    const iconPath = ICONS[iconName] || ICONS.menu;

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

    button.appendChild(iconSvg);
    button.setAttribute("aria-label", title);
    button.setAttribute("title", title);
    button.addEventListener("click", () =>
      ctx.dispatchAction(action, {
        sourceId,
        icon: iconName,
      }),
    );
    return button;
  }
})(window);
