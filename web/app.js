import { EditorState } from "https://esm.sh/@codemirror/state";
import { EditorView } from "https://esm.sh/@codemirror/view";
import { json } from "https://esm.sh/@codemirror/lang-json";
import { basicSetup } from "https://esm.sh/codemirror";

const LOCALE_KEY = "nodus.locale";
const THEME_KEY = "nodus.theme";
const LAST_SCHEMA_KEY = "nodus.lastSchema";
const COMPONENT_LIBRARY_KEY = "nodus.componentLibrary";
const SUPPORTED_LOCALES = ["ru", "en"];
const SUPPORTED_THEMES = ["light", "dark"];
const THEME_ICONS = {
  light: "/assets/sun.png",
  dark: "/assets/moon.png",
};
const FORM_SCHEMA_TEMPLATE = {
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
const NAVBAR_TEMPLATE = {
  type: "row",
  id: "navbar_main",
  justify: "space-between",
  wrap: "nowrap",
  layout: {
    padding: {
      top: 12,
      right: 16,
      bottom: 12,
      left: 16,
    },
  },
  children: [
    {
      type: "iconbutton",
      id: "navbar_back",
      icon: "arrow-left",
      title: "Назад",
      action: {
        type: "navigate",
        route: "back",
      },
    },
    {
      type: "text",
      id: "navbar_title",
      value: "Сбор денег",
      layout: {
        weight: 1,
        alignment: "center",
      },
    },
    {
      type: "iconbutton",
      id: "navbar_action",
      icon: "settings",
      title: "Действие",
      action: {
        type: "log",
        value: "navbar action button",
      },
    },
    {
      type: "iconbutton",
      id: "navbar_menu",
      icon: "menu",
      title: "Меню",
      action: {
        type: "log",
        value: "navbar menu tapped",
      },
    },
  ],
};

const I18N = {
  ru: {
    documentTitle: "Nodus Studio - BDUI Playground",
    metaDescription:
      "Nodus Studio: редактирование JSON-схем, валидация runtime-правил и live preview интерфейса.",
    heroTitle: "Песочница Backend-Driven UI",
    heroSubtitle:
      "Собирай контракт экрана в JSON, проверяй runtime-правила и сразу<br>смотри визуальный результат.",
    loadBtn: "Загрузить",
    formatBtn: "Форматировать JSON",
    renderBtn: "Обновить превью",
    saveBtn: "Сохранить",
    clearBtn: "Очистить",
    editorFileNone: "Файл не привязан. Изменения не сохранены в файл.",
    editorFileLinked: "Файл:",
    editorPathHidden: "путь скрыт браузером",
    autosaveToSameFile: "автосохранение в этот файл доступно",
    componentsTitle: "Каталог компонентов",
    componentsChip: "быстрая сборка",
    componentAddBtn: "Добавить",
    componentNewBtn: "Новый",
    componentEditBtn: "Редактировать",
    componentDeleteBtn: "Удалить",
    componentEditorTitle: "Редактор компонента",
    componentEditorTitleCreate: "Новый компонент",
    componentEditorTitleEdit: "Редактор компонента",
    componentFieldType: "Type",
    componentFieldMode: "Режим",
    componentModeInsert: "Вставка",
    componentModeReplace: "Заменить схему",
    componentFieldTitleRu: "Название (RU)",
    componentFieldTitleEn: "Название (EN)",
    componentFieldDescRu: "Описание (RU)",
    componentFieldDescEn: "Описание (EN)",
    componentFieldFieldsRu: "Поля (RU)",
    componentFieldFieldsEn: "Поля (EN)",
    componentFieldTemplate: "Template JSON",
    componentSaveErrorType: "невозможно сохранить компоненту: поле type пустое",
    componentSaveErrorJson: "невозможно сохранить компоненту: template JSON невалиден",
    componentSaved: "компонента сохранена:",
    componentCreated: "компонента создана:",
    componentDeleted: "компонента удалена:",
    componentDeleteConfirm: "Удалить компоненту {type}?",
    componentReplaceSchemaConfirm:
      "Текущая схема будет удалена и заменена на компонент {type}. Продолжить?",
    cancelBtn: "Отмена",
    componentDetailsSummary: "JSON шаблон и поля",
    componentInsertError: "нельзя добавить компонент: JSON в редакторе невалиден",
    componentInsertSuccess: "компонент добавлен:",
    editorResetToForm: "редактор очищен до шаблона формы",
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
    contextTitle: "Контекст контракта",
    contextChip: "project / contract / version",
    projectLabel: "Проект",
    contractLabel: "Контракт",
    versionLabel: "Версия",
    screenLabel: "Схема экрана",
    newBtn: "Создать",
    renameBtn: "Переименовать",
    toggleStatusBtn: "Актив/Неактив",
    deleteBtn: "Удалить",
    saveScreenBtn: "Сохранить экран",
    publishBtn: "Публиковать",
    contextNotSelected: "Контекст не выбран",
    contextCurrent: "Текущий контекст:",
    contextSaved: "экран сохранен",
    contextPublished: "версия опубликована",
    contextLoadError: "ошибка загрузки контекста",
    contextSaveError: "ошибка сохранения экрана",
    contextPublishError: "ошибка публикации версии",
    promptProjectId: "Введите project_id (латиница, цифры, -_):",
    promptProjectName: "Введите название проекта:",
    promptContractId: "Введите contract_id (латиница, цифры, -_):",
    promptContractName: "Введите название контракта:",
    promptVersionId: "Введите version_id (пример: v0-2):",
    promptScreenId: "Введите screen_id (латиница, цифры, -_):",
    promptScreenName: "Введите название схемы экрана:",
    promptRenameScreen: "Введите новое название схемы:",
  },
  en: {
    documentTitle: "Nodus Studio - BDUI Playground",
    metaDescription:
      "Nodus Studio playground for JSON schema editing, runtime validation, and live interface preview.",
    heroTitle: "Backend-Driven UI Playground",
    heroSubtitle:
      "Compose screen contracts in JSON, validate runtime rules, and<br>inspect a live page preview in real time.",
    loadBtn: "Load",
    formatBtn: "Format JSON",
    renderBtn: "Render now",
    saveBtn: "Save",
    clearBtn: "Clear",
    editorFileNone: "No file linked. Changes are not saved to a file.",
    editorFileLinked: "File:",
    editorPathHidden: "path hidden by browser",
    autosaveToSameFile: "autosave to this file is available",
    componentsTitle: "Component Library",
    componentsChip: "faster assembly",
    componentAddBtn: "Add",
    componentNewBtn: "New",
    componentEditBtn: "Edit",
    componentDeleteBtn: "Delete",
    componentEditorTitle: "Component editor",
    componentEditorTitleCreate: "New component",
    componentEditorTitleEdit: "Component editor",
    componentFieldType: "Type",
    componentFieldMode: "Mode",
    componentModeInsert: "Insert",
    componentModeReplace: "Replace schema",
    componentFieldTitleRu: "Title (RU)",
    componentFieldTitleEn: "Title (EN)",
    componentFieldDescRu: "Description (RU)",
    componentFieldDescEn: "Description (EN)",
    componentFieldFieldsRu: "Fields (RU)",
    componentFieldFieldsEn: "Fields (EN)",
    componentFieldTemplate: "Template JSON",
    componentSaveErrorType: "cannot save component: type is empty",
    componentSaveErrorJson: "cannot save component: template JSON is invalid",
    componentSaved: "component saved:",
    componentCreated: "component created:",
    componentDeleted: "component deleted:",
    componentDeleteConfirm: "Delete component {type}?",
    componentReplaceSchemaConfirm:
      "The current schema will be removed and replaced with component {type}. Continue?",
    cancelBtn: "Cancel",
    componentDetailsSummary: "JSON template and fields",
    componentInsertError: "cannot add component: editor JSON is invalid",
    componentInsertSuccess: "component added:",
    editorResetToForm: "editor reset to form template",
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
    contextTitle: "Contract Context",
    contextChip: "project / contract / version",
    projectLabel: "Project",
    contractLabel: "Contract",
    versionLabel: "Version",
    screenLabel: "Screen Schema",
    newBtn: "Create",
    renameBtn: "Rename",
    toggleStatusBtn: "Active/Inactive",
    deleteBtn: "Delete",
    saveScreenBtn: "Save Screen",
    publishBtn: "Publish",
    contextNotSelected: "Context is not selected",
    contextCurrent: "Current context:",
    contextSaved: "screen saved",
    contextPublished: "version published",
    contextLoadError: "context load error",
    contextSaveError: "screen save error",
    contextPublishError: "version publish error",
    promptProjectId: "Enter project_id (latin, digits, -_):",
    promptProjectName: "Enter project name:",
    promptContractId: "Enter contract_id (latin, digits, -_):",
    promptContractName: "Enter contract name:",
    promptVersionId: "Enter version_id (example: v0-2):",
    promptScreenId: "Enter screen_id (latin, digits, -_):",
    promptScreenName: "Enter screen schema name:",
    promptRenameScreen: "Enter new screen name:",
  },
};

const DEFAULT_SCHEMA_FALLBACK = formatSchema(FORM_SCHEMA_TEMPLATE);

const editorContainer = document.getElementById("jsonEditor");
let editorView = null;
const editor = {
  get value() {
    return editorView ? editorView.state.doc.toString() : "";
  },
  set value(nextValue) {
    if (!editorView) {
      return;
    }
    const current = editorView.state.doc.toString();
    if (nextValue === current) {
      return;
    }
    editorView.dispatch({
      changes: { from: 0, to: editorView.state.doc.length, insert: nextValue },
    });
  },
  get selectionStart() {
    return editorView ? editorView.state.selection.main.head : 0;
  },
};
const workspace = document.getElementById("workspace");
const componentsCard = document.getElementById("componentsCard");
const editorCard = document.getElementById("editorCard");
const previewCard = document.getElementById("previewCard");
const componentPaletteList = document.getElementById("componentPaletteList");
const newComponentBtn = document.getElementById("newComponentBtn");
const componentEditorModal = document.getElementById("componentEditorModal");
const componentEditorTitle = document.getElementById("componentEditorTitle");
const componentEditorCloseBtn = document.getElementById("componentEditorCloseBtn");
const componentEditorForm = document.getElementById("componentEditorForm");
const componentEditorCancelBtn = document.getElementById("componentEditorCancelBtn");
const componentFieldType = document.getElementById("componentFieldType");
const componentFieldMode = document.getElementById("componentFieldMode");
const componentFieldTitleRu = document.getElementById("componentFieldTitleRu");
const componentFieldTitleEn = document.getElementById("componentFieldTitleEn");
const componentFieldDescRu = document.getElementById("componentFieldDescRu");
const componentFieldDescEn = document.getElementById("componentFieldDescEn");
const componentFieldFieldsRu = document.getElementById("componentFieldFieldsRu");
const componentFieldFieldsEn = document.getElementById("componentFieldFieldsEn");
const componentTemplateEditorContainer = document.getElementById("componentTemplateEditor");
const previewRoot = document.getElementById("previewRoot");
const errorsList = document.getElementById("errorsList");
const actionList = document.getElementById("actionList");
const loadBtn = document.getElementById("contextLoadBtn");
const renderBtn = document.getElementById("renderBtn");
const formatBtn = document.getElementById("formatBtn");
const clearEditorBtn = document.getElementById("clearEditorBtn");
const editorFileInfo = document.getElementById("editorFileInfo");
const langRuBtn = document.getElementById("langRuBtn");
const langEnBtn = document.getElementById("langEnBtn");
const themeToggleBtn = document.getElementById("themeToggleBtn");
const themeToggleIcon = document.getElementById("themeToggleIcon");
const metaDescription = document.getElementById("metaDescription");
const jsonFileInput = document.getElementById("jsonFileInput");
const workspaceSplitters = Array.from(document.querySelectorAll(".workspace-splitter"));
const projectSelect = document.getElementById("projectSelect");
const contractSelect = document.getElementById("contractSelect");
const versionSelect = document.getElementById("versionSelect");
const screenSelect = document.getElementById("screenSelect");
const newProjectBtn = document.getElementById("newProjectBtn");
const newContractBtn = document.getElementById("newContractBtn");
const newVersionBtn = document.getElementById("newVersionBtn");
const newScreenBtn = document.getElementById("newScreenBtn");
const renameScreenBtn = document.getElementById("renameScreenBtn");
const toggleScreenStatusBtn = document.getElementById("toggleScreenStatusBtn");
const deleteScreenBtn = document.getElementById("deleteScreenBtn");
const saveScreenBtn = document.getElementById("saveScreenBtn");
const publishVersionBtn = document.getElementById("publishVersionBtn");
const contextInfo = document.getElementById("contextInfo");
const PANEL_LIMITS = {
  componentsCard: { min: 260, max: 720 },
  editorCard: { min: 420, max: 1100 },
  previewCard: { min: 320, max: 1200 },
};

const inputState = new Map();
const componentRenderContext = {
  renderNode,
  dispatchAction,
  t,
  inputState,
};
let currentLocale = resolveInitialLocale();
let currentTheme = resolveInitialTheme();
let currentFileHandle = null;
let currentFileName = "";
let hasUnsavedChanges = true;
const registryState = {
  projectId: "",
  contractId: "",
  versionId: "",
  screenId: "",
};
const DEFAULT_COMPONENT_LIBRARY = [
  {
    type: "form",
    title: { ru: "Форма", en: "Form" },
    description: {
      ru: "Минимальный корневой шаблон формы для старта.",
      en: "Minimal root form template to start from.",
    },
    template: FORM_SCHEMA_TEMPLATE,
    mode: "replace-schema",
    fields: {
      ru: "type: column; id: form; layout.padding: базовые отступы; children: сюда добавляются компоненты.",
      en: "type: column; id: form; layout.padding: base spacing; children: add components here.",
    },
  },
  {
    type: "navbar",
    title: { ru: "NavBar", en: "NavBar" },
    description: {
      ru: "Верхняя панель: кнопка назад, заголовок и кнопка справа.",
      en: "Top bar: back button, centered title, and right-side action.",
    },
    template: NAVBAR_TEMPLATE,
    fields: {
      ru: "children[0].icon: arrow-left; children[1].value: заголовок; children[2].icon: правая иконка.",
      en: "children[0].icon: arrow-left; children[1].value: title; children[2].icon: right icon.",
    },
  },
  {
    type: "column",
    title: { ru: "Column", en: "Column" },
    description: {
      ru: "Вертикальный контейнер для дочерних компонентов.",
      en: "Vertical container for child components.",
    },
    template: {
      type: "column",
      id: "column_new",
      children: [],
    },
    fields: {
      ru: "type: тип компонента; id: идентификатор; children: массив дочерних узлов; layout: отступы/размер.",
      en: "type: component type; id: node identifier; children: child node array; layout: spacing/size.",
    },
  },
  {
    type: "row",
    title: { ru: "Row", en: "Row" },
    description: {
      ru: "Горизонтальный контейнер для размещения элементов в строке.",
      en: "Horizontal container to place elements in one row.",
    },
    template: {
      type: "row",
      id: "row_new",
      justify: "left",
      children: [],
    },
    fields: {
      ru: "justify: left/right/center/space-between; children: элементы строки; gap: отступ между элементами; wrap: wrap/nowrap.",
      en: "justify: left/right/center/space-between; children: row items; gap: spacing between items; wrap: wrap/nowrap.",
    },
  },
  {
    type: "box",
    title: { ru: "Box", en: "Box" },
    description: {
      ru: "Группирующий блок для визуального объединения дочерних узлов.",
      en: "Grouping block to visually combine child nodes.",
    },
    template: {
      type: "box",
      id: "box_new",
      layout: {
        padding: { top: 8, right: 8, bottom: 8, left: 8 },
      },
      children: [],
    },
    fields: {
      ru: "children: вложенные компоненты; layout.padding: внутренние отступы.",
      en: "children: nested components; layout.padding: inner spacing.",
    },
  },
  {
    type: "text",
    title: { ru: "Text", en: "Text" },
    description: {
      ru: "Текстовый узел для заголовков и описаний.",
      en: "Text node for titles and descriptions.",
    },
    template: {
      type: "text",
      id: "text_new",
      value: "Новый текст",
    },
    fields: {
      ru: "value: отображаемая строка; layout: позиционирование и размеры.",
      en: "value: visible string; layout: positioning and sizing.",
    },
  },
  {
    type: "button",
    title: { ru: "Button", en: "Button" },
    description: {
      ru: "Кнопка с runtime-действием.",
      en: "Button with runtime action.",
    },
    template: {
      type: "button",
      id: "button_new",
      title: "Нажать",
      action: {
        type: "log",
        value: "button clicked",
      },
    },
    fields: {
      ru: "title: подпись; action.type: тип действия; action.value/url/route: параметры действия.",
      en: "title: label; action.type: action type; action.value/url/route: action parameters.",
    },
  },
  {
    type: "iconbutton",
    title: { ru: "IconButton", en: "IconButton" },
    description: {
      ru: "Кнопка-иконка со стандартным именем иконки.",
      en: "Icon-only button with a standard icon name.",
    },
    template: {
      type: "iconbutton",
      id: "iconbutton_new",
      icon: "plus",
      title: "Добавить",
      action: {
        type: "log",
        value: "icon button clicked",
      },
    },
    fields: {
      ru: "icon: plus/minus/edit/trash/search/settings/check/close/arrow-left/arrow-right/menu; title: tooltip и aria-label; action.type: тип действия.",
      en: "icon: plus/minus/edit/trash/search/settings/check/close/arrow-left/arrow-right/menu; title: tooltip and aria-label; action.type: action type.",
    },
  },
  {
    type: "input",
    title: { ru: "Input", en: "Input" },
    description: {
      ru: "Поле ввода текста с onChange действием.",
      en: "Text input field with onChange action.",
    },
    template: {
      type: "input",
      id: "input_new",
      placeholder: "Введите значение",
      onChange: {
        type: "log",
        value: "input changed: {{value}}",
      },
    },
    fields: {
      ru: "placeholder: подсказка; onChange: действие при вводе; value: начальное значение.",
      en: "placeholder: hint text; onChange: action on input; value: initial value.",
    },
  },
  {
    type: "spacer",
    title: { ru: "Spacer", en: "Spacer" },
    description: {
      ru: "Пустой разделитель для управления расстояниями.",
      en: "Empty spacer used to control distances.",
    },
    template: {
      type: "spacer",
      id: "spacer_new",
      layout: {
        height: "12px",
      },
    },
    fields: {
      ru: "layout.height: высота отступа; layout.width: ширина (опционально).",
      en: "layout.height: spacer height; layout.width: width (optional).",
    },
  },
];
let componentLibrary = loadComponentLibrary();
let componentEditIndex = null;
let componentTemplateEditorView = null;
const componentTemplateEditor = {
  get value() {
    return componentTemplateEditorView ? componentTemplateEditorView.state.doc.toString() : "";
  },
  set value(nextValue) {
    if (!componentTemplateEditorView) {
      return;
    }
    const current = componentTemplateEditorView.state.doc.toString();
    if (nextValue === current) {
      return;
    }
    componentTemplateEditorView.dispatch({
      changes: { from: 0, to: componentTemplateEditorView.state.doc.length, insert: nextValue },
    });
  },
};

loadBtn.addEventListener("click", onLoadClick);
renderBtn.addEventListener("click", () => renderSchema(editor.value));
formatBtn.addEventListener("click", onFormatClick);
clearEditorBtn.addEventListener("click", onClearEditorClick);
langRuBtn.addEventListener("click", () => setLocale("ru"));
langEnBtn.addEventListener("click", () => setLocale("en"));
themeToggleBtn.addEventListener("click", () => setTheme(currentTheme === "light" ? "dark" : "light"));
projectSelect.addEventListener("change", onProjectChanged);
contractSelect.addEventListener("change", onContractChanged);
versionSelect.addEventListener("change", onVersionChanged);
screenSelect.addEventListener("change", onScreenChanged);
newProjectBtn.addEventListener("click", onCreateProject);
newContractBtn.addEventListener("click", onCreateContract);
newVersionBtn.addEventListener("click", onCreateVersion);
newScreenBtn.addEventListener("click", onCreateScreen);
renameScreenBtn.addEventListener("click", onRenameScreen);
toggleScreenStatusBtn.addEventListener("click", onToggleScreenStatus);
deleteScreenBtn.addEventListener("click", onDeleteScreen);
saveScreenBtn.addEventListener("click", onSaveScreen);
publishVersionBtn.addEventListener("click", onPublishVersion);
newComponentBtn.addEventListener("click", () => openComponentEditor(null));
if (componentEditorCloseBtn) {
  componentEditorCloseBtn.addEventListener("click", closeComponentEditor);
}
componentEditorCancelBtn.addEventListener("click", closeComponentEditor);
componentEditorForm.addEventListener("submit", onSaveComponentEditor);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !componentEditorModal.classList.contains("is-hidden")) {
    closeComponentEditor();
  }
});

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
    if (element.getAttribute("data-i18n-html") === "true") {
      element.innerHTML = t(key);
      return;
    }
    element.textContent = t(key);
  });

  langRuBtn.classList.toggle("is-active", locale === "ru");
  langEnBtn.classList.toggle("is-active", locale === "en");
  themeToggleBtn.setAttribute("aria-label", t("themeToggleAria"));
  themeToggleBtn.setAttribute("title", t("themeToggleAria"));
  renderComponentPalette();
  if (!componentEditorModal.classList.contains("is-hidden")) {
    componentEditorTitle.textContent = t(componentEditIndex === null ? "componentEditorTitleCreate" : "componentEditorTitleEdit");
  }
  updateEditorFileInfo();
  updateSaveButtonState();
  updateContextInfo();

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
  const initialSchema = await loadInitialSchema();
  initializeEditor(initialSchema);
  initializeComponentTemplateEditor();
  await ensureInitialRegistry();
  await hydrateRegistrySelectors();
  renderComponentPalette();
  initializeWorkspaceSplitters();
  setTheme(currentTheme);
  setLocale(currentLocale, { rerender: false });
  setUnsavedChanges(true);
  await renderSchema(editor.value);
}

function initializeEditor(initialValue) {
  if (!editorContainer) {
    return;
  }

  const renderDebounced = debounce(() => renderSchema(editor.value), 300);
  const persistDebounced = debounce(() => {
    persistEditorSchema(editor.value);
    setUnsavedChanges(true);
  }, 250);

  editorView = new EditorView({
    state: EditorState.create({
      doc: initialValue,
      extensions: [
        basicSetup,
        json(),
        EditorView.lineWrapping,
        createJsonEditorTheme(),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            renderDebounced();
            persistDebounced();
          }
        }),
      ],
    }),
    parent: editorContainer,
  });
}

function initializeComponentTemplateEditor() {
  if (!componentTemplateEditorContainer) {
    return;
  }

  componentTemplateEditorView = new EditorView({
    state: EditorState.create({
      doc: "{}\n",
      extensions: [basicSetup, json(), EditorView.lineWrapping, createJsonEditorTheme()],
    }),
    parent: componentTemplateEditorContainer,
  });
}

function createJsonEditorTheme() {
  return EditorView.theme({
    "&": {
      height: "100%",
      backgroundColor: "transparent",
      color: "var(--editor-text)",
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: "16px",
    },
    ".cm-content": {
      padding: "16px",
    },
    ".cm-gutters": {
      backgroundColor: "transparent",
      borderRight: "1px solid var(--editor-border)",
      color: "var(--text-soft)",
    },
    ".cm-activeLineGutter": {
      backgroundColor: "rgba(65, 199, 255, 0.08)",
    },
    ".cm-activeLine": {
      backgroundColor: "rgba(65, 199, 255, 0.06)",
    },
  });
}

async function loadInitialSchema() {
  try {
    const saved = localStorage.getItem(LAST_SCHEMA_KEY);
    if (typeof saved === "string" && saved.trim()) {
      JSON.parse(saved);
      return saved.endsWith("\n") ? saved : `${saved}\n`;
    }
  } catch {
    // Ignore bad local value and fallback to default.
  }
  return DEFAULT_SCHEMA_FALLBACK;
}

function persistEditorSchema(value) {
  if (typeof value !== "string" || !value.trim()) {
    return;
  }
  localStorage.setItem(LAST_SCHEMA_KEY, value);
}

function setUnsavedChanges(isDirty) {
  hasUnsavedChanges = Boolean(isDirty);
  updateSaveButtonState();
}

function updateSaveButtonState() {
  if (saveScreenBtn) {
    saveScreenBtn.classList.toggle("btn-save-dirty", hasUnsavedChanges);
  }
}

function updateEditorFileInfo() {
  if (!editorFileInfo) {
    return;
  }

  if (!currentFileName) {
    editorFileInfo.textContent = t("editorFileNone");
    return;
  }

  const autosaveHint = currentFileHandle ? t("autosaveToSameFile") : t("editorPathHidden");
  editorFileInfo.textContent = `${t("editorFileLinked")} ${currentFileName} (${autosaveHint})`;
}

async function apiRequest(path, options = {}) {
  const response = await fetch(path, options);
  const payload = await response.json();
  if (!response.ok) {
    const message = payload && payload.error ? payload.error : `HTTP ${response.status}`;
    throw new Error(message);
  }
  return payload;
}

function contextQuery() {
  const params = new URLSearchParams();
  params.set("project_id", registryState.projectId);
  params.set("contract_id", registryState.contractId);
  params.set("version_id", registryState.versionId);
  return params.toString();
}

async function ensureInitialRegistry() {
  let projects = (await apiRequest("/api/projects")).items || [];
  if (projects.length === 0) {
    await apiRequest("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project_id: "demo", name: "Demo Project" }),
    });
    projects = (await apiRequest("/api/projects")).items || [];
  }
  registryState.projectId = projects[0].project_id;

  let contracts = (await apiRequest(`/api/contracts?project_id=${encodeURIComponent(registryState.projectId)}`)).items || [];
  if (contracts.length === 0) {
    await apiRequest("/api/contracts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project_id: registryState.projectId,
        contract_id: "main-contract",
        name: "Main Contract",
      }),
    });
    contracts = (await apiRequest(`/api/contracts?project_id=${encodeURIComponent(registryState.projectId)}`)).items || [];
  }
  registryState.contractId = contracts[0].contract_id;

  let versions =
    (await apiRequest(
      `/api/versions?project_id=${encodeURIComponent(registryState.projectId)}&contract_id=${encodeURIComponent(registryState.contractId)}`,
    )).items || [];
  if (versions.length === 0) {
    await apiRequest("/api/versions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project_id: registryState.projectId,
        contract_id: registryState.contractId,
        version_id: "v0-1",
      }),
    });
    versions =
      (await apiRequest(
        `/api/versions?project_id=${encodeURIComponent(registryState.projectId)}&contract_id=${encodeURIComponent(registryState.contractId)}`,
      )).items || [];
  }
  registryState.versionId = versions[0].version_id;

  let screens = (await apiRequest(`/api/screens?${contextQuery()}`)).items || [];
  if (screens.length === 0) {
    await apiRequest("/api/screens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project_id: registryState.projectId,
        contract_id: registryState.contractId,
        version_id: registryState.versionId,
        screen_id: "home",
        name: "Home",
        content_json: JSON.parse(DEFAULT_SCHEMA_FALLBACK),
      }),
    });
    screens = (await apiRequest(`/api/screens?${contextQuery()}`)).items || [];
  }
  registryState.screenId = screens[0].screen_id;
}

async function hydrateRegistrySelectors() {
  try {
    const projects = (await apiRequest("/api/projects")).items || [];
    fillSelect(projectSelect, projects, "project_id", "name", registryState.projectId);
    if (!registryState.projectId && projects[0]) {
      registryState.projectId = projects[0].project_id;
    }
    await hydrateContracts();
    updateContextInfo();
  } catch {
    appendAction(`[${t("systemLabel")}] ${t("contextLoadError")}`);
  }
}

async function hydrateContracts() {
  if (!registryState.projectId) {
    fillSelect(contractSelect, [], "contract_id", "name", "");
    return;
  }
  const contracts = (await apiRequest(`/api/contracts?project_id=${encodeURIComponent(registryState.projectId)}`)).items || [];
  if (!contracts.find((item) => item.contract_id === registryState.contractId)) {
    registryState.contractId = contracts[0] ? contracts[0].contract_id : "";
  }
  fillSelect(contractSelect, contracts, "contract_id", "name", registryState.contractId);
  await hydrateVersions();
}

async function hydrateVersions() {
  if (!registryState.projectId || !registryState.contractId) {
    fillSelect(versionSelect, [], "version_id", "version_id", "");
    return;
  }
  const versions =
    (await apiRequest(
      `/api/versions?project_id=${encodeURIComponent(registryState.projectId)}&contract_id=${encodeURIComponent(registryState.contractId)}`,
    )).items || [];
  if (!versions.find((item) => item.version_id === registryState.versionId)) {
    registryState.versionId = versions[0] ? versions[0].version_id : "";
  }
  fillSelect(versionSelect, versions, "version_id", "version_id", registryState.versionId);
  await hydrateScreens();
}

async function hydrateScreens() {
  if (!registryState.projectId || !registryState.contractId || !registryState.versionId) {
    fillSelect(screenSelect, [], "screen_id", "name", "");
    return;
  }

  const screens = (await apiRequest(`/api/screens?${contextQuery()}`)).items || [];
  const activeScreens = screens.filter((item) => item.status !== "deleted");
  if (!activeScreens.find((item) => item.screen_id === registryState.screenId)) {
    registryState.screenId = activeScreens[0] ? activeScreens[0].screen_id : "";
  }
  fillSelect(screenSelect, activeScreens, "screen_id", "name", registryState.screenId);

  const selected = activeScreens.find((item) => item.screen_id === registryState.screenId);
  if (selected && typeof selected.content_raw === "string") {
    editor.value = selected.content_raw.endsWith("\n") ? selected.content_raw : `${selected.content_raw}\n`;
    persistEditorSchema(editor.value);
    setUnsavedChanges(false);
    await renderSchema(editor.value);
  } else if (selected && selected.content_json) {
    editor.value = formatSchema(selected.content_json);
    persistEditorSchema(editor.value);
    setUnsavedChanges(false);
    await renderSchema(editor.value);
  }
  updateContextInfo();
}

function fillSelect(element, items, valueKey, labelKey, selectedValue) {
  if (!element) {
    return;
  }
  element.innerHTML = "";
  items.forEach((item) => {
    const option = document.createElement("option");
    option.value = item[valueKey] || "";
    option.textContent = item[labelKey] || item[valueKey] || "";
    if (option.value === selectedValue) {
      option.selected = true;
    }
    element.appendChild(option);
  });
}

function updateContextInfo() {
  if (!contextInfo) {
    return;
  }
  if (!registryState.projectId || !registryState.contractId || !registryState.versionId || !registryState.screenId) {
    contextInfo.textContent = t("contextNotSelected");
    return;
  }
  contextInfo.textContent = `${t("contextCurrent")} ${registryState.projectId} / ${registryState.contractId} / ${registryState.versionId} / ${registryState.screenId}`;
}

async function onProjectChanged() {
  registryState.projectId = projectSelect.value;
  registryState.contractId = "";
  registryState.versionId = "";
  registryState.screenId = "";
  await hydrateContracts();
  updateContextInfo();
}

async function onContractChanged() {
  registryState.contractId = contractSelect.value;
  registryState.versionId = "";
  registryState.screenId = "";
  await hydrateVersions();
  updateContextInfo();
}

async function onVersionChanged() {
  registryState.versionId = versionSelect.value;
  registryState.screenId = "";
  await hydrateScreens();
  updateContextInfo();
}

async function onScreenChanged() {
  registryState.screenId = screenSelect.value;
  await hydrateScreens();
  updateContextInfo();
}

async function onCreateProject() {
  const projectId = (window.prompt(t("promptProjectId"), "demo-project") || "").trim();
  if (!projectId) return;
  const name = (window.prompt(t("promptProjectName"), projectId) || "").trim() || projectId;
  await apiRequest("/api/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ project_id: projectId, name }),
  });
  registryState.projectId = projectId;
  await hydrateRegistrySelectors();
}

async function onCreateContract() {
  if (!registryState.projectId) return;
  const contractId = (window.prompt(t("promptContractId"), "main-contract") || "").trim();
  if (!contractId) return;
  const name = (window.prompt(t("promptContractName"), contractId) || "").trim() || contractId;
  await apiRequest("/api/contracts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ project_id: registryState.projectId, contract_id: contractId, name }),
  });
  registryState.contractId = contractId;
  await hydrateContracts();
}

async function onCreateVersion() {
  if (!registryState.projectId || !registryState.contractId) return;
  const versionId = (window.prompt(t("promptVersionId"), "v0-2") || "").trim();
  if (!versionId) return;
  await apiRequest("/api/versions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      project_id: registryState.projectId,
      contract_id: registryState.contractId,
      version_id: versionId,
      based_on_version_id: registryState.versionId || null,
    }),
  });
  registryState.versionId = versionId;
  await hydrateVersions();
}

async function onCreateScreen() {
  if (!registryState.projectId || !registryState.contractId || !registryState.versionId) return;
  const screenId = (window.prompt(t("promptScreenId"), "screen-new") || "").trim();
  if (!screenId) return;
  const name = (window.prompt(t("promptScreenName"), screenId) || "").trim() || screenId;
  let parsedContent;
  try {
    parsedContent = JSON.parse(editor.value);
  } catch {
    appendAction(`[${t("systemLabel")}] ${t("componentInsertError")}`);
    return;
  }
  await apiRequest("/api/screens", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      project_id: registryState.projectId,
      contract_id: registryState.contractId,
      version_id: registryState.versionId,
      screen_id: screenId,
      name,
      content_json: parsedContent,
    }),
  });
  registryState.screenId = screenId;
  await hydrateScreens();
}

async function onRenameScreen() {
  if (!registryState.screenId) return;
  const newName = (window.prompt(t("promptRenameScreen"), registryState.screenId) || "").trim();
  if (!newName) return;
  await apiRequest(`/api/screens/${encodeURIComponent(registryState.screenId)}?${contextQuery()}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: newName }),
  });
  await hydrateScreens();
}

async function onToggleScreenStatus() {
  if (!registryState.screenId) return;
  const screens = (await apiRequest(`/api/screens?${contextQuery()}&include_deleted=1`)).items || [];
  const selected = screens.find((item) => item.screen_id === registryState.screenId);
  if (!selected) return;
  const nextStatus = selected.status === "inactive" ? "active" : "inactive";
  await apiRequest(`/api/screens/${encodeURIComponent(registryState.screenId)}/status?${contextQuery()}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: nextStatus }),
  });
  await hydrateScreens();
}

async function onDeleteScreen() {
  if (!registryState.screenId) return;
  await apiRequest(`/api/screens/${encodeURIComponent(registryState.screenId)}/status?${contextQuery()}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "deleted" }),
  });
  registryState.screenId = "";
  await hydrateScreens();
}

async function onSaveScreen() {
  if (!registryState.screenId) return;
  try {
    await apiRequest(`/api/screens/${encodeURIComponent(registryState.screenId)}?${contextQuery()}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content_raw: editor.value }),
    });
    setUnsavedChanges(false);
    appendAction(`[${t("systemLabel")}] ${t("contextSaved")} ${registryState.screenId}`);
    await hydrateScreens();
  } catch {
    appendAction(`[${t("systemLabel")}] ${t("contextSaveError")}`);
  }
}

async function onPublishVersion() {
  if (!registryState.projectId || !registryState.contractId || !registryState.versionId) return;
  try {
    const result = await apiRequest("/api/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project_id: registryState.projectId,
        contract_id: registryState.contractId,
        version_id: registryState.versionId,
      }),
    });
    appendAction(`[${t("systemLabel")}] ${t("contextPublished")} ${result.pub_id || ""}`);
  } catch (error) {
    appendAction(`[${t("systemLabel")}] ${t("contextPublishError")} ${error.message || ""}`);
  }
}

function renderComponentPalette() {
  if (!componentPaletteList) {
    return;
  }

  componentPaletteList.innerHTML = "";

  componentLibrary.forEach((item, index) => {
    const card = document.createElement("article");
    card.className = "component-item";

    const top = document.createElement("div");
    top.className = "component-item-top";

    const titleWrap = document.createElement("div");
    titleWrap.className = "component-item-title-wrap";

    const title = document.createElement("h3");
    title.className = "component-item-title";
    title.textContent = localize(item.title);

    const description = document.createElement("p");
    description.className = "component-item-desc";
    description.textContent = localize(item.description);

    const actions = document.createElement("div");
    actions.className = "component-item-actions";

    const addButton = document.createElement("button");
    addButton.type = "button";
    addButton.className = "btn btn-ghost component-add-btn component-action-icon";
    addButton.textContent = "+";
    addButton.setAttribute("aria-label", t("componentAddBtn"));
    addButton.setAttribute("title", t("componentAddBtn"));
    addButton.addEventListener("click", () => onAddComponent(item));

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "btn btn-ghost component-add-btn component-action-icon";
    editButton.textContent = "✎";
    editButton.setAttribute("aria-label", t("componentEditBtn"));
    editButton.setAttribute("title", t("componentEditBtn"));
    editButton.addEventListener("click", () => openComponentEditor(index));

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "btn btn-ghost component-add-btn component-action-icon";
    deleteButton.textContent = "×";
    deleteButton.setAttribute("aria-label", t("componentDeleteBtn"));
    deleteButton.setAttribute("title", t("componentDeleteBtn"));
    deleteButton.addEventListener("click", () => onDeleteComponent(index));

    titleWrap.appendChild(title);
    titleWrap.appendChild(description);
    top.appendChild(titleWrap);
    actions.appendChild(addButton);
    actions.appendChild(editButton);
    actions.appendChild(deleteButton);
    top.appendChild(actions);

    const details = document.createElement("details");
    details.className = "component-details";

    const summary = document.createElement("summary");
    summary.textContent = t("componentDetailsSummary");

    const code = document.createElement("pre");
    code.className = "component-json";
    code.textContent = JSON.stringify(item.template, null, 2);

    const fields = document.createElement("p");
    fields.className = "component-fields";
    fields.appendChild(formatFieldDescription(localize(item.fields)));

    details.appendChild(summary);
    details.appendChild(code);
    details.appendChild(fields);

    card.appendChild(top);
    card.appendChild(details);
    componentPaletteList.appendChild(card);
  });
}

function loadComponentLibrary() {
  const fallback = deepClone(DEFAULT_COMPONENT_LIBRARY);
  const raw = localStorage.getItem(COMPONENT_LIBRARY_KEY);
  if (!raw) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return fallback;
    }
    const normalized = parsed
      .map((item) => normalizeComponentItem(item))
      .filter(Boolean);
    if (normalized.length === 0) {
      return fallback;
    }

    const merged = appendMissingDefaultComponents(normalized);
    if (merged.length !== normalized.length) {
      localStorage.setItem(COMPONENT_LIBRARY_KEY, JSON.stringify(merged));
    }
    return merged;
  } catch {
    return fallback;
  }
}

function appendMissingDefaultComponents(existing) {
  const existingTypes = new Set(
    existing
      .map((item) => String(item?.type || "").trim().toLowerCase())
      .filter(Boolean),
  );

  const missingDefaults = DEFAULT_COMPONENT_LIBRARY
    .map((item) => normalizeComponentItem(item))
    .filter((item) => item && !existingTypes.has(item.type.toLowerCase()));

  return existing.concat(missingDefaults);
}

function saveComponentLibrary() {
  localStorage.setItem(COMPONENT_LIBRARY_KEY, JSON.stringify(componentLibrary));
}

function normalizeComponentItem(item) {
  if (!item || typeof item !== "object") {
    return null;
  }
  const type = String(item.type || "").trim();
  if (!type) {
    return null;
  }

  const mode = item.mode === "replace-schema" ? "replace-schema" : undefined;
  const normalizedTemplate = resolveTemplateForType(type, item.template);
  return {
    type,
    title: normalizeLocaleObject(item.title, type),
    description: normalizeLocaleObject(item.description, type),
    template: normalizedTemplate,
    mode,
    fields: normalizeLocaleObject(item.fields, ""),
  };
}

function resolveTemplateForType(type, template) {
  const normalizedType = type.toLowerCase();
  if (typeof template === "undefined") {
    return deepClone(getDefaultTemplateByType(normalizedType));
  }

  if (
    normalizedType === "navbar" &&
    (template === null || template === "" || isEmptyPlainObject(template))
  ) {
    return deepClone(NAVBAR_TEMPLATE);
  }

  return deepClone(template);
}

function getDefaultTemplateByType(type) {
  if (type === "navbar") {
    return NAVBAR_TEMPLATE;
  }
  return {};
}

function isEmptyPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0;
}

function normalizeLocaleObject(value, fallback) {
  if (value && typeof value === "object") {
    return {
      ru: String(value.ru || fallback || "").trim(),
      en: String(value.en || fallback || "").trim(),
    };
  }

  const text = String(value || fallback || "").trim();
  return { ru: text, en: text };
}

function openComponentEditor(index) {
  componentEditIndex = Number.isInteger(index) ? index : null;
  const source =
    componentEditIndex !== null && componentLibrary[componentEditIndex]
      ? componentLibrary[componentEditIndex]
      : {
          type: "",
          mode: undefined,
          title: { ru: "", en: "" },
          description: { ru: "", en: "" },
          fields: { ru: "", en: "" },
          template: {},
        };

  componentFieldType.value = source.type || "";
  componentFieldMode.value = source.mode === "replace-schema" ? "replace-schema" : "";
  componentFieldTitleRu.value = source.title?.ru || "";
  componentFieldTitleEn.value = source.title?.en || "";
  componentFieldDescRu.value = source.description?.ru || "";
  componentFieldDescEn.value = source.description?.en || "";
  componentFieldFieldsRu.value = source.fields?.ru || "";
  componentFieldFieldsEn.value = source.fields?.en || "";
  componentTemplateEditor.value = `${JSON.stringify(source.template ?? {}, null, 2)}\n`;
  componentEditorTitle.textContent = t(componentEditIndex === null ? "componentEditorTitleCreate" : "componentEditorTitleEdit");

  componentEditorModal.classList.remove("is-hidden");
  componentEditorModal.setAttribute("aria-hidden", "false");
  componentFieldType.focus();
}

function closeComponentEditor() {
  componentEditorModal.classList.add("is-hidden");
  componentEditorModal.setAttribute("aria-hidden", "true");
  componentEditIndex = null;
}

function onSaveComponentEditor(event) {
  event.preventDefault();

  const type = componentFieldType.value.trim();
  if (!type) {
    appendAction(`[${t("systemLabel")}] ${t("componentSaveErrorType")}`);
    return;
  }

  let template;
  try {
    template = JSON.parse(componentTemplateEditor.value);
  } catch {
    appendAction(`[${t("systemLabel")}] ${t("componentSaveErrorJson")}`);
    return;
  }

  const nextItem = normalizeComponentItem({
    type,
    mode: componentFieldMode.value === "replace-schema" ? "replace-schema" : undefined,
    title: { ru: componentFieldTitleRu.value.trim(), en: componentFieldTitleEn.value.trim() },
    description: { ru: componentFieldDescRu.value.trim(), en: componentFieldDescEn.value.trim() },
    fields: { ru: componentFieldFieldsRu.value.trim(), en: componentFieldFieldsEn.value.trim() },
    template,
  });
  if (!nextItem) {
    appendAction(`[${t("systemLabel")}] ${t("componentSaveErrorType")}`);
    return;
  }

  const isEdit = componentEditIndex !== null;
  if (isEdit) {
    componentLibrary[componentEditIndex] = nextItem;
  } else {
    componentLibrary.push(nextItem);
  }

  saveComponentLibrary();
  renderComponentPalette();
  closeComponentEditor();
  appendAction(
    `[${t("systemLabel")}] ${t(isEdit ? "componentSaved" : "componentCreated")} ${nextItem.type}`,
  );
}

function onDeleteComponent(index) {
  const item = componentLibrary[index];
  if (!item) {
    return;
  }
  const confirmMessage = t("componentDeleteConfirm").replace("{type}", item.type);
  if (!window.confirm(confirmMessage)) {
    return;
  }
  componentLibrary.splice(index, 1);
  saveComponentLibrary();
  renderComponentPalette();
  appendAction(`[${t("systemLabel")}] ${t("componentDeleted")} ${item.type}`);
}

function localize(content) {
  if (typeof content === "string") {
    return content;
  }
  if (content && typeof content === "object") {
    return content[currentLocale] || content.ru || content.en || "";
  }
  return "";
}

function formatFieldDescription(text) {
  const fragment = document.createDocumentFragment();
  const segments = String(text || "")
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean);

  segments.forEach((segment, index) => {
    const match = segment.match(/^([a-zA-Z0-9_.-]+)\s*:\s*(.*)$/);
    if (match) {
      const key = document.createElement("strong");
      key.className = "component-field-key";
      key.textContent = match[1];
      fragment.appendChild(key);
      fragment.appendChild(document.createTextNode(`: ${match[2]}`));
    } else {
      fragment.appendChild(document.createTextNode(segment));
    }

    if (index < segments.length - 1) {
      fragment.appendChild(document.createTextNode("; "));
    }
  });

  return fragment;
}

async function onAddComponent(item) {
  if (item.mode === "replace-schema") {
    const confirmMessage = t("componentReplaceSchemaConfirm").replace("{type}", item.type || localize(item.title));
    if (!window.confirm(confirmMessage)) {
      return;
    }
    editor.value = formatSchema(item.template);
    persistEditorSchema(editor.value);
    setUnsavedChanges(true);
    appendAction(`[${t("systemLabel")}] ${t("componentInsertSuccess")} ${item.type}`);
    await renderSchema(editor.value);
    return;
  }

  const rawSchema = editor.value;
  const cursor = typeof editor.selectionStart === "number" ? editor.selectionStart : rawSchema.length;
  let rootNode;
  try {
    rootNode = parseJsonWithLocations(rawSchema);
  } catch {
    appendAction(`[${t("systemLabel")}] ${t("componentInsertError")}`);
    return;
  }

  const targetArrayNode = findCursorInsertionArray(rootNode, cursor);
  if (!targetArrayNode || !Array.isArray(targetArrayNode.value)) {
    appendAction(`[${t("systemLabel")}] ${t("componentInsertError")}`);
    return;
  }

  const insertIndex = getArrayInsertionIndex(targetArrayNode, cursor);
  const componentNode = deepClone(item.template);
  ensureUniqueIdsInNode(componentNode, collectSchemaIds(rootNode.value));
  targetArrayNode.value.splice(insertIndex, 0, componentNode);
  editor.value = formatSchema(rootNode.value);
  persistEditorSchema(editor.value);
  setUnsavedChanges(true);
  appendAction(`[${t("systemLabel")}] ${t("componentInsertSuccess")} ${item.type}`);
  await renderSchema(editor.value);
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function collectSchemaIds(node, set = new Set()) {
  if (Array.isArray(node)) {
    node.forEach((item) => collectSchemaIds(item, set));
    return set;
  }

  if (!node || typeof node !== "object") {
    return set;
  }

  if (typeof node.id === "string" && node.id.trim() !== "") {
    set.add(node.id);
  }

  Object.values(node).forEach((value) => collectSchemaIds(value, set));
  return set;
}

function ensureUniqueIdsInNode(node, usedIds) {
  if (Array.isArray(node)) {
    node.forEach((item) => ensureUniqueIdsInNode(item, usedIds));
    return;
  }

  if (!node || typeof node !== "object") {
    return;
  }

  if (typeof node.id === "string" && node.id.trim() !== "") {
    node.id = nextUniqueId(node.id, usedIds);
  }

  Object.values(node).forEach((value) => ensureUniqueIdsInNode(value, usedIds));
}

function nextUniqueId(baseId, usedIds) {
  const normalizedBase = baseId.replace(/_\d+$/, "");
  let index = 1;
  let candidate = `${normalizedBase}_${index}`;

  while (usedIds.has(candidate)) {
    index += 1;
    candidate = `${normalizedBase}_${index}`;
  }

  usedIds.add(candidate);
  return candidate;
}

function findCursorInsertionArray(rootNode, cursor) {
  const deepestArray = findDeepestNodeAtCursor(rootNode, cursor, (node) => node.type === "array");
  if (deepestArray) {
    return deepestArray;
  }

  const deepestObjectWithChildren = findDeepestNodeAtCursor(
    rootNode,
    cursor,
    (node) => node.type === "object" && hasChildrenArray(node),
  );
  if (deepestObjectWithChildren) {
    return getObjectPropertyNode(deepestObjectWithChildren, "children");
  }

  if (rootNode.type === "object") {
    const rootChildren = getObjectPropertyNode(rootNode, "children");
    if (rootChildren && rootChildren.type === "array") {
      return rootChildren;
    }
  }

  if (rootNode.type === "array") {
    return rootNode;
  }

  return null;
}

function findDeepestNodeAtCursor(rootNode, cursor, matcher) {
  let bestMatch = null;

  const visit = (node, depth) => {
    if (!isCursorInsideNode(node, cursor)) {
      return;
    }

    if (matcher(node) && (!bestMatch || depth > bestMatch.depth)) {
      bestMatch = { node, depth };
    }

    if (node.type === "array") {
      node.items.forEach((child) => visit(child, depth + 1));
      return;
    }

    if (node.type === "object") {
      node.properties.forEach((property) => visit(property.value, depth + 1));
    }
  };

  visit(rootNode, 0);
  return bestMatch ? bestMatch.node : null;
}

function hasChildrenArray(objectNode) {
  const childrenNode = getObjectPropertyNode(objectNode, "children");
  return Boolean(childrenNode && childrenNode.type === "array");
}

function getObjectPropertyNode(objectNode, key) {
  if (!objectNode || objectNode.type !== "object") {
    return null;
  }

  const property = objectNode.properties.find((item) => item.key === key);
  return property ? property.value : null;
}

function isCursorInsideNode(node, cursor) {
  return cursor >= node.start && cursor <= node.end;
}

function getArrayInsertionIndex(arrayNode, cursor) {
  const items = Array.isArray(arrayNode.items) ? arrayNode.items : [];
  if (items.length === 0) {
    return 0;
  }

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    if (cursor <= item.start) {
      return index;
    }
    if (cursor >= item.end) {
      continue;
    }
    const midpoint = item.start + (item.end - item.start) / 2;
    return cursor < midpoint ? index : index + 1;
  }

  return items.length;
}

function parseJsonWithLocations(source) {
  let index = 0;
  const length = source.length;

  const fail = (message) => {
    throw new Error(`${message} at position ${index}`);
  };

  const skipWhitespace = () => {
    while (index < length) {
      const char = source[index];
      if (char === " " || char === "\n" || char === "\r" || char === "\t") {
        index += 1;
      } else {
        break;
      }
    }
  };

  const parseStringNode = () => {
    const start = index;
    if (source[index] !== "\"") {
      fail("Expected string");
    }
    index += 1;

    let escaped = false;
    while (index < length) {
      const char = source[index];
      if (escaped) {
        escaped = false;
        index += 1;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        index += 1;
        continue;
      }
      if (char === "\"") {
        index += 1;
        const token = source.slice(start, index);
        let value;
        try {
          value = JSON.parse(token);
        } catch {
          fail("Invalid string");
        }
        return { type: "string", start, end: index, value };
      }
      if (char === "\n" || char === "\r") {
        fail("Unterminated string");
      }
      index += 1;
    }

    fail("Unterminated string");
  };

  const parseNumberNode = () => {
    const start = index;
    const match = source.slice(index).match(/^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?/);
    if (!match) {
      fail("Invalid number");
    }
    const token = match[0];
    index += token.length;
    return { type: "number", start, end: index, value: Number(token) };
  };

  const parseLiteralNode = (literal, type, value) => {
    const start = index;
    if (!source.startsWith(literal, index)) {
      fail(`Expected ${literal}`);
    }
    index += literal.length;
    return { type, start, end: index, value };
  };

  const parseArrayNode = () => {
    const start = index;
    index += 1;
    skipWhitespace();

    const items = [];
    const value = [];

    if (source[index] === "]") {
      index += 1;
      return { type: "array", start, end: index, items, value };
    }

    while (true) {
      if (index >= length) {
        fail("Unexpected end of array");
      }
      const itemNode = parseValueNode();
      items.push(itemNode);
      value.push(itemNode.value);

      skipWhitespace();
      const separator = source[index];
      if (separator === ",") {
        index += 1;
        skipWhitespace();
        continue;
      }
      if (separator === "]") {
        index += 1;
        break;
      }
      fail("Expected ',' or ']'");
    }

    return { type: "array", start, end: index, items, value };
  };

  const parseObjectNode = () => {
    const start = index;
    index += 1;
    skipWhitespace();

    const properties = [];
    const value = {};

    if (source[index] === "}") {
      index += 1;
      return { type: "object", start, end: index, properties, value };
    }

    while (true) {
      if (index >= length) {
        fail("Unexpected end of object");
      }
      if (source[index] !== "\"") {
        fail("Expected string key");
      }

      const keyNode = parseStringNode();
      const key = keyNode.value;
      skipWhitespace();

      if (source[index] !== ":") {
        fail("Expected ':'");
      }
      index += 1;

      const valueNode = parseValueNode();
      properties.push({ key, keyNode, value: valueNode });
      value[key] = valueNode.value;

      skipWhitespace();
      const separator = source[index];
      if (separator === ",") {
        index += 1;
        skipWhitespace();
        continue;
      }
      if (separator === "}") {
        index += 1;
        break;
      }
      fail("Expected ',' or '}'");
    }

    return { type: "object", start, end: index, properties, value };
  };

  const parseValueNode = () => {
    skipWhitespace();
    if (index >= length) {
      fail("Unexpected end of JSON");
    }

    const char = source[index];
    if (char === "{") {
      return parseObjectNode();
    }
    if (char === "[") {
      return parseArrayNode();
    }
    if (char === "\"") {
      return parseStringNode();
    }
    if (char === "-" || (char >= "0" && char <= "9")) {
      return parseNumberNode();
    }
    if (char === "t") {
      return parseLiteralNode("true", "boolean", true);
    }
    if (char === "f") {
      return parseLiteralNode("false", "boolean", false);
    }
    if (char === "n") {
      return parseLiteralNode("null", "null", null);
    }

    fail("Unexpected token");
  };

  const rootNode = parseValueNode();
  skipWhitespace();
  if (index !== length) {
    fail("Unexpected trailing token");
  }

  return rootNode;
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
    persistEditorSchema(editor.value);
    setUnsavedChanges(true);
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

  if (currentFileHandle && window.showSaveFilePicker) {
    try {
      const writable = await currentFileHandle.createWritable();
      await writable.write(content);
      await writable.close();
      persistEditorSchema(content);
      setUnsavedChanges(false);
      updateEditorFileInfo();
      appendAction(`[${t("systemLabel")}] ${t("fileSaved")} ${currentFileName}`);
      return;
    } catch {
      // Continue to picker flow.
    }
  }

  try {
    if (window.showSaveFilePicker) {
      const handle = await window.showSaveFilePicker({
        suggestedName: currentFileName || t("saveDefaultName"),
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
      currentFileHandle = handle;
      currentFileName = handle.name || t("saveDefaultName");
      persistEditorSchema(content);
      setUnsavedChanges(false);
      updateEditorFileInfo();
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
  currentFileHandle = null;
  currentFileName = fallbackName;
  persistEditorSchema(content);
  setUnsavedChanges(false);
  updateEditorFileInfo();
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
  const applyLoadedTemplate = async (text, fileName) => {
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      appendAction(`[${t("systemLabel")}] ${t("fileLoadError")}`);
      return;
    }

    editor.value = formatSchema(parsed);
    persistEditorSchema(editor.value);

    if (registryState.projectId && registryState.contractId && registryState.versionId && registryState.screenId) {
      await apiRequest(`/api/screens/${encodeURIComponent(registryState.screenId)}?${contextQuery()}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content_json: parsed }),
      });
      setUnsavedChanges(false);
      await renderSchema(editor.value);
      appendAction(`[${t("systemLabel")}] ${t("fileLoaded")} ${fileName}`);
      appendAction(`[${t("systemLabel")}] ${t("contextSaved")} ${registryState.screenId}`);
      await hydrateScreens();
      return;
    }

    setUnsavedChanges(true);
    await renderSchema(editor.value);
    appendAction(`[${t("systemLabel")}] ${t("fileLoaded")} ${fileName}`);
  };

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
      currentFileHandle = handle;
      currentFileName = file.name || handle.name || "";
      updateEditorFileInfo();
      await applyLoadedTemplate(text, file.name || currentFileName || "template.json");
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
      currentFileHandle = null;
      currentFileName = file.name || "";
      updateEditorFileInfo();
      await applyLoadedTemplate(text, file.name || "template.json");
    } catch {
      appendAction(`[${t("systemLabel")}] ${t("fileLoadError")}`);
    }
  };
  jsonFileInput.click();
}

async function onClearEditorClick() {
  editor.value = formatSchema(FORM_SCHEMA_TEMPLATE);
  persistEditorSchema(editor.value);
  setUnsavedChanges(true);
  appendAction(`[${t("systemLabel")}] ${t("editorResetToForm")}`);
  await renderSchema(editor.value);
}

function formatSchema(schema) {
  return `${JSON.stringify(schema, null, 2)}\n`;
}

function initializeWorkspaceSplitters() {
  if (!workspace || workspaceSplitters.length === 0) {
    return;
  }

  freezeWorkspacePanelWidths();
  window.addEventListener("resize", freezeWorkspacePanelWidths);
  workspaceSplitters.forEach((splitter) => {
    splitter.addEventListener("pointerdown", (event) => onSplitterPointerDown(event, splitter));
  });
}

function freezeWorkspacePanelWidths() {
  if (window.matchMedia("(max-width: 1120px)").matches) {
    [componentsCard, editorCard, previewCard].forEach((panel) => {
      if (!panel) {
        return;
      }
      panel.style.flex = "";
      panel.style.minWidth = "";
    });
    return;
  }

  const workspaceWidth = Math.round(workspace.getBoundingClientRect().width);
  const splittersWidth = workspaceSplitters.reduce((sum, splitter) => sum + Math.round(splitter.getBoundingClientRect().width || 10), 0);
  const availableWidth = Math.max(0, workspaceWidth - splittersWidth);

  let componentsWidth = clamp(getPanelCurrentWidth(componentsCard), PANEL_LIMITS.componentsCard.min, PANEL_LIMITS.componentsCard.max);
  let editorWidth = clamp(getPanelCurrentWidth(editorCard), PANEL_LIMITS.editorCard.min, PANEL_LIMITS.editorCard.max);
  const previewMin = PANEL_LIMITS.previewCard.min;

  const maxFixedWidth = Math.max(
    PANEL_LIMITS.componentsCard.min + PANEL_LIMITS.editorCard.min,
    availableWidth - previewMin,
  );

  if (componentsWidth + editorWidth > maxFixedWidth) {
    const overflow = componentsWidth + editorWidth - maxFixedWidth;
    const editorShrink = Math.min(overflow, editorWidth - PANEL_LIMITS.editorCard.min);
    editorWidth -= editorShrink;
    const remainingOverflow = overflow - editorShrink;
    if (remainingOverflow > 0) {
      componentsWidth = Math.max(PANEL_LIMITS.componentsCard.min, componentsWidth - remainingOverflow);
    }
  }

  setPanelWidth(componentsCard, componentsWidth);
  setPanelWidth(editorCard, editorWidth);
  previewCard.style.flex = "1 1 auto";
  previewCard.style.minWidth = "0";
}

function getPanelCurrentWidth(panel) {
  if (!panel) {
    return 0;
  }

  const inlineFlex = panel.style.flex || "";
  const match = inlineFlex.match(/0\\s+0\\s+([0-9.]+)px/);
  if (match) {
    return Number(match[1]);
  }

  return Math.round(panel.getBoundingClientRect().width);
}

function onSplitterPointerDown(event, splitter) {
  if (window.matchMedia("(max-width: 1120px)").matches) {
    return;
  }

  const left = splitter.previousElementSibling;
  const right = splitter.nextElementSibling;
  if (!left || !right) {
    return;
  }

  freezeWorkspacePanelWidths();

  const startX = event.clientX;
  const startLeft = left.getBoundingClientRect().width;
  const startRight = right.getBoundingClientRect().width;
  const pairWidth = startLeft + startRight;

  const leftLimits = getPanelLimits(left);
  const rightLimits = getPanelLimits(right);
  const minLeft = leftLimits.min;
  const maxLeft = Math.min(leftLimits.max, pairWidth - rightLimits.min);
  const minRight = rightLimits.min;
  const maxRight = Math.min(rightLimits.max, pairWidth - leftLimits.min);

  if (maxLeft < minLeft || maxRight < minRight) {
    return;
  }

  const minDelta = Math.max(minLeft - startLeft, startRight - maxRight);
  const maxDelta = Math.min(maxLeft - startLeft, startRight - minRight);

  splitter.classList.add("is-dragging");
  document.body.classList.add("is-resizing");
  splitter.setPointerCapture(event.pointerId);

  const onPointerMove = (moveEvent) => {
    const rawDelta = moveEvent.clientX - startX;
    const delta = clamp(rawDelta, minDelta, maxDelta);
    setPanelWidth(left, startLeft + delta);
    setPanelWidth(right, startRight - delta);
  };

  const onPointerUp = () => {
    splitter.classList.remove("is-dragging");
    document.body.classList.remove("is-resizing");
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
  };

  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
}

function getPanelLimits(panel) {
  if (!panel || !panel.id) {
    return { min: 280, max: 1200 };
  }
  return PANEL_LIMITS[panel.id] || { min: 280, max: 1200 };
}

function setPanelWidth(panel, width) {
  const value = Math.max(180, Math.round(width));
  panel.style.flex = `0 0 ${value}px`;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
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
