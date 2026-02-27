import type {
  ComponentItem,
  Contract,
  DecodeValidateResponse,
  Project,
  RegistryContext,
  Screen,
  Version,
} from "../types";

class ApiClientError extends Error {
  readonly status: number;
  readonly payload: unknown;

  constructor(status: number, message: string, payload: unknown) {
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

function getErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") {
    return fallback;
  }
  const record = payload as Record<string, unknown>;
  const error = record.error as Record<string, unknown> | undefined;
  if (error && typeof error.message === "string") {
    return error.message;
  }
  return fallback;
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.headers || {}),
    },
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new ApiClientError(response.status, getErrorMessage(payload, `Request failed: ${response.status}`), payload);
  }

  return payload as T;
}

export async function decodeValidate(schemaRaw: string, schemaVersion: string): Promise<DecodeValidateResponse> {
  return apiRequest<DecodeValidateResponse>("/api/decode-validate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ schema: schemaRaw, schema_version: schemaVersion }),
  });
}

export async function listProjects(): Promise<Project[]> {
  const payload = await apiRequest<{ items: Project[] }>("/api/projects");
  return payload.items || [];
}

export async function createProject(project_id: string, name: string): Promise<Project> {
  return apiRequest<Project>("/api/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ project_id, name }),
  });
}

export async function listContracts(projectId: string): Promise<Contract[]> {
  const payload = await apiRequest<{ items: Contract[] }>(`/api/contracts?project_id=${encodeURIComponent(projectId)}`);
  return payload.items || [];
}

export async function createContract(project_id: string, contract_id: string, name: string): Promise<Contract> {
  return apiRequest<Contract>("/api/contracts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ project_id, contract_id, name }),
  });
}

export async function listVersions(projectId: string, contractId: string): Promise<Version[]> {
  const payload = await apiRequest<{ items: Version[] }>(
    `/api/versions?project_id=${encodeURIComponent(projectId)}&contract_id=${encodeURIComponent(contractId)}`,
  );
  return payload.items || [];
}

export async function createVersion(project_id: string, contract_id: string, version_id: string, based_on_version_id?: string): Promise<Version> {
  return apiRequest<Version>("/api/versions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ project_id, contract_id, version_id, based_on_version_id: based_on_version_id || null, default_schema_version: "v0_2" }),
  });
}

export async function listScreens(context: Omit<RegistryContext, "screenId">, includeDeleted = false): Promise<Screen[]> {
  const params = new URLSearchParams({
    project_id: context.projectId,
    contract_id: context.contractId,
    version_id: context.versionId,
  });
  if (includeDeleted) {
    params.set("include_deleted", "1");
  }
  const payload = await apiRequest<{ items: Screen[] }>(`/api/screens?${params.toString()}`);
  return payload.items || [];
}

export async function createScreen(payload: {
  project_id: string;
  contract_id: string;
  version_id: string;
  screen_id: string;
  name: string;
  content_raw: string;
}): Promise<Screen> {
  return apiRequest<Screen>("/api/screens", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function updateScreen(
  context: RegistryContext,
  payload: { name?: string; content_raw?: string; status?: "active" | "inactive" | "deleted" },
): Promise<Screen> {
  const params = new URLSearchParams({
    project_id: context.projectId,
    contract_id: context.contractId,
    version_id: context.versionId,
  });
  return apiRequest<Screen>(`/api/screens/${encodeURIComponent(context.screenId)}?${params.toString()}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function patchScreenStatus(
  context: RegistryContext,
  status: "active" | "inactive" | "deleted",
): Promise<Screen> {
  const params = new URLSearchParams({
    project_id: context.projectId,
    contract_id: context.contractId,
    version_id: context.versionId,
  });
  return apiRequest<Screen>(`/api/screens/${encodeURIComponent(context.screenId)}/status?${params.toString()}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
}

export async function publishVersion(context: Omit<RegistryContext, "screenId">): Promise<{ pub_id: string }> {
  return apiRequest<{ pub_id: string }>("/api/publish", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      project_id: context.projectId,
      contract_id: context.contractId,
      version_id: context.versionId,
    }),
  });
}

export async function listComponents(): Promise<ComponentItem[]> {
  const payload = await apiRequest<{ items: ComponentItem[] }>("/api/components");
  return payload.items || [];
}

export async function createComponent(item: ComponentItem, writeToken: string): Promise<ComponentItem> {
  return apiRequest<ComponentItem>("/api/components", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Components-Token": writeToken,
    },
    body: JSON.stringify(item),
  });
}

export async function upsertComponent(type: string, item: ComponentItem, writeToken: string): Promise<ComponentItem> {
  return apiRequest<ComponentItem>(`/api/components/${encodeURIComponent(type)}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "X-Components-Token": writeToken,
    },
    body: JSON.stringify(item),
  });
}

export async function deleteComponent(type: string, writeToken: string): Promise<void> {
  await apiRequest(`/api/components/${encodeURIComponent(type)}`, {
    method: "DELETE",
    headers: {
      "X-Components-Token": writeToken,
    },
  });
}

export { ApiClientError };
