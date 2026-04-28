import type { MerchantFeatureTreeNode } from "../lib/merchantApi";

export type MerchantEndpointKey =
  | "stores"
  | "employees"
  | "areas"
  | "globalShifts"
  | "scheduleTemplates"
  | "schedule"
  | "positions"
  | "workAreas";

export const DEFAULT_MERCHANT_ENDPOINTS: Record<MerchantEndpointKey, string> = {
  stores: "/api/v1/merchant/stores",
  employees: "/api/v1/merchant/employees",
  areas: "/api/v1/merchant/schedule-areas",
  globalShifts: "/api/v1/merchant/global-shifts",
  scheduleTemplates: "/api/v1/merchant/schedule-templates",
  schedule: "/api/v1/merchant/schedule",
  positions: "/api/v1/merchant/positions",
  workAreas: "/api/v1/merchant/work-areas",
};

const endpointKeyAliases: Record<string, MerchantEndpointKey> = {
  stores: "stores",
  store: "stores",
  storemanagement: "stores",
  employees: "employees",
  employee: "employees",
  employeemanagement: "employees",
  staff: "employees",
  areas: "areas",
  area: "areas",
  areamanagement: "areas",
  scheduleareas: "areas",
  schedulearea: "areas",
  globalshifts: "globalShifts",
  globalshift: "globalShifts",
  shifts: "globalShifts",
  shift: "globalShifts",
  shiftmanagement: "globalShifts",
  scheduletemplates: "scheduleTemplates",
  scheduletemplate: "scheduleTemplates",
  schedulingtemplates: "scheduleTemplates",
  schedulingtemplate: "scheduleTemplates",
  rostertemplate: "scheduleTemplates",
  rostertemplates: "scheduleTemplates",
  templates: "scheduleTemplates",
  schedule: "schedule",
  schedules: "schedule",
  scheduling: "schedule",
  schedulingmanagement: "schedule",
  rosters: "schedule",
  roster: "schedule",
  rostermanagement: "schedule",
  positions: "positions",
  position: "positions",
  workareas: "workAreas",
  workarea: "workAreas",
};

const endpointMapFields = ["requestUrls", "requestUrlMap", "apiUrls", "apiUrlMap", "endpoints", "apis"];
const explicitRequestUrlFields = ["requestUrl", "requestPath", "apiUrl", "apiPath"];
const componentFields = ["componentPath", "component", "viewPath", "componentUrl", "componentName"];
const nestedFieldContainers = ["meta", "metadata", "extra", "options"];

let runtimeEndpointOverrides: Partial<Record<MerchantEndpointKey, string>> = {};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function getStringField(node: MerchantFeatureTreeNode, fieldNames: string[]) {
  const rawNode = node as MerchantFeatureTreeNode & Record<string, unknown>;

  for (const fieldName of fieldNames) {
    const value = rawNode[fieldName];
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  for (const containerName of nestedFieldContainers) {
    const container = asRecord(rawNode[containerName]);
    for (const fieldName of fieldNames) {
      const value = container[fieldName];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
  }

  return "";
}

function getRecordField(node: MerchantFeatureTreeNode, fieldNames: string[]) {
  const rawNode = node as MerchantFeatureTreeNode & Record<string, unknown>;

  for (const fieldName of fieldNames) {
    const value = rawNode[fieldName];
    if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  }

  for (const containerName of nestedFieldContainers) {
    const container = asRecord(rawNode[containerName]);
    for (const fieldName of fieldNames) {
      const value = container[fieldName];
      if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
    }
  }

  return {};
}

function normalizeAliasKey(value: string) {
  return value.replace(/\.[jt]sx?$/i, "").replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function getPathnameFromMaybeAbsoluteUrl(value: string) {
  if (!/^https?:\/\//i.test(value)) return value;

  try {
    return new URL(value).pathname;
  } catch {
    return value;
  }
}

export function normalizeEndpointPath(value?: string | null) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const withoutHash = raw.split("#")[0];
  const withoutQuery = withoutHash.split("?")[0];
  const pathname = getPathnameFromMaybeAbsoluteUrl(withoutQuery);
  const withLeadingSlash = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return withLeadingSlash.length > 1 ? withLeadingSlash.replace(/\/+$/, "") : withLeadingSlash;
}

export function normalizeRequestAddress(value?: string | null) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw.replace(/\/+$/, "");
  return normalizeEndpointPath(raw);
}

export function isApiRequestPath(value?: string | null) {
  return normalizeEndpointPath(value).startsWith("/api/");
}

export function appendEndpointPath(base: string, ...segments: Array<string | number>) {
  const rawBase = String(base || "");
  const suffixIndex = rawBase.search(/[?#]/);
  const basePath = suffixIndex >= 0 ? rawBase.slice(0, suffixIndex) : rawBase;
  const suffix = suffixIndex >= 0 ? rawBase.slice(suffixIndex) : "";
  const cleanBase = basePath.replace(/\/+$/, "");
  const cleanSegments = segments
    .map((segment) => String(segment).trim())
    .filter(Boolean)
    .map((segment) => segment.replace(/^\/+|\/+$/g, ""));

  return `${[cleanBase, ...cleanSegments].filter(Boolean).join("/")}${suffix}`;
}

export function getMerchantEndpoint(key: MerchantEndpointKey) {
  return runtimeEndpointOverrides[key] || DEFAULT_MERCHANT_ENDPOINTS[key];
}

export function configureMerchantEndpoints(overrides: Partial<Record<MerchantEndpointKey, string>>) {
  runtimeEndpointOverrides = Object.entries(overrides).reduce<Partial<Record<MerchantEndpointKey, string>>>(
    (next, [key, value]) => {
      const normalized = normalizeRequestAddress(value);
      if (normalized) {
        next[key as MerchantEndpointKey] = normalized;
      }
      return next;
    },
    {}
  );
}

export function resetMerchantEndpoints() {
  runtimeEndpointOverrides = {};
}

export function getEndpointKeyByAlias(value?: string | null): MerchantEndpointKey | undefined {
  const alias = normalizeAliasKey(String(value || ""));
  return endpointKeyAliases[alias];
}

export function getEndpointKeyByRequestPath(value?: string | null): MerchantEndpointKey | undefined {
  const normalized = normalizeEndpointPath(value);
  if (!normalized) return undefined;

  const defaults = Object.entries(DEFAULT_MERCHANT_ENDPOINTS) as Array<[MerchantEndpointKey, string]>;
  const matchedDefault = defaults.find(([, defaultPath]) => {
    const normalizedDefault = normalizeEndpointPath(defaultPath);
    return normalized === normalizedDefault || normalized.startsWith(`${normalizedDefault}/`);
  });

  if (matchedDefault) return matchedDefault[0];

  const lastSegment = normalized.split("/").filter(Boolean).pop();
  return getEndpointKeyByAlias(lastSegment);
}

function getEndpointKeyByComponent(node: MerchantFeatureTreeNode) {
  const component = getStringField(node, componentFields);
  if (!component) return undefined;
  const fileName = component.split("/").filter(Boolean).pop() || component;
  return getEndpointKeyByAlias(fileName);
}

function collectEndpointMapOverrides(node: MerchantFeatureTreeNode) {
  const endpointMap = getRecordField(node, endpointMapFields);

  return Object.entries(endpointMap).reduce<Partial<Record<MerchantEndpointKey, string>>>((overrides, [rawKey, value]) => {
    if (typeof value !== "string" || !value.trim()) return overrides;

    const endpointKey = getEndpointKeyByAlias(rawKey);
    if (endpointKey) {
      overrides[endpointKey] = value.trim();
    }

    return overrides;
  }, {});
}

export function getFeatureRequestAddress(node: MerchantFeatureTreeNode) {
  const explicitRequestAddress = getStringField(node, explicitRequestUrlFields);
  if (explicitRequestAddress) {
    return normalizeRequestAddress(explicitRequestAddress);
  }

  const legacyUrl = getStringField(node, ["url"]);
  return isApiRequestPath(legacyUrl) || /^https?:\/\//i.test(legacyUrl)
    ? normalizeRequestAddress(legacyUrl)
    : "";
}

export function collectMerchantEndpointOverrides(features: MerchantFeatureTreeNode[]) {
  const overrides: Partial<Record<MerchantEndpointKey, string>> = {};

  const visit = (nodes: MerchantFeatureTreeNode[] | null | undefined) => {
    for (const node of nodes || []) {
      if (node.status !== 1) continue;

      Object.assign(overrides, collectEndpointMapOverrides(node));

      const requestAddress = getFeatureRequestAddress(node);
      if (requestAddress) {
        const endpointKey = getEndpointKeyByRequestPath(requestAddress) || getEndpointKeyByComponent(node);
        if (endpointKey) {
          overrides[endpointKey] = requestAddress;
        }
      }

      visit(node.children);
    }
  };

  visit(features);
  return overrides;
}
