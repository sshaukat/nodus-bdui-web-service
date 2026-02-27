import type { BduiNode, ComponentItem, Locale, SchemaVersion } from "../types";
import { FORM_SCHEMA_TEMPLATE } from "./defaults";

export function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function localize(locale: Locale, source?: { ru?: string; en?: string } | null): string {
  if (!source) {
    return "";
  }
  return String(source[locale] || source.en || source.ru || "");
}

export function safeJsonParse<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function normalizeSchemaVersion(raw: unknown): SchemaVersion {
  const value = String(raw || "").trim().toLowerCase().replace("-", "_");
  if (value === "v0_1") {
    return "v0_1";
  }
  return "v0_2";
}

export function ensureSchemaTemplate(raw: string): string {
  if (raw.trim()) {
    return raw;
  }
  return `${JSON.stringify(FORM_SCHEMA_TEMPLATE, null, 2)}\n`;
}

export function collectNodeIds(node: unknown, target: Set<string> = new Set<string>()): Set<string> {
  if (!node || typeof node !== "object") {
    return target;
  }
  const current = node as BduiNode;
  if (typeof current.id === "string" && current.id.trim()) {
    target.add(current.id);
  }
  if (Array.isArray(current.children)) {
    for (const child of current.children) {
      collectNodeIds(child, target);
    }
  }
  return target;
}

export function ensureUniqueIdsInNode(node: BduiNode, usedIds: Set<string>): void {
  if (typeof node.id === "string" && node.id.trim()) {
    let next = node.id;
    let i = 1;
    while (usedIds.has(next)) {
      next = `${node.id}_${i++}`;
    }
    node.id = next;
    usedIds.add(next);
  }
  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      ensureUniqueIdsInNode(child, usedIds);
    }
  }
}

export function appendMissingDefaultComponents(
  source: ComponentItem[],
  defaults: ComponentItem[],
): ComponentItem[] {
  const known = new Set(source.map((item) => item.type));
  const merged = [...source];
  for (const item of defaults) {
    if (!known.has(item.type)) {
      merged.push(item);
    }
  }
  return merged;
}
