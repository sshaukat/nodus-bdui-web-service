import { memo, type CSSProperties } from "react";
import type { BduiAction, BduiNode, Layout } from "../types";

interface PreviewRendererProps {
  node: BduiNode | null;
  inputValues: Record<string, string>;
  onInputChange: (id: string, value: string, action?: BduiAction) => void;
  onAction: (action?: BduiAction, meta?: Record<string, unknown>) => void;
  buttonFallback: string;
}

const ICONS: Record<string, string> = {
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

function toSpacing(spacing?: Layout["padding"]): string | undefined {
  if (!spacing) {
    return undefined;
  }
  const top = Number.isFinite(spacing.top) ? spacing.top : 0;
  const right = Number.isFinite(spacing.right) ? spacing.right : 0;
  const bottom = Number.isFinite(spacing.bottom) ? spacing.bottom : 0;
  const left = Number.isFinite(spacing.left) ? spacing.left : 0;
  return `${top}px ${right}px ${bottom}px ${left}px`;
}

function layoutStyle(layout?: Layout): CSSProperties {
  if (!layout) {
    return {};
  }
  const style: CSSProperties = {};
  const padding = toSpacing(layout.padding);
  if (padding) {
    style.padding = padding;
  }
  const margin = toSpacing(layout.margin);
  if (margin) {
    style.margin = margin;
  }
  if (typeof layout.width === "string") {
    style.width = layout.width;
  }
  if (typeof layout.height === "string") {
    style.height = layout.height;
  }
  if (typeof layout.weight === "number") {
    style.flexGrow = layout.weight;
  }
  if (typeof layout.alignment === "string") {
    const lower = layout.alignment.toLowerCase();
    if (lower === "center") {
      style.alignSelf = "center";
    } else if (lower === "end") {
      style.alignSelf = "flex-end";
    } else {
      style.alignSelf = "flex-start";
    }
  }
  return style;
}

function resolveRowJustify(node: BduiNode): CSSProperties["justifyContent"] {
  const raw = [node.justify, node.distribution, node.layout?.justify, node.layout?.distribution].find(
    (item) => typeof item === "string",
  );
  const value = String(raw || "left").toLowerCase();
  if (["start", "left", "flex-start"].includes(value)) {
    return "flex-start";
  }
  if (["end", "right", "flex-end"].includes(value)) {
    return "flex-end";
  }
  if (value === "center") {
    return "center";
  }
  if (["space-between", "between"].includes(value)) {
    return "space-between";
  }
  if (value === "space-around") {
    return "space-around";
  }
  if (value === "space-evenly") {
    return "space-evenly";
  }
  return "flex-start";
}

function resolveRowCrossAlign(node: BduiNode): CSSProperties["alignItems"] {
  const raw = [node.crossAlign, node.alignItems, node.layout?.crossAlign, node.layout?.alignItems].find(
    (item) => typeof item === "string",
  );
  const value = String(raw || "center").toLowerCase();
  if (["start", "top", "flex-start"].includes(value)) {
    return "flex-start";
  }
  if (["end", "bottom", "flex-end"].includes(value)) {
    return "flex-end";
  }
  if (value === "stretch") {
    return "stretch";
  }
  if (value === "baseline") {
    return "baseline";
  }
  return "center";
}

function iconButton(iconNameRaw: string, title: string): JSX.Element {
  const iconName = iconNameRaw.toLowerCase();
  const path = ICONS[iconName] || ICONS.menu;
  return (
    <>
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="node-icon-button-svg">
        <path d={path} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="sr-only">{title}</span>
    </>
  );
}

function NodeRenderer({
  node,
  inputValues,
  onInputChange,
  onAction,
  buttonFallback,
}: PreviewRendererProps & { node: BduiNode }): JSX.Element | null {
  if (node.visible === false) {
    return null;
  }
  const disabled = node.enabled === false;
  const style = layoutStyle(node.layout);

  if (node.type === "column") {
    return (
      <div className="node node-column" style={style}>
        {(node.children || []).map((child, index) => (
          <NodeRenderer
            key={String(child.id || `${child.type || "node"}_${index}`)}
            node={child}
            inputValues={inputValues}
            onInputChange={onInputChange}
            onAction={onAction}
            buttonFallback={buttonFallback}
          />
        ))}
      </div>
    );
  }

  if (node.type === "row") {
    const rowStyle: CSSProperties = {
      ...style,
      justifyContent: resolveRowJustify(node),
      alignItems: resolveRowCrossAlign(node),
    };
    if (typeof node.wrap === "string") {
      rowStyle.flexWrap = node.wrap as CSSProperties["flexWrap"];
    }
    if (Number.isFinite(node.gap)) {
      rowStyle.gap = `${node.gap}px`;
    }

    return (
      <div className="node node-row" style={rowStyle}>
        {(node.children || []).map((child, index) => (
          <NodeRenderer
            key={String(child.id || `${child.type || "node"}_${index}`)}
            node={child}
            inputValues={inputValues}
            onInputChange={onInputChange}
            onAction={onAction}
            buttonFallback={buttonFallback}
          />
        ))}
      </div>
    );
  }

  if (node.type === "box") {
    return (
      <div className="node node-box" style={style}>
        {(node.children || []).map((child, index) => (
          <NodeRenderer
            key={String(child.id || `${child.type || "node"}_${index}`)}
            node={child}
            inputValues={inputValues}
            onInputChange={onInputChange}
            onAction={onAction}
            buttonFallback={buttonFallback}
          />
        ))}
      </div>
    );
  }

  if (node.type === "text") {
    const textStyle: CSSProperties = { ...style };
    if (typeof node.layout?.alignment === "string") {
      const align = node.layout.alignment.toLowerCase();
      textStyle.textAlign = align === "center" ? "center" : align === "right" || align === "end" ? "right" : "left";
    }
    if (typeof node.layout?.weight === "number") {
      textStyle.flexBasis = 0;
    }
    return (
      <p className="node node-text" style={textStyle}>
        {String(node.value || "")}
      </p>
    );
  }

  if (node.type === "button") {
    return (
      <button
        type="button"
        className="node node-button"
        style={style}
        disabled={disabled}
        onClick={() => onAction(node.action, { sourceId: node.id })}
      >
        {String(node.title || buttonFallback)}
      </button>
    );
  }

  if (node.type === "iconbutton") {
    const label = String(node.title || node.icon || "icon");
    return (
      <button
        type="button"
        className="node node-icon-button"
        style={style}
        disabled={disabled}
        aria-label={label}
        title={label}
        onClick={() => onAction(node.action, { sourceId: node.id, icon: node.icon })}
      >
        {iconButton(String(node.icon || "menu"), label)}
      </button>
    );
  }

  if (node.type === "spacer") {
    return <div className="node node-spacer" style={style} />;
  }

  if (node.type === "input") {
    const nodeId = String(node.id || "");
    const value = nodeId ? inputValues[nodeId] ?? String(node.value || "") : String(node.value || "");
    return (
      <input
        className="node node-input"
        style={style}
        type="text"
        value={value}
        disabled={disabled}
        placeholder={String(node.placeholder || "")}
        onChange={(event) => {
          if (nodeId) {
            onInputChange(nodeId, event.target.value, node.onChange);
          } else {
            onAction(node.onChange, { value: event.target.value });
          }
        }}
      />
    );
  }

  if (node.type === "navbar") {
    const actions = Array.isArray(node.actions) ? node.actions : [];
    return (
      <header className="node node-navbar" style={style}>
        <div className="node-navbar-left">
          {node.showBack !== false ? (
            <button
              type="button"
              className="node node-icon-button node-navbar-icon-button"
              onClick={() => onAction((node.backButtonClick || node.backAction || { type: "navigate", route: "back" }) as BduiAction, { sourceId: node.id })}
            >
              {iconButton(String(node.backIcon || "arrow-left"), String(node.backTitle || "Back"))}
            </button>
          ) : null}
        </div>
        <div className="node-navbar-center">
          <p className="node-navbar-title">{String(node.title || "")}</p>
          {typeof node.subtitle === "string" && node.subtitle.trim() ? <p className="node-navbar-subtitle">{node.subtitle}</p> : null}
        </div>
        <div className="node-navbar-actions">
          {actions.map((item, index) => {
            const normalized =
              typeof item === "string"
                ? { icon: item, title: `action ${index + 1}`, action: { type: "log", value: `navbar action ${index + 1}` } }
                : {
                    icon: item?.icon || "menu",
                    title: item?.title || `action ${index + 1}`,
                    action: item?.action || { type: "log", value: `navbar action ${index + 1}` },
                  };
            return (
              <button
                key={`${normalized.icon}_${index}`}
                type="button"
                className="node node-icon-button node-navbar-icon-button"
                onClick={() => onAction(normalized.action, { sourceId: node.id, icon: normalized.icon })}
              >
                {iconButton(String(normalized.icon), String(normalized.title))}
              </button>
            );
          })}
        </div>
      </header>
    );
  }

  return null;
}

function PreviewRendererInternal(props: PreviewRendererProps): JSX.Element {
  if (!props.node) {
    return <div className="preview-empty" />;
  }
  return (
    <NodeRenderer
      node={props.node}
      inputValues={props.inputValues}
      onInputChange={props.onInputChange}
      onAction={props.onAction}
      buttonFallback={props.buttonFallback}
    />
  );
}

export const PreviewRenderer = memo(PreviewRendererInternal);
