import { memo, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
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

function svgIcon(path: string, title: string): JSX.Element {
  return (
    <>
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="node-icon-button-svg">
        <path d={path} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="sr-only">{title}</span>
    </>
  );
}

function normalizeCustomIconName(raw: string): string | null {
  const normalized = raw.trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  if (!/^[a-z0-9][a-z0-9._-]{0,63}$/.test(normalized)) {
    return null;
  }
  return normalized;
}

function resolveIconReference(iconRaw: unknown): { kind: "library" | "custom"; name: string } {
  if (typeof iconRaw === "string") {
    const normalized = iconRaw.trim().toLowerCase();
    if (!normalized) {
      return { kind: "library", name: "menu" };
    }
    if (normalized.startsWith("custom:")) {
      const customName = normalizeCustomIconName(normalized.slice("custom:".length));
      return customName ? { kind: "custom", name: customName } : { kind: "library", name: "menu" };
    }
    if (normalized.startsWith("library:")) {
      return { kind: "library", name: normalized.slice("library:".length) || "menu" };
    }
    return { kind: "library", name: normalized };
  }

  if (iconRaw && typeof iconRaw === "object") {
    const record = iconRaw as Record<string, unknown>;
    if (record.icon !== undefined) {
      return resolveIconReference(record.icon);
    }

    const source = String(record.source || "library").trim().toLowerCase();
    const name = String(record.name || "").trim().toLowerCase();

    if (source === "custom") {
      const customName = normalizeCustomIconName(name);
      return customName ? { kind: "custom", name: customName } : { kind: "library", name: "menu" };
    }

    return { kind: "library", name: name || "menu" };
  }

  return { kind: "library", name: "menu" };
}

function CustomIcon({ name, title }: { name: string; title: string }): JSX.Element {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return svgIcon(ICONS.menu, title);
  }

  return (
    <>
      <img
        src={`/assets/icons/custom/${encodeURIComponent(name)}`}
        alt=""
        aria-hidden="true"
        className="node-icon-custom"
        onError={() => setFailed(true)}
      />
      <span className="sr-only">{title}</span>
    </>
  );
}

function iconButton(iconRaw: unknown, title: string): JSX.Element {
  const icon = resolveIconReference(iconRaw);
  if (icon.kind === "custom") {
    return <CustomIcon name={icon.name} title={title} />;
  }
  return svgIcon(ICONS[icon.name] || ICONS.menu, title);
}

function isNodeObject(value: unknown): value is BduiNode {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function resolveTitleAlign(node: BduiNode): "start" | "center" {
  const raw = [node.titleAlign, node.titleHorizontalAlign].find((item) => typeof item === "string");
  const value = String(raw || "center").toLowerCase();
  if (["start", "left", "flex-start"].includes(value)) {
    return "start";
  }
  return "center";
}

function resolveMaxLines(value: unknown, fallback = 1): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    const normalized = Math.floor(value);
    if (normalized >= 1) {
      return normalized;
    }
  }
  return fallback;
}

function textClampStyle(maxLines: number): CSSProperties {
  if (maxLines <= 1) {
    return {};
  }
  return {
    display: "-webkit-box",
    WebkitBoxOrient: "vertical",
    WebkitLineClamp: maxLines,
    whiteSpace: "normal",
    overflow: "hidden",
    textOverflow: "ellipsis",
  };
}

interface NormalizedNavbarAction {
  icon: unknown;
  title: string;
  action: BduiAction;
}

function normalizeNavbarAction(item: unknown, index: number): NormalizedNavbarAction {
  const defaultAction: BduiAction = { type: "log", value: `navbar action ${index + 1}` };
  const defaultTitle = `action ${index + 1}`;

  if (typeof item === "string") {
    return {
      icon: item,
      title: defaultTitle,
      action: defaultAction,
    };
  }

  if (item && typeof item === "object") {
    const record = item as Record<string, unknown>;
    const seemsActionObject = record.icon !== undefined || record.title !== undefined || record.action !== undefined;

    if (seemsActionObject) {
      return {
        icon: record.icon ?? "menu",
        title: String(record.title || defaultTitle),
        action: (record.action as BduiAction) || defaultAction,
      };
    }

    return {
      icon: record,
      title: defaultTitle,
      action: defaultAction,
    };
  }

  return {
    icon: "menu",
    title: defaultTitle,
    action: defaultAction,
  };
}

interface NavbarNodeProps extends PreviewRendererProps {
  node: BduiNode;
  style: CSSProperties;
  disabled: boolean;
}

function NavbarNode({ node, style, disabled, inputValues, onInputChange, onAction, buttonFallback }: NavbarNodeProps): JSX.Element {
  const leftRef = useRef<HTMLDivElement | null>(null);
  const rightRef = useRef<HTMLDivElement | null>(null);
  const [sideWidth, setSideWidth] = useState(34);

  useLayoutEffect(() => {
    const updateSideWidth = () => {
      const leftWidth = Math.ceil(leftRef.current?.getBoundingClientRect().width || 0);
      const rightWidth = Math.ceil(rightRef.current?.getBoundingClientRect().width || 0);
      const next = Math.max(34, leftWidth, rightWidth);
      setSideWidth((current) => (current === next ? current : next));
    };

    updateSideWidth();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateSideWidth);
      return () => window.removeEventListener("resize", updateSideWidth);
    }

    const observer = new ResizeObserver(() => updateSideWidth());
    if (leftRef.current) {
      observer.observe(leftRef.current);
    }
    if (rightRef.current) {
      observer.observe(rightRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const actionsRaw = Array.isArray(node.actions) ? node.actions : [];
  const actions = actionsRaw.map((item, index) => normalizeNavbarAction(item, index));
  const showBack = node.showBack !== false && node.showLeftButton !== false;
  const titleAlign = resolveTitleAlign(node);
  const titleMaxLines = resolveMaxLines(node.titleMaxLines, 1);
  const subtitleMaxLines = resolveMaxLines(node.subtitleMaxLines, 1);
  const hasCenterContent = isNodeObject(node.centerContent);
  const hasSubtitle = typeof node.subtitle === "string" && node.subtitle.trim().length > 0;

  const classNames = [
    "node",
    "node-navbar",
    titleAlign === "start" ? "node-navbar--title-start" : "node-navbar--title-center",
    hasCenterContent ? "node-navbar--center-content" : "",
    !hasSubtitle && !hasCenterContent ? "node-navbar--single-line" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const navbarStyle: CSSProperties = { ...style };
  (navbarStyle as Record<string, string>)["--navbar-side-width"] = `${sideWidth}px`;

  return (
    <header className={classNames} style={navbarStyle}>
      <div className="node-navbar-left" ref={leftRef}>
        {showBack ? (
          <button
            type="button"
            disabled={disabled}
            className="node node-icon-button node-navbar-icon-button"
            onClick={() =>
              onAction((node.backAction || node.backButtonClick || node.leftAction || { type: "navigate", route: "back" }) as BduiAction, {
                sourceId: node.id,
                icon: node.backIcon || node.leftIcon || "arrow-left",
              })
            }
          >
            {iconButton(node.backIcon || node.leftIcon || "arrow-left", String(node.backTitle || node.leftTitle || "Back"))}
          </button>
        ) : (
          <span className="node-navbar-placeholder" aria-hidden="true" />
        )}
      </div>

      <div className="node-navbar-center">
        {hasCenterContent && node.centerContent ? (
          <NodeRenderer
            node={node.centerContent}
            inputValues={inputValues}
            onInputChange={onInputChange}
            onAction={onAction}
            buttonFallback={buttonFallback}
          />
        ) : (
          <>
            <p className="node-navbar-title" style={textClampStyle(titleMaxLines)}>
              {String(node.title || "")}
            </p>
            {hasSubtitle ? (
              <p className="node-navbar-subtitle" style={textClampStyle(subtitleMaxLines)}>
                {String(node.subtitle)}
              </p>
            ) : null}
          </>
        )}
      </div>

      <div className="node-navbar-actions" ref={rightRef}>
        {actions.map((item, index) => (
          <button
            key={`${String(item.title)}_${index}`}
            type="button"
            disabled={disabled}
            className="node node-icon-button node-navbar-icon-button"
            onClick={() => onAction(item.action, { sourceId: node.id, icon: item.icon, actionIndex: index })}
          >
            {iconButton(item.icon, String(item.title))}
          </button>
        ))}
      </div>
    </header>
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
    const label = String(node.title || (typeof node.icon === "string" ? node.icon : "icon"));
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
        {iconButton(node.icon || "menu", label)}
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
    return (
      <NavbarNode
        node={node}
        style={style}
        disabled={disabled}
        inputValues={inputValues}
        onInputChange={onInputChange}
        onAction={onAction}
        buttonFallback={buttonFallback}
      />
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
