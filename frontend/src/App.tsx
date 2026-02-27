import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { CodeEditor } from "./components/CodeEditor";
import { PreviewRenderer } from "./components/PreviewRenderer";
import {
  ApiClientError,
  createComponent,
  createContract,
  createProject,
  createScreen,
  createVersion,
  decodeValidate,
  deleteComponent,
  listComponents,
  listContracts,
  listProjects,
  listScreens,
  listVersions,
  patchScreenStatus,
  publishVersion,
  updateScreen,
  upsertComponent,
} from "./lib/api";
import {
  COMPONENT_LIBRARY_KEY,
  COMPONENT_WRITE_TOKEN_KEY,
  DEFAULT_COMPONENT_LIBRARY,
  FORM_SCHEMA_TEMPLATE,
  LAST_SCHEMA_KEY,
  LOCALE_KEY,
  SUPPORTED_LOCALES,
  SUPPORTED_THEMES,
  THEME_ICONS,
  THEME_KEY,
  type ThemeMode,
} from "./lib/defaults";
import { t } from "./lib/i18n";
import {
  appendMissingDefaultComponents,
  collectNodeIds,
  deepClone,
  ensureSchemaTemplate,
  ensureUniqueIdsInNode,
  localize,
  normalizeSchemaVersion,
  safeJsonParse,
} from "./lib/utils";
import type { BduiAction, BduiNode, ComponentItem, Locale, RegistryContext, Screen } from "./types";

interface ComponentDraft {
  sourceType: string | null;
  type: string;
  mode: "" | "replace-schema";
  titleRu: string;
  titleEn: string;
  descriptionRu: string;
  descriptionEn: string;
  fieldsRu: string;
  fieldsEn: string;
  templateRaw: string;
}

interface PanelWidths {
  components: number;
  editor: number;
}

type SplitterSide = "left" | "right" | null;

interface SplitterDragState {
  side: Exclude<SplitterSide, null>;
  startX: number;
  startComponents: number;
  startEditor: number;
}

const INITIAL_COMPONENT_DRAFT: ComponentDraft = {
  sourceType: null,
  type: "",
  mode: "",
  titleRu: "",
  titleEn: "",
  descriptionRu: "",
  descriptionEn: "",
  fieldsRu: "",
  fieldsEn: "",
  templateRaw: "{}\n",
};

const PANEL_WIDTHS_KEY = "nodus.panelWidths.v1";
const PANEL_DEFAULTS: PanelWidths = {
  components: 410,
  editor: 652,
};
const PANEL_LIMITS = {
  componentsMin: 260,
  componentsMax: 720,
  editorMin: 360,
  editorMax: 1100,
  previewMin: 320,
  splittersWidth: 20,
};

function actionToLine(action: string, value?: string): string {
  if (value) {
    return `[${action}] ${value}`;
  }
  return `[${action}]`;
}

function toJsonString(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function loadPanelWidths(): PanelWidths {
  const saved = localStorage.getItem(PANEL_WIDTHS_KEY);
  if (!saved) {
    return PANEL_DEFAULTS;
  }
  try {
    const parsed = JSON.parse(saved) as Partial<PanelWidths>;
    const components = Number(parsed.components);
    const editor = Number(parsed.editor);
    return {
      components: Number.isFinite(components) ? components : PANEL_DEFAULTS.components,
      editor: Number.isFinite(editor) ? editor : PANEL_DEFAULTS.editor,
    };
  } catch {
    return PANEL_DEFAULTS;
  }
}

function fromStorageLocale(): Locale {
  const saved = String(localStorage.getItem(LOCALE_KEY) || "ru");
  if (SUPPORTED_LOCALES.includes(saved as Locale)) {
    return saved as Locale;
  }
  return "ru";
}

function fromStorageTheme(): ThemeMode {
  const saved = String(localStorage.getItem(THEME_KEY) || "dark");
  if (SUPPORTED_THEMES.includes(saved as ThemeMode)) {
    return saved as ThemeMode;
  }
  return "dark";
}

function newDefaultSchema(): string {
  return toJsonString(FORM_SCHEMA_TEMPLATE);
}

function componentDraftFromItem(item: ComponentItem): ComponentDraft {
  return {
    sourceType: item.type,
    type: item.type,
    mode: item.mode || "",
    titleRu: item.title?.ru || "",
    titleEn: item.title?.en || "",
    descriptionRu: item.description?.ru || "",
    descriptionEn: item.description?.en || "",
    fieldsRu: item.fields?.ru || "",
    fieldsEn: item.fields?.en || "",
    templateRaw: toJsonString(item.template || {}),
  };
}

export default function App(): JSX.Element {
  const [locale, setLocale] = useState<Locale>(() => fromStorageLocale());
  const [theme, setTheme] = useState<ThemeMode>(() => fromStorageTheme());
  const [schemaText, setSchemaText] = useState<string>(() => {
    const saved = localStorage.getItem(LAST_SCHEMA_KEY);
    return ensureSchemaTemplate(saved || newDefaultSchema());
  });

  const [projects, setProjects] = useState<Array<{ project_id: string; name: string }>>([]);
  const [contracts, setContracts] = useState<Array<{ contract_id: string; name: string }>>([]);
  const [versions, setVersions] = useState<Array<{ version_id: string }>>([]);
  const [screens, setScreens] = useState<Screen[]>([]);
  const [context, setContext] = useState<RegistryContext>({
    projectId: "",
    contractId: "",
    versionId: "",
    screenId: "",
  });

  const [previewNode, setPreviewNode] = useState<BduiNode | null>(null);
  const [errors, setErrors] = useState<Array<{ path: string; message: string }>>([]);
  const [actions, setActions] = useState<string[]>([]);
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const [isBusy, setIsBusy] = useState(false);
  const [isEditorExpanded, setIsEditorExpanded] = useState(false);
  const [panelWidths, setPanelWidths] = useState<PanelWidths>(() => loadPanelWidths());
  const [activeSplitter, setActiveSplitter] = useState<SplitterSide>(null);

  const [componentLibrary, setComponentLibrary] = useState<ComponentItem[]>([]);
  const [isComponentModalOpen, setIsComponentModalOpen] = useState(false);
  const [componentDraft, setComponentDraft] = useState<ComponentDraft>(INITIAL_COMPONENT_DRAFT);
  const workspaceRef = useRef<HTMLElement | null>(null);
  const dragStateRef = useRef<SplitterDragState | null>(null);

  const tt = useCallback((key: Parameters<typeof t>[1]) => t(locale, key), [locale]);
  const toggleEditorLayoutLabel = isEditorExpanded
    ? locale === "ru"
      ? "Вернуть исходный вид"
      : "Restore default layout"
    : locale === "ru"
      ? "Скрыть верхние блоки"
      : "Collapse top sections";

  const appendAction = useCallback((line: string) => {
    setActions((current) => [line, ...current].slice(0, 150));
  }, []);

  const runRender = useCallback(
    async (raw: string) => {
      const resolvedRaw = ensureSchemaTemplate(raw);
      let schemaVersion = "v0_2";
      try {
        const parsed = JSON.parse(resolvedRaw) as Record<string, unknown>;
        schemaVersion = normalizeSchemaVersion(parsed.schemaVersion);
      } catch {
        schemaVersion = "v0_2";
      }

      try {
        const payload = await decodeValidate(resolvedRaw, schemaVersion);
        const allErrors = [...(payload.decodeErrors || []), ...(payload.validationErrors || [])];
        setErrors(allErrors);
        setPreviewNode(payload.node || null);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Render error";
        setErrors([{ path: "$", message }]);
        setPreviewNode(null);
      }
    },
    [],
  );

  const syncHierarchy = useCallback(
    async (options?: { ensureDefaults?: boolean; preferred?: Partial<RegistryContext>; loadScreen?: boolean }) => {
      const ensureDefaults = options?.ensureDefaults === true;
      const preferred = options?.preferred || {};
      const loadScreen = options?.loadScreen !== false;

      let projectId = preferred.projectId ?? context.projectId;
      let contractId = preferred.contractId ?? context.contractId;
      let versionId = preferred.versionId ?? context.versionId;
      let screenId = preferred.screenId ?? context.screenId;

      let nextProjects = await listProjects();
      if (ensureDefaults && nextProjects.length === 0) {
        await createProject("demo", "Demo Project");
        nextProjects = await listProjects();
      }
      if (!nextProjects.find((item) => item.project_id === projectId)) {
        projectId = nextProjects[0]?.project_id || "";
      }

      let nextContracts: Array<{ contract_id: string; name: string }> = [];
      if (projectId) {
        nextContracts = await listContracts(projectId);
        if (ensureDefaults && nextContracts.length === 0) {
          await createContract(projectId, "main-contract", "Main Contract");
          nextContracts = await listContracts(projectId);
        }
      }
      if (!nextContracts.find((item) => item.contract_id === contractId)) {
        contractId = nextContracts[0]?.contract_id || "";
      }

      let nextVersions: Array<{ version_id: string }> = [];
      if (projectId && contractId) {
        nextVersions = await listVersions(projectId, contractId);
        if (ensureDefaults && nextVersions.length === 0) {
          await createVersion(projectId, contractId, "v0-2");
          nextVersions = await listVersions(projectId, contractId);
        }
      }
      if (!nextVersions.find((item) => item.version_id === versionId)) {
        versionId = nextVersions[0]?.version_id || "";
      }

      let nextScreens: Screen[] = [];
      if (projectId && contractId && versionId) {
        nextScreens = await listScreens({ projectId, contractId, versionId });
        if (ensureDefaults && nextScreens.length === 0) {
          await createScreen({
            project_id: projectId,
            contract_id: contractId,
            version_id: versionId,
            screen_id: "home",
            name: "Home",
            content_raw: ensureSchemaTemplate(schemaText),
          });
          nextScreens = await listScreens({ projectId, contractId, versionId });
        }
      }
      const activeScreens = nextScreens.filter((item) => item.status !== "deleted");
      if (!activeScreens.find((item) => item.screen_id === screenId)) {
        screenId = activeScreens[0]?.screen_id || "";
      }

      setProjects(nextProjects);
      setContracts(nextContracts);
      setVersions(nextVersions);
      setScreens(activeScreens);
      setContext({ projectId, contractId, versionId, screenId });

      if (loadScreen) {
        const selected = activeScreens.find((item) => item.screen_id === screenId);
        if (selected?.content_raw) {
          const nextRaw = ensureSchemaTemplate(selected.content_raw);
          setSchemaText(nextRaw);
          localStorage.setItem(LAST_SCHEMA_KEY, nextRaw);
          await runRender(nextRaw);
        }
      }
    },
    [context, runRender, schemaText],
  );

  const loadComponents = useCallback(async () => {
    const cached = safeJsonParse<ComponentItem[]>(localStorage.getItem(COMPONENT_LIBRARY_KEY) || "[]", []);

    try {
      const serverItems = await listComponents();
      const merged = appendMissingDefaultComponents(
        serverItems.length > 0 ? serverItems : cached.length > 0 ? cached : DEFAULT_COMPONENT_LIBRARY,
        DEFAULT_COMPONENT_LIBRARY,
      );
      setComponentLibrary(merged);
    } catch (error) {
      const merged = appendMissingDefaultComponents(cached.length > 0 ? cached : DEFAULT_COMPONENT_LIBRARY, DEFAULT_COMPONENT_LIBRARY);
      setComponentLibrary(merged);
      appendAction(actionToLine("system", error instanceof Error ? error.message : "Component server unavailable"));
    }
  }, [appendAction]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang = locale;
    localStorage.setItem(LOCALE_KEY, locale);
  }, [locale]);

  useEffect(() => {
    localStorage.setItem(LAST_SCHEMA_KEY, schemaText);
    const timer = window.setTimeout(() => {
      void runRender(schemaText);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [schemaText, runRender]);

  useEffect(() => {
    localStorage.setItem(COMPONENT_LIBRARY_KEY, JSON.stringify(componentLibrary));
  }, [componentLibrary]);

  useEffect(() => {
    localStorage.setItem(PANEL_WIDTHS_KEY, JSON.stringify(panelWidths));
  }, [panelWidths]);

  useEffect(() => {
    const ensureWidthsFit = () => {
      const workspace = workspaceRef.current;
      if (!workspace) {
        return;
      }
      const totalWidth = Math.max(0, workspace.clientWidth - PANEL_LIMITS.splittersWidth);
      setPanelWidths((current) => {
        let components = clamp(current.components, PANEL_LIMITS.componentsMin, PANEL_LIMITS.componentsMax);
        let editor = clamp(current.editor, PANEL_LIMITS.editorMin, PANEL_LIMITS.editorMax);

        const maxEditor = Math.max(PANEL_LIMITS.editorMin, totalWidth - components - PANEL_LIMITS.previewMin);
        editor = Math.min(editor, maxEditor);

        const maxComponents = Math.max(PANEL_LIMITS.componentsMin, totalWidth - editor - PANEL_LIMITS.previewMin);
        components = Math.min(components, maxComponents);

        if (components === current.components && editor === current.editor) {
          return current;
        }
        return { components, editor };
      });
    };

    ensureWidthsFit();
    window.addEventListener("resize", ensureWidthsFit);
    return () => window.removeEventListener("resize", ensureWidthsFit);
  }, []);

  useEffect(() => {
    if (!activeSplitter) {
      return;
    }

    const onMouseMove = (event: MouseEvent) => {
      const drag = dragStateRef.current;
      const workspace = workspaceRef.current;
      if (!drag || !workspace) {
        return;
      }

      const deltaX = event.clientX - drag.startX;
      const totalWidth = Math.max(0, workspace.clientWidth - PANEL_LIMITS.splittersWidth);

      if (drag.side === "left") {
        const sum = drag.startComponents + drag.startEditor;

        let nextComponents = clamp(
          drag.startComponents + deltaX,
          PANEL_LIMITS.componentsMin,
          PANEL_LIMITS.componentsMax,
        );
        let nextEditor = sum - nextComponents;

        if (nextEditor < PANEL_LIMITS.editorMin) {
          nextEditor = PANEL_LIMITS.editorMin;
          nextComponents = sum - nextEditor;
        }
        if (nextEditor > PANEL_LIMITS.editorMax) {
          nextEditor = PANEL_LIMITS.editorMax;
          nextComponents = sum - nextEditor;
        }

        const maxComponents = Math.max(PANEL_LIMITS.componentsMin, totalWidth - nextEditor - PANEL_LIMITS.previewMin);
        nextComponents = Math.min(nextComponents, maxComponents);
        nextEditor = sum - nextComponents;

        setPanelWidths({
          components: nextComponents,
          editor: nextEditor,
        });
        return;
      }

      const maxEditor = Math.max(PANEL_LIMITS.editorMin, totalWidth - drag.startComponents - PANEL_LIMITS.previewMin);
      const nextEditor = clamp(drag.startEditor + deltaX, PANEL_LIMITS.editorMin, Math.min(PANEL_LIMITS.editorMax, maxEditor));

      setPanelWidths({
        components: drag.startComponents,
        editor: nextEditor,
      });
    };

    const onMouseUp = () => {
      setActiveSplitter(null);
      dragStateRef.current = null;
      document.body.classList.remove("is-resizing");
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      document.body.classList.remove("is-resizing");
    };
  }, [activeSplitter]);

  useEffect(() => {
    let isMounted = true;
    const initialize = async () => {
      setIsBusy(true);
      try {
        await loadComponents();
        await syncHierarchy({ ensureDefaults: true, loadScreen: true });
        if (isMounted) {
          await runRender(schemaText);
        }
      } catch (error) {
        appendAction(actionToLine("error", error instanceof Error ? error.message : "Initialization error"));
      } finally {
        if (isMounted) {
          setIsBusy(false);
        }
      }
    };
    void initialize();

    return () => {
      isMounted = false;
    };
  }, []);

  const selectedScreen = useMemo(
    () => screens.find((item) => item.screen_id === context.screenId) || null,
    [screens, context.screenId],
  );

  const isContextReady = Boolean(context.projectId && context.contractId && context.versionId && context.screenId);

  const handleThemeToggle = useCallback(() => {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  }, []);

  const handleLocaleChange = useCallback((nextLocale: Locale) => {
    setLocale(nextLocale);
  }, []);

  const handleProjectChange = useCallback(
    async (projectId: string) => {
      await syncHierarchy({ preferred: { projectId, contractId: "", versionId: "", screenId: "" }, loadScreen: true });
    },
    [syncHierarchy],
  );

  const handleContractChange = useCallback(
    async (contractId: string) => {
      await syncHierarchy({ preferred: { ...context, contractId, versionId: "", screenId: "" }, loadScreen: true });
    },
    [context, syncHierarchy],
  );

  const handleVersionChange = useCallback(
    async (versionId: string) => {
      await syncHierarchy({ preferred: { ...context, versionId, screenId: "" }, loadScreen: true });
    },
    [context, syncHierarchy],
  );

  const handleScreenChange = useCallback(
    async (screenId: string) => {
      await syncHierarchy({ preferred: { ...context, screenId }, loadScreen: true });
    },
    [context, syncHierarchy],
  );

  const handleCreateProject = useCallback(async () => {
    const projectId = String(window.prompt(tt("promptProjectId"), "demo-project") || "").trim();
    if (!projectId) {
      return;
    }
    const name = String(window.prompt(tt("promptProjectName"), projectId) || "").trim() || projectId;
    setIsBusy(true);
    try {
      await createProject(projectId, name);
      await syncHierarchy({ preferred: { projectId, contractId: "", versionId: "", screenId: "" }, loadScreen: false });
    } finally {
      setIsBusy(false);
    }
  }, [syncHierarchy, tt]);

  const handleCreateContract = useCallback(async () => {
    if (!context.projectId) {
      return;
    }
    const contractId = String(window.prompt(tt("promptContractId"), "main-contract") || "").trim();
    if (!contractId) {
      return;
    }
    const name = String(window.prompt(tt("promptContractName"), contractId) || "").trim() || contractId;
    setIsBusy(true);
    try {
      await createContract(context.projectId, contractId, name);
      await syncHierarchy({ preferred: { ...context, contractId, versionId: "", screenId: "" }, loadScreen: false });
    } finally {
      setIsBusy(false);
    }
  }, [context, syncHierarchy, tt]);

  const handleCreateVersion = useCallback(async () => {
    if (!context.projectId || !context.contractId) {
      return;
    }
    const versionId = String(window.prompt(tt("promptVersionId"), "v0-2") || "").trim();
    if (!versionId) {
      return;
    }
    setIsBusy(true);
    try {
      await createVersion(context.projectId, context.contractId, versionId, context.versionId || undefined);
      await syncHierarchy({ preferred: { ...context, versionId, screenId: "" }, loadScreen: false });
    } finally {
      setIsBusy(false);
    }
  }, [context, syncHierarchy, tt]);

  const handleCreateScreen = useCallback(async () => {
    if (!context.projectId || !context.contractId || !context.versionId) {
      return;
    }
    const screenId = String(window.prompt(tt("promptScreenId"), "screen-new") || "").trim();
    if (!screenId) {
      return;
    }
    const name = String(window.prompt(tt("promptScreenName"), screenId) || "").trim() || screenId;

    setIsBusy(true);
    try {
      await createScreen({
        project_id: context.projectId,
        contract_id: context.contractId,
        version_id: context.versionId,
        screen_id: screenId,
        name,
        content_raw: ensureSchemaTemplate(schemaText),
      });
      await syncHierarchy({ preferred: { ...context, screenId }, loadScreen: true });
    } finally {
      setIsBusy(false);
    }
  }, [context, schemaText, syncHierarchy, tt]);

  const handleRenameScreen = useCallback(async () => {
    if (!isContextReady) {
      return;
    }
    const nextName = String(window.prompt(tt("promptRenameScreen"), selectedScreen?.name || context.screenId) || "").trim();
    if (!nextName) {
      return;
    }
    setIsBusy(true);
    try {
      await updateScreen(context, { name: nextName });
      await syncHierarchy({ preferred: context, loadScreen: false });
    } finally {
      setIsBusy(false);
    }
  }, [context, isContextReady, selectedScreen?.name, syncHierarchy, tt]);

  const handleToggleScreenStatus = useCallback(async () => {
    if (!isContextReady) {
      return;
    }
    const allScreens = await listScreens(
      { projectId: context.projectId, contractId: context.contractId, versionId: context.versionId },
      true,
    );
    const selected = allScreens.find((item) => item.screen_id === context.screenId);
    if (!selected) {
      return;
    }

    const nextStatus = selected.status === "inactive" ? "active" : "inactive";
    setIsBusy(true);
    try {
      await patchScreenStatus(context, nextStatus);
      await syncHierarchy({ preferred: context, loadScreen: false });
    } finally {
      setIsBusy(false);
    }
  }, [context, isContextReady, syncHierarchy]);

  const handleDeleteScreen = useCallback(async () => {
    if (!isContextReady) {
      return;
    }
    setIsBusy(true);
    try {
      await patchScreenStatus(context, "deleted");
      await syncHierarchy({ preferred: { ...context, screenId: "" }, loadScreen: true });
    } finally {
      setIsBusy(false);
    }
  }, [context, isContextReady, syncHierarchy]);

  const handleSaveScreen = useCallback(async () => {
    if (!isContextReady) {
      appendAction(actionToLine("system", tt("contextNotSelected")));
      return;
    }
    setIsBusy(true);
    try {
      await updateScreen(context, { content_raw: schemaText });
      appendAction(actionToLine("system", `${tt("contextSaved")}: ${context.screenId}`));
      await syncHierarchy({ preferred: context, loadScreen: false });
    } catch (error) {
      appendAction(actionToLine("error", error instanceof Error ? error.message : "Save failed"));
    } finally {
      setIsBusy(false);
    }
  }, [appendAction, context, isContextReady, schemaText, syncHierarchy, tt]);

  const handlePublish = useCallback(async () => {
    if (!context.projectId || !context.contractId || !context.versionId) {
      return;
    }
    setIsBusy(true);
    try {
      const result = await publishVersion({
        projectId: context.projectId,
        contractId: context.contractId,
        versionId: context.versionId,
      });
      appendAction(actionToLine("publish", `${tt("contextPublished")}: ${result.pub_id}`));
    } catch (error) {
      appendAction(actionToLine("error", error instanceof Error ? error.message : "Publish failed"));
    } finally {
      setIsBusy(false);
    }
  }, [appendAction, context.contractId, context.projectId, context.versionId, tt]);

  const formatSchema = useCallback(() => {
    try {
      const parsed = JSON.parse(schemaText);
      setSchemaText(toJsonString(parsed));
    } catch (error) {
      appendAction(actionToLine("error", error instanceof Error ? error.message : "Format failed"));
    }
  }, [appendAction, schemaText]);

  const clearSchema = useCallback(() => {
    const next = newDefaultSchema();
    setSchemaText(next);
  }, []);

  const dispatchPreviewAction = useCallback(
    (action?: BduiAction, meta?: Record<string, unknown>) => {
      if (!action || typeof action !== "object") {
        return;
      }

      const actionType = String(action.type || "unknown").toLowerCase();

      if (actionType === "log") {
        appendAction(actionToLine("log", String(action.value || "")));
        return;
      }

      if (actionType === "open_url") {
        const url = String(action.url || "").trim();
        if (url) {
          window.open(url, "_blank", "noopener,noreferrer");
        }
        appendAction(actionToLine("open_url", url || JSON.stringify(meta || {})));
        return;
      }

      if (actionType === "navigate") {
        appendAction(actionToLine("navigate", String(action.route || JSON.stringify(meta || {}))));
        return;
      }

      appendAction(actionToLine(actionType, JSON.stringify(meta || {})));
    },
    [appendAction],
  );

  const handleInputChange = useCallback(
    (id: string, value: string, action?: BduiAction) => {
      setInputValues((prev) => ({ ...prev, [id]: value }));
      dispatchPreviewAction(action, { sourceId: id, value });
    },
    [dispatchPreviewAction],
  );

  const openNewComponentModal = useCallback(() => {
    setComponentDraft(INITIAL_COMPONENT_DRAFT);
    setIsComponentModalOpen(true);
  }, []);

  const openEditComponentModal = useCallback((item: ComponentItem) => {
    setComponentDraft(componentDraftFromItem(item));
    setIsComponentModalOpen(true);
  }, []);

  const closeComponentModal = useCallback(() => {
    setComponentDraft(INITIAL_COMPONENT_DRAFT);
    setIsComponentModalOpen(false);
  }, []);

  const writeToken = useMemo(
    () => String(localStorage.getItem(COMPONENT_WRITE_TOKEN_KEY) || "dev-components-token"),
    [],
  );

  const handleComponentSave = useCallback(async () => {
    const type = componentDraft.type.trim().toLowerCase();
    if (!type) {
      appendAction(actionToLine("error", "component type is empty"));
      return;
    }

    let template: BduiNode;
    try {
      template = JSON.parse(componentDraft.templateRaw) as BduiNode;
    } catch (error) {
      appendAction(actionToLine("error", error instanceof Error ? error.message : "Invalid template JSON"));
      return;
    }

    const payload: ComponentItem = {
      type,
      mode: componentDraft.mode || undefined,
      title: {
        ru: componentDraft.titleRu.trim() || type,
        en: componentDraft.titleEn.trim() || type,
      },
      description: {
        ru: componentDraft.descriptionRu.trim(),
        en: componentDraft.descriptionEn.trim(),
      },
      fields: {
        ru: componentDraft.fieldsRu.trim(),
        en: componentDraft.fieldsEn.trim(),
      },
      template,
      updated_by: "studio",
    };

    setIsBusy(true);
    try {
      let persisted: ComponentItem;
      if (componentDraft.sourceType && componentDraft.sourceType === type) {
        persisted = await upsertComponent(type, payload, writeToken);
      } else if (componentDraft.sourceType && componentDraft.sourceType !== type) {
        persisted = await upsertComponent(type, payload, writeToken);
        await deleteComponent(componentDraft.sourceType, writeToken);
      } else {
        try {
          persisted = await createComponent(payload, writeToken);
        } catch (error) {
          if (error instanceof ApiClientError && error.status === 409) {
            persisted = await upsertComponent(type, payload, writeToken);
          } else {
            throw error;
          }
        }
      }

      setComponentLibrary((current) => {
        const filtered = current.filter((item) => item.type !== componentDraft.sourceType && item.type !== persisted.type);
        return [...filtered, persisted].sort((a, b) => a.type.localeCompare(b.type));
      });
      closeComponentModal();
      appendAction(actionToLine("component", `saved: ${persisted.type}`));
    } catch (error) {
      appendAction(actionToLine("error", error instanceof Error ? error.message : "component save error"));
    } finally {
      setIsBusy(false);
    }
  }, [appendAction, closeComponentModal, componentDraft, writeToken]);

  const handleComponentDelete = useCallback(
    async (item: ComponentItem) => {
      const confirmed = window.confirm(tt("componentDeleteConfirm").replace("{type}", item.type));
      if (!confirmed) {
        return;
      }
      setIsBusy(true);
      try {
        await deleteComponent(item.type, writeToken);
        setComponentLibrary((current) => current.filter((candidate) => candidate.type !== item.type));
        appendAction(actionToLine("component", `deleted: ${item.type}`));
      } catch (error) {
        appendAction(actionToLine("error", error instanceof Error ? error.message : "component delete error"));
      } finally {
        setIsBusy(false);
      }
    },
    [appendAction, tt, writeToken],
  );

  const handleAddComponentToSchema = useCallback(
    (item: ComponentItem) => {
      if (item.mode === "replace-schema") {
        const confirmed = window.confirm(
          tt("componentReplaceSchemaConfirm").replace("{type}", item.type || localize(locale, item.title)),
        );
        if (!confirmed) {
          return;
        }
        const replacement = toJsonString(item.template);
        setSchemaText(replacement);
        appendAction(actionToLine("component", `replaced schema by ${item.type}`));
        return;
      }

      let parsed: BduiNode;
      try {
        parsed = JSON.parse(schemaText) as BduiNode;
      } catch (error) {
        appendAction(actionToLine("error", error instanceof Error ? error.message : "invalid schema"));
        return;
      }

      if (!parsed || typeof parsed !== "object") {
        appendAction(actionToLine("error", "schema root must be an object"));
        return;
      }

      if (!Array.isArray(parsed.children)) {
        parsed.children = [];
      }

      const nextNode = deepClone(item.template);
      const used = collectNodeIds(parsed);
      ensureUniqueIdsInNode(nextNode, used);
      parsed.children.push(nextNode);
      setSchemaText(toJsonString(parsed));
      appendAction(actionToLine("component", `added: ${item.type}`));
    },
    [appendAction, locale, schemaText, tt],
  );

  const handleSplitterMouseDown = useCallback(
    (side: Exclude<SplitterSide, null>, event: ReactMouseEvent<HTMLDivElement>) => {
      if (window.matchMedia("(max-width: 1120px)").matches) {
        return;
      }
      event.preventDefault();
      dragStateRef.current = {
        side,
        startX: event.clientX,
        startComponents: panelWidths.components,
        startEditor: panelWidths.editor,
      };
      setActiveSplitter(side);
      document.body.classList.add("is-resizing");
    },
    [panelWidths],
  );

  return (
    <div className={`page-shell ${isEditorExpanded ? "is-editor-expanded" : ""}`}>
      <div className="top-controls">
        <div className="lang-switch">
          <button
            className={`btn btn-lang ${locale === "ru" ? "is-active" : ""}`}
            type="button"
            onClick={() => handleLocaleChange("ru")}
          >
            <img className="lang-flag" src="/assets/flag-ru.png" alt="" aria-hidden="true" />
            <span>RU</span>
          </button>
          <button
            className={`btn btn-lang ${locale === "en" ? "is-active" : ""}`}
            type="button"
            onClick={() => handleLocaleChange("en")}
          >
            <img className="lang-flag" src="/assets/flag-en.png" alt="" aria-hidden="true" />
            <span>EN</span>
          </button>
        </div>
        <button className="btn theme-toggle" type="button" onClick={handleThemeToggle}>
          <img className="theme-toggle-icon" src={THEME_ICONS[theme]} alt="" aria-hidden="true" />
        </button>
      </div>

      <header className="hero card">
        <div className="hero-copy">
          <div className="hero-top">
            <p className="eyebrow">Nodus Studio</p>
          </div>
          <h1>{tt("heroTitle")}</h1>
          <p className="hero-subtitle">{tt("heroSubtitle")}</p>
        </div>
      </header>

      <section className="card context-card">
        <div className="card-head">
          <h2>{tt("contextTitle")}</h2>
          <span className="chip">project / contract / version</span>
        </div>
        <div className="context-grid">
          <label className="context-field">
            <span>{tt("projectLabel")}</span>
            <div className="context-input-row">
              <select value={context.projectId} onChange={(event) => void handleProjectChange(event.target.value)}>
                {projects.map((item) => (
                  <option key={item.project_id} value={item.project_id}>
                    {item.name || item.project_id}
                  </option>
                ))}
              </select>
              <button className="btn btn-ghost context-btn-sm" type="button" onClick={() => void handleCreateProject()}>
                {tt("newBtn")}
              </button>
            </div>
          </label>

          <label className="context-field">
            <span>{tt("contractLabel")}</span>
            <div className="context-input-row">
              <select value={context.contractId} onChange={(event) => void handleContractChange(event.target.value)}>
                {contracts.map((item) => (
                  <option key={item.contract_id} value={item.contract_id}>
                    {item.name || item.contract_id}
                  </option>
                ))}
              </select>
              <button className="btn btn-ghost context-btn-sm" type="button" onClick={() => void handleCreateContract()}>
                {tt("newBtn")}
              </button>
            </div>
          </label>

          <label className="context-field">
            <span>{tt("versionLabel")}</span>
            <div className="context-input-row">
              <select value={context.versionId} onChange={(event) => void handleVersionChange(event.target.value)}>
                {versions.map((item) => (
                  <option key={item.version_id} value={item.version_id}>
                    {item.version_id}
                  </option>
                ))}
              </select>
              <button className="btn btn-ghost context-btn-sm" type="button" onClick={() => void handleCreateVersion()}>
                {tt("newBtn")}
              </button>
            </div>
          </label>

          <label className="context-field">
            <span>{tt("screenLabel")}</span>
            <div className="context-input-row">
              <select value={context.screenId} onChange={(event) => void handleScreenChange(event.target.value)}>
                {screens.map((item) => (
                  <option key={item.screen_id} value={item.screen_id}>
                    {item.name || item.screen_id}
                  </option>
                ))}
              </select>
              <button className="btn btn-ghost context-btn-sm" type="button" onClick={() => void handleCreateScreen()}>
                {tt("newBtn")}
              </button>
            </div>
          </label>
        </div>

        <div className="context-actions">
          <button className="btn btn-ghost context-btn-sm" type="button" onClick={() => void syncHierarchy({ preferred: context, loadScreen: true })}>
            {tt("loadBtn")}
          </button>
          <button className="btn btn-ghost context-btn-sm" type="button" onClick={() => void handleRenameScreen()}>
            {tt("renameBtn")}
          </button>
          <button className="btn btn-ghost context-btn-sm" type="button" onClick={() => void handleToggleScreenStatus()}>
            {tt("toggleStatusBtn")}
          </button>
          <button className="btn btn-ghost context-btn-sm" type="button" onClick={() => void handleDeleteScreen()}>
            {tt("deleteBtn")}
          </button>
          <button className="btn btn-ghost context-btn-sm" type="button" onClick={() => void handleSaveScreen()}>
            {tt("saveScreenBtn")}
          </button>
          <button className="btn btn-ghost context-btn-sm" type="button" onClick={() => void handlePublish()}>
            {tt("publishBtn")}
          </button>
        </div>
        <p className="editor-file-info">
          {context.projectId && context.contractId && context.versionId && context.screenId
            ? `${context.projectId} / ${context.contractId} / ${context.versionId} / ${context.screenId}`
            : tt("contextNotSelected")}
        </p>
      </section>

      <main className="workspace" ref={workspaceRef}>
        <section className="card components-card" style={{ flexBasis: `${panelWidths.components}px` }}>
          <div className="card-head">
            <h2>{tt("componentsTitle")}</h2>
            <div className="card-head-tools">
              <button className="btn btn-ghost component-new-btn" type="button" onClick={openNewComponentModal}>
                {tt("componentNewBtn")}
              </button>
            </div>
          </div>
          <div className="component-palette-list">
            {componentLibrary.map((item) => (
              <article className="component-item" key={item.type}>
                <div className="component-item-top">
                  <div className="component-item-title-wrap">
                    <h3 className="component-item-title">{localize(locale, item.title)}</h3>
                    <p className="component-item-desc">{localize(locale, item.description)}</p>
                  </div>
                  <div className="component-item-actions">
                    <button
                      className="btn btn-ghost component-add-btn component-action-icon"
                      type="button"
                      title={tt("componentAddBtn")}
                      aria-label={tt("componentAddBtn")}
                      onClick={() => handleAddComponentToSchema(item)}
                    >
                      +
                    </button>
                    <button
                      className="btn btn-ghost component-add-btn component-action-icon"
                      type="button"
                      title={tt("componentEditBtn")}
                      aria-label={tt("componentEditBtn")}
                      onClick={() => openEditComponentModal(item)}
                    >
                      ✎
                    </button>
                    <button
                      className="btn btn-ghost component-add-btn component-action-icon"
                      type="button"
                      title={tt("componentDeleteBtn")}
                      aria-label={tt("componentDeleteBtn")}
                      onClick={() => void handleComponentDelete(item)}
                    >
                      ×
                    </button>
                  </div>
                </div>
                <details className="component-details">
                  <summary>JSON</summary>
                  <pre className="component-json">{JSON.stringify(item.template, null, 2)}</pre>
                </details>
              </article>
            ))}
          </div>
        </section>

        <div
          className={`workspace-splitter ${activeSplitter === "left" ? "is-dragging" : ""}`}
          role="separator"
          aria-orientation="vertical"
          aria-label={locale === "ru" ? "Изменить ширину каталога и редактора" : "Resize catalog and editor"}
          onMouseDown={(event) => handleSplitterMouseDown("left", event)}
        />

        <section className="card editor-card" style={{ flexBasis: `${panelWidths.editor}px` }}>
          <div className="card-head">
            <h2>{tt("editorTitle")}</h2>
            <div className="card-head-tools">
              <button className="btn btn-ghost editor-format-btn" type="button" onClick={formatSchema}>
                {tt("formatBtn")}
              </button>
              <button className="btn btn-ghost editor-clear-btn" type="button" onClick={clearSchema}>
                {tt("clearBtn")}
              </button>
              <button
                className={`btn btn-ghost editor-layout-toggle-btn ${isEditorExpanded ? "is-active" : ""}`}
                type="button"
                title={toggleEditorLayoutLabel}
                aria-label={toggleEditorLayoutLabel}
                onClick={() => setIsEditorExpanded((value) => !value)}
              >
                <span aria-hidden="true">{isEditorExpanded ? "▾" : "▴"}</span>
              </button>
            </div>
          </div>
          <CodeEditor value={schemaText} onChange={setSchemaText} className="editor-host" />
          <p className="editor-file-info">{selectedScreen ? `${selectedScreen.name} (${selectedScreen.status})` : "-"}</p>
        </section>

        <div
          className={`workspace-splitter ${activeSplitter === "right" ? "is-dragging" : ""}`}
          role="separator"
          aria-orientation="vertical"
          aria-label={locale === "ru" ? "Изменить ширину редактора и предпросмотра" : "Resize editor and preview"}
          onMouseDown={(event) => handleSplitterMouseDown("right", event)}
        />

        <section className="card preview-card">
          <div className="card-head">
            <h2>{tt("previewTitle")}</h2>
            <div className="card-head-tools">
              <button className="btn btn-ghost preview-refresh-btn" type="button" onClick={() => void runRender(schemaText)}>
                {tt("renderBtn")}
              </button>
            </div>
          </div>
          <div className="preview-root">
            {errors.length > 0 ? <div className="preview-error-note">{tt("schemaHasErrors")}</div> : null}
            <PreviewRenderer
              node={previewNode}
              inputValues={inputValues}
              onInputChange={handleInputChange}
              onAction={dispatchPreviewAction}
              buttonFallback={tt("buttonFallback")}
            />
          </div>
        </section>
      </main>

      <section className="telemetry">
        <section className="card status-card">
          <div className="card-head">
            <h2>{tt("validationTitle")}</h2>
            <span className="chip chip-danger">decode + validate</span>
          </div>
          <ul className="list">
            {errors.length === 0 ? <li>{tt("noErrors")}</li> : null}
            {errors.map((item, index) => (
              <li key={`${item.path}_${index}`} className="list-item-error">
                {item.path}: {item.message}
              </li>
            ))}
          </ul>
        </section>

        <section className="card status-card">
          <div className="card-head">
            <h2>{tt("actionTitle")}</h2>
            <span className="chip chip-info">runtime</span>
          </div>
          <ul className="list">
            {actions.map((line, index) => (
              <li key={`${line}_${index}`}>{line}</li>
            ))}
          </ul>
        </section>
      </section>

      {isComponentModalOpen ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="componentEditorTitle">
          <div className="modal-card">
            <div className="modal-head">
              <h3 id="componentEditorTitle">{componentDraft.sourceType ? tt("componentEditorEdit") : tt("componentEditorCreate")}</h3>
            </div>
            <div className="component-editor-form">
              <div className="component-editor-grid component-editor-top-grid">
                <label className="context-field">
                  <span>Type</span>
                  <input
                    value={componentDraft.type}
                    onChange={(event) => setComponentDraft((prev) => ({ ...prev, type: event.target.value }))}
                  />
                </label>
                <label className="context-field">
                  <span>Mode</span>
                  <select
                    value={componentDraft.mode}
                    onChange={(event) =>
                      setComponentDraft((prev) => ({
                        ...prev,
                        mode: event.target.value === "replace-schema" ? "replace-schema" : "",
                      }))
                    }
                  >
                    <option value="">Insert</option>
                    <option value="replace-schema">Replace schema</option>
                  </select>
                </label>
              </div>

              <div className="component-editor-grid">
                <label className="context-field">
                  <span>Title (RU)</span>
                  <input
                    value={componentDraft.titleRu}
                    onChange={(event) => setComponentDraft((prev) => ({ ...prev, titleRu: event.target.value }))}
                  />
                </label>
                <label className="context-field">
                  <span>Title (EN)</span>
                  <input
                    value={componentDraft.titleEn}
                    onChange={(event) => setComponentDraft((prev) => ({ ...prev, titleEn: event.target.value }))}
                  />
                </label>
              </div>

              <div className="component-editor-grid">
                <label className="context-field">
                  <span>Description (RU)</span>
                  <textarea
                    rows={2}
                    value={componentDraft.descriptionRu}
                    onChange={(event) => setComponentDraft((prev) => ({ ...prev, descriptionRu: event.target.value }))}
                  />
                </label>
                <label className="context-field">
                  <span>Description (EN)</span>
                  <textarea
                    rows={2}
                    value={componentDraft.descriptionEn}
                    onChange={(event) => setComponentDraft((prev) => ({ ...prev, descriptionEn: event.target.value }))}
                  />
                </label>
              </div>

              <div className="component-editor-grid">
                <label className="context-field">
                  <span>Fields (RU)</span>
                  <textarea
                    rows={2}
                    value={componentDraft.fieldsRu}
                    onChange={(event) => setComponentDraft((prev) => ({ ...prev, fieldsRu: event.target.value }))}
                  />
                </label>
                <label className="context-field">
                  <span>Fields (EN)</span>
                  <textarea
                    rows={2}
                    value={componentDraft.fieldsEn}
                    onChange={(event) => setComponentDraft((prev) => ({ ...prev, fieldsEn: event.target.value }))}
                  />
                </label>
              </div>

              <label className="context-field component-template-field">
                <span>Template JSON</span>
                <CodeEditor value={componentDraft.templateRaw} onChange={(value) => setComponentDraft((prev) => ({ ...prev, templateRaw: value }))} />
              </label>

              <div className="modal-actions">
                <button className="btn btn-ghost" type="button" onClick={closeComponentModal}>
                  {tt("cancelBtn")}
                </button>
                <button className="btn btn-ghost" type="button" onClick={() => void handleComponentSave()}>
                  {tt("saveBtn")}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {isBusy ? <div className="loading-indicator">Loading...</div> : null}
    </div>
  );
}
