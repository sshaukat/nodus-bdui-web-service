export type Locale = "ru" | "en";

export type SchemaVersion = "v0_1" | "v0_2";

export interface Spacing {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
}

export interface Layout {
  padding?: Spacing;
  margin?: Spacing;
  width?: string;
  height?: string;
  weight?: number;
  alignment?: string;
  justify?: string;
  distribution?: string;
  alignItems?: string;
  crossAlign?: string;
}

export interface BduiAction {
  type?: string;
  value?: string;
  url?: string;
  route?: string;
  [key: string]: unknown;
}

export type IconSource = "library" | "custom";

export interface IconRef {
  name?: string;
  source?: IconSource;
}

export interface NavbarActionItem {
  icon?: string | IconRef;
  title?: string;
  action?: BduiAction;
}

export interface BduiNode {
  type?: string;
  id?: string;
  visible?: boolean;
  enabled?: boolean;
  layout?: Layout;
  children?: BduiNode[];
  value?: string;
  title?: string;
  icon?: string | IconRef;
  justify?: string;
  distribution?: string;
  alignItems?: string;
  crossAlign?: string;
  wrap?: string;
  gap?: number;
  action?: BduiAction;
  onChange?: BduiAction;
  placeholder?: string;
  subtitle?: string;
  sourceType?: string;
  showLeftButton?: boolean;
  leftIcon?: string | IconRef;
  leftTitle?: string;
  leftAction?: BduiAction;
  titleHorizontalAlign?: "start" | "center";
  titleAlign?: "start" | "center";
  titleWrap?: boolean;
  subtitleWrap?: boolean;
  titleMaxLines?: number;
  subtitleMaxLines?: number;
  centerContent?: BduiNode;
  showBack?: boolean;
  backIcon?: string | IconRef;
  backTitle?: string;
  backAction?: BduiAction;
  backButtonClick?: BduiAction;
  actions?: Array<string | IconRef | NavbarActionItem>;
  [key: string]: unknown;
}

export interface DecodeValidateResponse {
  ok: boolean;
  node: BduiNode | null;
  decodeErrors: Array<{ path: string; message: string }>;
  validationErrors: Array<{ path: string; message: string }>;
  appliedSchemaVersion?: SchemaVersion;
}

export interface LocaleField {
  ru: string;
  en: string;
}

export interface ComponentItem {
  type: string;
  mode?: "replace-schema";
  title: LocaleField;
  description: LocaleField;
  fields: LocaleField;
  template: BduiNode;
  template_raw?: string;
  template_parse_error?: string | null;
  updated_by?: string;
  change_note?: string;
}

export interface Project {
  project_id: string;
  name: string;
}

export interface Contract {
  project_id: string;
  contract_id: string;
  name: string;
}

export interface Version {
  project_id: string;
  contract_id: string;
  version_id: string;
  default_schema_version?: SchemaVersion;
}

export interface Screen {
  project_id: string;
  contract_id: string;
  version_id: string;
  screen_id: string;
  name: string;
  status: "active" | "inactive" | "deleted";
  schema_version?: SchemaVersion;
  content_raw?: string | null;
  content_json?: BduiNode | null;
  content_parse_error?: string | null;
}

export interface RegistryContext {
  projectId: string;
  contractId: string;
  versionId: string;
  screenId: string;
}
