import type { BduiNode, ComponentItem, Locale, SchemaVersion } from "../types";

export const LOCALE_KEY = "nodus.locale";
export const THEME_KEY = "nodus.theme";
export const LAST_SCHEMA_KEY = "nodus.lastSchema";
export const COMPONENT_LIBRARY_KEY = "nodus.componentLibrary";
export const COMPONENT_WRITE_TOKEN_KEY = "nodus.componentsWriteToken";

export const SUPPORTED_LOCALES: Locale[] = ["ru", "en"];
export const SUPPORTED_THEMES = ["light", "dark"] as const;
export type ThemeMode = (typeof SUPPORTED_THEMES)[number];

export const THEME_ICONS: Record<ThemeMode, string> = {
  light: "/assets/sun.png",
  dark: "/assets/moon.png",
};

export const FORM_SCHEMA_TEMPLATE: BduiNode & { schemaVersion: SchemaVersion } = {
  schemaVersion: "v0_2",
  type: "column",
  id: "form",
  layout: {
    padding: {
      top: 8,
      right: 8,
      bottom: 8,
      left: 8,
    },
  },
  children: [],
};

export const DEFAULT_COMPONENT_LIBRARY: ComponentItem[] = [
  {
    type: "text",
    title: { ru: "Текст", en: "Text" },
    description: { ru: "Текстовый блок", en: "Simple text block" },
    fields: { ru: "value", en: "value" },
    template: {
      type: "text",
      id: "text_1",
      value: "Hello from Nodus",
    },
  },
  {
    type: "input",
    title: { ru: "Инпут", en: "Input" },
    description: { ru: "Текстовый ввод", en: "Text input" },
    fields: { ru: "placeholder, value", en: "placeholder, value" },
    template: {
      type: "input",
      id: "input_1",
      placeholder: "Type value",
      value: "",
      onChange: { type: "log", value: "input changed" },
    },
  },
  {
    type: "button",
    title: { ru: "Кнопка", en: "Button" },
    description: { ru: "Кнопка действия", en: "Action button" },
    fields: { ru: "title, action", en: "title, action" },
    template: {
      type: "button",
      id: "button_1",
      title: "Continue",
      action: { type: "log", value: "button tapped" },
    },
  },
  {
    type: "row",
    title: { ru: "Горизонтальный контейнер", en: "Row" },
    description: { ru: "Контейнер по горизонтали", en: "Horizontal layout container" },
    fields: { ru: "children, justify, gap", en: "children, justify, gap" },
    template: {
      type: "row",
      id: "row_1",
      justify: "space-between",
      gap: 12,
      children: [
        { type: "text", id: "row_title", value: "Row title" },
        { type: "iconbutton", id: "row_action", icon: "settings", title: "Settings", action: { type: "log", value: "settings" } },
      ],
    },
  },
  {
    type: "navbar",
    title: { ru: "Навбар", en: "Navbar" },
    description: { ru: "Верхняя панель", en: "Top app bar" },
    fields: { ru: "title, subtitle, actions", en: "title, subtitle, actions" },
    template: {
      type: "navbar",
      id: "navbar_main",
      title: "Nodus",
      subtitle: "BDUI Playground",
      actions: [
        { icon: "search", title: "Search", action: { type: "log", value: "search" } },
        { icon: "menu", title: "Menu", action: { type: "log", value: "menu" } },
      ],
    },
  },
  {
    type: "custom-nav-bar",
    title: { ru: "Кастомный NavBar", en: "Custom NavBar" },
    description: { ru: "Базовый навбар с parser-поддержкой", en: "Base nav bar with parser support" },
    fields: {
      ru: "showLeftButton, leftIcon, leftAction, title, subtitle, titleHorizontalAlign, centerContent, actions",
      en: "showLeftButton, leftIcon, leftAction, title, subtitle, titleHorizontalAlign, centerContent, actions",
    },
    template: {
      type: "custom-nav-bar",
      id: "custom_navbar_1",
      showLeftButton: true,
      leftIcon: "arrow-left",
      leftAction: { type: "navigate", route: "back" },
      title: "Nodus",
      subtitle: "Contract preview",
      titleHorizontalAlign: "center",
      actions: [
        { icon: "search", title: "Search", action: { type: "log", value: "search" } },
        { icon: "menu", title: "Menu", action: { type: "log", value: "menu" } },
      ],
    },
  },
];
