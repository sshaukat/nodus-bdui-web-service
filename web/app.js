const LOCALE_KEY = "nodus.locale";
const THEME_KEY = "nodus.theme";
const SUPPORTED_LOCALES = ["ru", "en"];
const SUPPORTED_THEMES = ["light", "dark"];
const SAMPLE_SCHEMA_PATH = "/sample.json";
const THEME_ICONS = {
  light: "/assets/sun.png",
  dark: "/assets/moon.png",
};

const I18N = {
  ru: {
    documentTitle: "Nodus Studio - BDUI Playground",
    metaDescription:
      "Nodus Studio: редактирование JSON-схем, валидация runtime-правил и live preview интерфейса.",
    heroTitle: "Песочница Backend-Driven UI",
    heroSubtitle:
      "Собирай контракт экрана в JSON, проверяй runtime-правила и сразу смотри визуальный результат.",
    loadBtn: "Загрузить",
    formatBtn: "Форматировать JSON",
    renderBtn: "Обновить превью",
    saveBtn: "Сохранить",
    editorTitle: "Редактор схемы",
    editorChip: "контракт v0.1",
    previewTitle: "Предпросмотр",
    previewChip: "web-рендерер",
    validationTitle: "Валидация",
    validationChip: "decode + validate",
    actionTitle: "Лента действий",
    actionChip: "локальный runtime",
    noErrors: "Ошибок нет",
    schemaHasErrors: "В схеме есть ошибки. Исправь их, чтобы увидеть превью.",
    buttonFallback: "Кнопка",
    actionLogLabel: "лог",
    actionOpenUrlLabel: "open_url",
    actionNavigateLabel: "navigate",
    actionUnknownLabel: "unknown",
    systemLabel: "система",
    cannotFormatInvalidJson: "невозможно форматировать невалидный JSON",
    fileSaved: "файл сохранен:",
    fileLoaded: "файл загружен:",
    fileSaveError: "ошибка сохранения файла",
    fileLoadError: "ошибка загрузки файла",
    saveDefaultName: "nodus-schema.json",
    themeToggleAria: "Переключить тему",
  },
  en: {
    documentTitle: "Nodus Studio - BDUI Playground",
    metaDescription:
      "Nodus Studio playground for JSON schema editing, runtime validation, and live interface preview.",
    heroTitle: "Backend-Driven UI Playground",
    heroSubtitle:
      "Compose screen contracts in JSON, validate runtime rules, and inspect a live page preview in real time.",
    loadBtn: "Load",
    formatBtn: "Format JSON",
    renderBtn: "Render now",
    saveBtn: "Save",
    editorTitle: "Schema Editor",
    editorChip: "v0.1 contract",
    previewTitle: "Live Preview",
    previewChip: "web renderer",
    validationTitle: "Validation",
    validationChip: "decode + validate",
    actionTitle: "Action Stream",
    actionChip: "local runtime",
    noErrors: "No errors",
    schemaHasErrors: "Schema has errors. Fix them to see preview.",
    buttonFallback: "Button",
    actionLogLabel: "log",
    actionOpenUrlLabel: "open_url",
    actionNavigateLabel: "navigate",
    actionUnknownLabel: "unknown",
    systemLabel: "system",
    cannotFormatInvalidJson: "cannot format invalid JSON",
    fileSaved: "file saved:",
    fileLoaded: "file loaded:",
    fileSaveError: "file save error",
    fileLoadError: "file load error",
    saveDefaultName: "nodus-schema.json",
    themeToggleAria: "Toggle theme",
  },
};

const DEFAULT_SCHEMA_FALLBACK = `{
  "type": "column",
  "id": "root",
  "children": [
    {
      "type": "text",
      "value": "Nodus sample fallback"
    }
  ]
}`;

let defaultSchemas = {
  ru: DEFAULT_SCHEMA_FALLBACK,
  en: DEFAULT_SCHEMA_FALLBACK,
};

const editor = document.getElementById("jsonEditor");
const previewRoot = document.getElementById("previewRoot");
const errorsList = document.getElementById("errorsList");
const actionList = document.getElementById("actionList");
const loadBtn = document.getElementById("loadBtn");
const renderBtn = document.getElementById("renderBtn");
const formatBtn = document.getElementById("formatBtn");
const saveBtn = document.getElementById("saveBtn");
const langRuBtn = document.getElementById("langRuBtn");
const langEnBtn = document.getElementById("langEnBtn");
const themeToggleBtn = document.getElementById("themeToggleBtn");
const themeToggleIcon = document.getElementById("themeToggleIcon");
const metaDescription = document.getElementById("metaDescription");
const jsonFileInput = document.getElementById("jsonFileInput");

const inputState = new Map();
const componentRenderContext = {
  renderNode,
  dispatchAction,
  t,
  inputState,
};
let currentLocale = resolveInitialLocale();
let currentTheme = resolveInitialTheme();

loadBtn.addEventListener("click", onLoadClick);
renderBtn.addEventListener("click", () => renderSchema(editor.value));
formatBtn.addEventListener("click", onFormatClick);
saveBtn.addEventListener("click", onSaveClick);
editor.addEventListener("input", debounce(() => renderSchema(editor.value), 300));
langRuBtn.addEventListener("click", () => setLocale("ru"));
langEnBtn.addEventListener("click", () => setLocale("en"));
themeToggleBtn.addEventListener("click", () => setTheme(currentTheme === "light" ? "dark" : "light"));

initializeApp();

function resolveInitialLocale() {
  const saved = localStorage.getItem(LOCALE_KEY);
  if (saved && SUPPORTED_LOCALES.includes(saved)) {
    return saved;
  }
  return "ru";
}

function setLocale(locale, options = {}) {
  const rerender = options.rerender !== false;
  if (!SUPPORTED_LOCALES.includes(locale)) {
    return;
  }

  currentLocale = locale;
  localStorage.setItem(LOCALE_KEY, locale);

  document.documentElement.lang = locale;
  document.title = t("documentTitle");
  if (metaDescription) {
    metaDescription.setAttribute("content", t("metaDescription"));
  }

  document.querySelectorAll("[data-i18n]").forEach((element) => {
    const key = element.getAttribute("data-i18n");
    if (!key) {
      return;
    }
    element.textContent = t(key);
  });

  langRuBtn.classList.toggle("is-active", locale === "ru");
  langEnBtn.classList.toggle("is-active", locale === "en");
  themeToggleBtn.setAttribute("aria-label", t("themeToggleAria"));
  themeToggleBtn.setAttribute("title", t("themeToggleAria"));

  if (rerender) {
    renderSchema(editor.value);
  }
}

function resolveInitialTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved && SUPPORTED_THEMES.includes(saved)) {
    return saved;
  }
  return "dark";
}

function setTheme(theme) {
  if (!SUPPORTED_THEMES.includes(theme)) {
    return;
  }

  currentTheme = theme;
  localStorage.setItem(THEME_KEY, theme);
  document.documentElement.setAttribute("data-theme", theme);
  themeToggleBtn.classList.toggle("is-light", theme === "light");
  themeToggleBtn.classList.toggle("is-dark", theme === "dark");
  themeToggleIcon.src = theme === "light" ? THEME_ICONS.light : THEME_ICONS.dark;
}

function t(key) {
  const localeTable = I18N[currentLocale] || I18N.ru;
  return localeTable[key] ?? I18N.ru[key] ?? key;
}

async function initializeApp() {
  await loadDefaultSchemasFromSample();
  editor.value = defaultSchemas[currentLocale] || defaultSchemas.ru;
  setTheme(currentTheme);
  setLocale(currentLocale, { rerender: false });
  await renderSchema(editor.value);
}

async function loadDefaultSchemasFromSample() {
  try {
    const response = await fetch(SAMPLE_SCHEMA_PATH, { cache: "no-store" });
    if (!response.ok) {
      return;
    }
    const schema = await response.json();
    const formatted = `${JSON.stringify(schema, null, 2)}\n`;
    defaultSchemas = {
      ru: formatted,
      en: formatted,
    };
  } catch {
    // Keep fallback in-memory defaults.
  }
}

async function renderSchema(rawSchema) {
  const response = await fetch("/api/decode-validate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ schema: rawSchema }),
  });

  const payload = await response.json();
  renderErrors(payload.decodeErrors, payload.validationErrors);

  previewRoot.innerHTML = "";
  if (!payload.ok || !payload.node) {
    previewRoot.textContent = t("schemaHasErrors");
    return;
  }

  const rootNode = renderNode(payload.node);
  if (rootNode) {
    previewRoot.appendChild(rootNode);
  }
}

function renderErrors(decodeErrors, validationErrors) {
  errorsList.innerHTML = "";
  const all = [...decodeErrors, ...validationErrors];

  if (all.length === 0) {
    const ok = document.createElement("li");
    ok.className = "ok-item";
    ok.textContent = t("noErrors");
    errorsList.appendChild(ok);
    return;
  }

  all.forEach((error) => {
    const item = document.createElement("li");
    item.className = "error-item";
    item.textContent = `${error.path}: ${error.message}`;
    errorsList.appendChild(item);
  });
}

function renderNode(node) {
  if (!node || typeof node.type !== "string") {
    return null;
  }

  const component = window.NodusComponents.get(node.type);
  if (!component || typeof component.render !== "function") {
    return null;
  }

  return component.render(componentRenderContext, node);
}

function dispatchAction(action, context) {
  if (!action || !action.type) {
    return;
  }

  if (action.type === "log") {
    const template = typeof action.value === "string" ? action.value : "";
    const finalMessage = template.replaceAll("{{value}}", context.value ?? "");
    appendAction(`[${t("actionLogLabel")}] ${finalMessage}`);
    return;
  }

  if (action.type === "open_url") {
    appendAction(`[${t("actionOpenUrlLabel")}] ${action.url || ""}`);
    return;
  }

  if (action.type === "navigate") {
    appendAction(`[${t("actionNavigateLabel")}] ${action.route || ""}`);
    return;
  }

  appendAction(`[${t("actionUnknownLabel")}] ${action.type}`);
}

function appendAction(message) {
  const item = document.createElement("li");
  item.textContent = `${new Date().toLocaleTimeString()} ${message}`;
  actionList.prepend(item);

  const maxItems = 20;
  while (actionList.children.length > maxItems) {
    actionList.removeChild(actionList.lastChild);
  }
}

function onFormatClick() {
  try {
    const parsed = JSON.parse(editor.value);
    editor.value = JSON.stringify(parsed, null, 2);
    renderSchema(editor.value);
  } catch {
    appendAction(`[${t("systemLabel")}] ${t("cannotFormatInvalidJson")}`);
  }
}

async function onSaveClick() {
  let content = editor.value;
  try {
    const parsed = JSON.parse(editor.value);
    content = `${JSON.stringify(parsed, null, 2)}\n`;
  } catch {
    content = `${editor.value}\n`;
  }

  try {
    if (window.showSaveFilePicker) {
      const handle = await window.showSaveFilePicker({
        suggestedName: t("saveDefaultName"),
        types: [
          {
            description: "JSON files",
            accept: { "application/json": [".json"] },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(content);
      await writable.close();
      appendAction(`[${t("systemLabel")}] ${t("fileSaved")} ${handle.name}`);
      return;
    }
  } catch (error) {
    if (error && error.name === "AbortError") {
      return;
    }
    appendAction(`[${t("systemLabel")}] ${t("fileSaveError")}`);
    return;
  }

  const fallbackName = normalizeFileName(t("saveDefaultName"));
  const blob = new Blob([content], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = fallbackName;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  appendAction(`[${t("systemLabel")}] ${t("fileSaved")} ${fallbackName}`);
}

function normalizeFileName(name) {
  const clean = name.replace(/[<>:\"/\\\\|?*]/g, "_");
  if (clean.toLowerCase().endsWith(".json")) {
    return clean;
  }
  return `${clean}.json`;
}

async function onLoadClick() {
  try {
    if (window.showOpenFilePicker) {
      const [handle] = await window.showOpenFilePicker({
        multiple: false,
        types: [
          {
            description: "JSON files",
            accept: { "application/json": [".json"] },
          },
        ],
      });
      const file = await handle.getFile();
      const text = await file.text();
      editor.value = text;
      await renderSchema(editor.value);
      appendAction(`[${t("systemLabel")}] ${t("fileLoaded")} ${file.name}`);
      return;
    }
  } catch (error) {
    if (error && error.name === "AbortError") {
      return;
    }
    appendAction(`[${t("systemLabel")}] ${t("fileLoadError")}`);
    return;
  }

  jsonFileInput.value = "";
  jsonFileInput.onchange = async (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) {
      return;
    }
    try {
      const text = await file.text();
      editor.value = text;
      await renderSchema(editor.value);
      appendAction(`[${t("systemLabel")}] ${t("fileLoaded")} ${file.name}`);
    } catch {
      appendAction(`[${t("systemLabel")}] ${t("fileLoadError")}`);
    }
  };
  jsonFileInput.click();
}

function debounce(fn, delayMs) {
  let timeoutId = null;

  return (...args) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => fn(...args), delayMs);
  };
}
