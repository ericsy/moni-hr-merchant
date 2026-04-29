import React from "react";
import type { MerchantFeatureTreeNode } from "../lib/merchantApi";
import {
  getEndpointKeyByRequestPath,
  getFeatureRequestAddress,
  isApiRequestPath,
  normalizeEndpointPath,
  type MerchantEndpointKey,
} from "./merchantEndpoints";

type PageModule = { default: React.ComponentType<Record<string, unknown>> };
type RouteComponent = React.ComponentType<Record<string, unknown>> | React.LazyExoticComponent<React.ComponentType<Record<string, unknown>>>;

export type KnownPageKey =
  | "home"
  | "dashboard"
  | "employees"
  | "stores"
  | "areas"
  | "schedule"
  | "rosters"
  | "rosterTemplate"
  | "billing";

export type PageKey = KnownPageKey | (string & {});

interface MerchantRouteTemplate {
  pageKey: KnownPageKey;
  path: string;
  componentPath: string;
  requestPath: string;
  endpointKey?: MerchantEndpointKey;
  aliases: string[];
}

export interface MerchantRouteConfig {
  pageKey: PageKey;
  path: string;
  aliases: string[];
  componentPath: string;
  requestPath?: string;
  endpointKey?: MerchantEndpointKey;
  component: RouteComponent;
  featureId?: number | string | null;
}

const pageModules = import.meta.glob<PageModule>([
  "../pages/Dashboard.tsx",
  "../pages/Employees.tsx",
  "../pages/Stores.tsx",
  "../pages/Areas.tsx",
  "../pages/Schedule.tsx",
  "../pages/Rosters.tsx",
  "../pages/RosterTemplate.tsx",
  "../pages/Billing.tsx",
]);
const lazyPageComponents = new Map<string, React.LazyExoticComponent<React.ComponentType<Record<string, unknown>>>>();

const merchantRouteTemplates: MerchantRouteTemplate[] = [
  {
    pageKey: "dashboard",
    path: "/dashboard",
    componentPath: "../pages/Dashboard.tsx",
    requestPath: "",
    aliases: ["/", "/dashboard"],
  },
  {
    pageKey: "employees",
    path: "/employees",
    componentPath: "../pages/Employees.tsx",
    requestPath: "/api/v1/merchant/employees",
    endpointKey: "employees",
    aliases: ["/employees", "/employee", "/employee-management", "/api/v1/merchant/employees"],
  },
  {
    pageKey: "stores",
    path: "/stores",
    componentPath: "../pages/Stores.tsx",
    requestPath: "/api/v1/merchant/stores",
    endpointKey: "stores",
    aliases: ["/stores", "/store", "/store-management", "/api/v1/merchant/stores"],
  },
  {
    pageKey: "areas",
    path: "/areas",
    componentPath: "../pages/Areas.tsx",
    requestPath: "/api/v1/merchant/schedule-areas",
    endpointKey: "areas",
    aliases: ["/areas", "/area", "/area-management", "/schedule-areas", "/api/v1/merchant/schedule-areas"],
  },
  {
    pageKey: "schedule",
    path: "/schedule",
    componentPath: "../pages/Schedule.tsx",
    requestPath: "/api/v1/merchant/schedule",
    endpointKey: "schedule",
    aliases: [
      "/schedule",
      "/schedules",
      "/shift",
      "/shifts",
      "/shift-management",
      "/global-shifts",
      "/api/v1/merchant/schedule",
      "/api/v1/merchant/global-shifts",
    ],
  },
  {
    pageKey: "rosters",
    path: "/rosters",
    componentPath: "../pages/Rosters.tsx",
    requestPath: "/api/v1/merchant/schedule",
    endpointKey: "schedule",
    aliases: ["/rosters", "/roster", "/roster-management", "/scheduling", "/scheduling-management"],
  },
  {
    pageKey: "rosterTemplate",
    path: "/roster-template",
    componentPath: "../pages/RosterTemplate.tsx",
    requestPath: "/api/v1/merchant/schedule-templates",
    endpointKey: "scheduleTemplates",
    aliases: [
      "/roster-template",
      "/rosterTemplate",
      "/schedule-templates",
      "/templates",
      "/scheduling-template",
      "/scheduling-templates",
      "/api/v1/merchant/schedule-templates",
    ],
  },
  {
    pageKey: "billing",
    path: "/billing",
    componentPath: "../pages/Billing.tsx",
    requestPath: "/api/v1/merchant/billing/subscription",
    endpointKey: "billing",
    aliases: [
      "/billing",
      "/subscription",
      "/invoices",
      "/api/v1/merchant/billing",
      "/api/v1/merchant/billing/subscribe",
      "/api/v1/merchant/billing/add-quantity",
      "/api/v1/merchant/billing/subscription",
      "/api/v1/merchant/billing/invoices",
    ],
  },
];

export const merchantRoutes = merchantRouteTemplates;

const routeTemplateByPageKey = new Map(merchantRouteTemplates.map((route) => [route.pageKey, route]));
const routeTemplateByComponentPath = new Map(merchantRouteTemplates.map((route) => [route.componentPath, route]));
const routeTemplateByEndpointKey: Partial<Record<MerchantEndpointKey, MerchantRouteTemplate>> = {
  stores: routeTemplateByPageKey.get("stores"),
  employees: routeTemplateByPageKey.get("employees"),
  areas: routeTemplateByPageKey.get("areas"),
  globalShifts: routeTemplateByPageKey.get("schedule"),
  scheduleTemplates: routeTemplateByPageKey.get("rosterTemplate"),
  schedule: routeTemplateByPageKey.get("schedule"),
  billing: routeTemplateByPageKey.get("billing"),
};

const pageKeyAliases: Record<string, KnownPageKey> = {
  home: "home",
  dashboard: "dashboard",
  employees: "employees",
  employee: "employees",
  employeemanagement: "employees",
  stores: "stores",
  store: "stores",
  storemanagement: "stores",
  areas: "areas",
  area: "areas",
  areamanagement: "areas",
  scheduleareas: "areas",
  schedulearea: "areas",
  schedule: "schedule",
  schedules: "schedule",
  shiftmanagement: "schedule",
  globalshiftmanagement: "schedule",
  shifts: "schedule",
  shift: "schedule",
  rosters: "rosters",
  roster: "rosters",
  rostermanagement: "rosters",
  schedulingmanagement: "rosters",
  rostertemplate: "rosterTemplate",
  rostertemplates: "rosterTemplate",
  scheduletemplates: "rosterTemplate",
  scheduletemplate: "rosterTemplate",
  schedulingtemplates: "rosterTemplate",
  schedulingtemplate: "rosterTemplate",
  templates: "rosterTemplate",
  billing: "billing",
  subscription: "billing",
  subscriptions: "billing",
  invoices: "billing",
  invoice: "billing",
};

const componentPathFields = ["componentPath", "component", "viewPath", "componentUrl", "componentName"];
const routePathFields = ["routePath", "path", "menuPath", "pagePath", "frontendPath", "frontPath"];
const pageKeyFields = ["pageKey", "key", "code", "permissionCode", "featureCode", "nameEn", "name"];
const nestedFieldContainers = ["meta", "metadata", "extra", "options"];

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

function normalizeLookupKey(value: string) {
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

function normalizeFeatureUrl(url?: string | null) {
  const raw = String(url || "").trim();
  if (!raw) return "";

  const withoutHash = raw.split("#")[0];
  const withoutQuery = withoutHash.split("?")[0];
  const pathname = getPathnameFromMaybeAbsoluteUrl(withoutQuery);
  const withLeadingSlash = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return withLeadingSlash.length > 1 ? withLeadingSlash.replace(/\/+$/, "") : withLeadingSlash;
}

function normalizeRoutePath(path?: string | null) {
  const normalized = normalizeFeatureUrl(path);
  return normalized || "";
}

function toKebabPath(key: string) {
  return `/${key.replace(/([a-z0-9])([A-Z])/g, "$1-$2").replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase()}`;
}

const pageModulePathByLookupKey = Object.keys(pageModules).reduce((map, modulePath) => {
  const fileName = modulePath.split("/").pop() || modulePath;
  map.set(normalizeLookupKey(fileName), modulePath);
  map.set(normalizeLookupKey(modulePath), modulePath);
  return map;
}, new Map<string, string>());

function withTsxExtension(value: string) {
  return /\.[jt]sx?$/i.test(value) ? value : `${value}.tsx`;
}

export function normalizeComponentPath(componentPath?: string | null) {
  const raw = String(componentPath || "").trim();
  if (!raw) return "";

  const withoutHash = raw.split("#")[0].split("?")[0].replace(/^@\/+/, "src/");
  const candidates = new Set<string>();

  if (!withoutHash.includes("/")) {
    candidates.add(`../pages/${withTsxExtension(withoutHash)}`);
  }

  const srcPagesIndex = withoutHash.indexOf("src/pages/");
  if (srcPagesIndex >= 0) {
    candidates.add(`../pages/${withTsxExtension(withoutHash.slice(srcPagesIndex + "src/pages/".length))}`);
  }

  const pagesIndex = withoutHash.indexOf("pages/");
  if (pagesIndex >= 0) {
    candidates.add(`../pages/${withTsxExtension(withoutHash.slice(pagesIndex + "pages/".length))}`);
  }

  const normalizedRelative = withoutHash.startsWith("../pages/")
    ? withoutHash
    : withoutHash.startsWith("./pages/")
    ? `..${withoutHash.slice(1)}`
    : withoutHash.startsWith("/src/pages/")
    ? `../pages/${withoutHash.slice("/src/pages/".length)}`
    : withoutHash;
  candidates.add(withTsxExtension(normalizedRelative));

  for (const candidate of candidates) {
    if (pageModules[candidate]) return candidate;
  }

  return pageModulePathByLookupKey.get(normalizeLookupKey(withoutHash)) || "";
}

function getPageComponent(componentPath: string) {
  if (!componentPath || !pageModules[componentPath]) return undefined;

  if (!lazyPageComponents.has(componentPath)) {
    lazyPageComponents.set(componentPath, React.lazy(pageModules[componentPath]));
  }

  return lazyPageComponents.get(componentPath);
}

function getKnownPageKey(value?: string | null): KnownPageKey | undefined {
  const raw = String(value || "").trim();
  if (!raw) return undefined;

  const fileName = raw.split("/").filter(Boolean).pop() || raw;
  return pageKeyAliases[normalizeLookupKey(fileName)];
}

function getRouteTemplateByFeatureUrl(url?: string | null) {
  const normalizedUrl = normalizeFeatureUrl(url);
  if (!normalizedUrl) return undefined;

  return merchantRouteTemplates.find((route) =>
    route.aliases.some((alias) => {
      const normalizedAlias = normalizeFeatureUrl(alias);
      if (normalizedUrl === normalizedAlias) return true;
      return normalizedAlias.startsWith("/api/") && normalizedUrl.startsWith(`${normalizedAlias}/`);
    })
  );
}

function getRouteTemplateForFeature(node: MerchantFeatureTreeNode) {
  const explicitPageKey = getKnownPageKey(getStringField(node, pageKeyFields));
  if (explicitPageKey) return routeTemplateByPageKey.get(explicitPageKey);

  const componentPath = normalizeComponentPath(getStringField(node, componentPathFields));
  if (componentPath) {
    const byComponent = routeTemplateByComponentPath.get(componentPath);
    if (byComponent) return byComponent;
  }

  const requestAddress = getFeatureRequestAddress(node);
  const endpointKey = getEndpointKeyByRequestPath(requestAddress);
  if (endpointKey && routeTemplateByEndpointKey[endpointKey]) return routeTemplateByEndpointKey[endpointKey];

  return getRouteTemplateByFeatureUrl(node.url);
}

function isRequestLikePath(path?: string | null) {
  return isApiRequestPath(path) || /^https?:\/\//i.test(String(path || "").trim());
}

function getRoutePathFromFeature(node: MerchantFeatureTreeNode, routeTemplate?: MerchantRouteTemplate, pageKey?: PageKey) {
  const explicitPath = getStringField(node, routePathFields);
  if (explicitPath && !isRequestLikePath(explicitPath)) {
    return normalizeRoutePath(explicitPath);
  }

  if (node.url && !isRequestLikePath(node.url)) {
    const featureRoutePath = normalizeRoutePath(node.url);
    if (featureRoutePath === "/" && routeTemplate?.path && routeTemplate.path !== "/") {
      return routeTemplate.path;
    }
    return featureRoutePath;
  }

  return routeTemplate?.path || (pageKey ? toKebabPath(pageKey) : "");
}

function getPageKeyFromFeature(
  node: MerchantFeatureTreeNode,
  routeTemplate?: MerchantRouteTemplate,
  componentPath?: string,
  routePath?: string
): PageKey {
  const explicitKey = getKnownPageKey(getStringField(node, pageKeyFields));
  if (explicitKey) return explicitKey;
  if (routeTemplate) return routeTemplate.pageKey;

  const componentKey = getKnownPageKey(componentPath);
  if (componentKey) return componentKey;

  const fallback = componentPath?.split("/").pop() || routePath || String(node.id || "page");
  return normalizeLookupKey(fallback) || "page";
}

export function resolveRouteConfigFromFeature(node: MerchantFeatureTreeNode): MerchantRouteConfig | undefined {
  const routeTemplate = getRouteTemplateForFeature(node);
  const serverComponentPath = getStringField(node, componentPathFields);
  const componentPath = normalizeComponentPath(serverComponentPath || routeTemplate?.componentPath);
  const component = getPageComponent(componentPath);

  if (!component) return undefined;

  const requestAddress = getFeatureRequestAddress(node) || routeTemplate?.requestPath || "";
  const endpointKey = getEndpointKeyByRequestPath(requestAddress) || routeTemplate?.endpointKey;
  const pageKey = getPageKeyFromFeature(node, routeTemplate, componentPath);
  const path = getRoutePathFromFeature(node, routeTemplate, pageKey);

  if (!path) return undefined;

  return {
    pageKey,
    path,
    aliases: routeTemplate?.aliases || [path],
    componentPath,
    requestPath: requestAddress || undefined,
    endpointKey,
    component,
    featureId: node.id,
  };
}

export function getPagePath(pageKey?: PageKey | null, routes?: MerchantRouteConfig[]) {
  if (!pageKey) return undefined;
  if (pageKey === "home") return "/";
  return routes?.find((route) => route.pageKey === pageKey)?.path || routeTemplateByPageKey.get(pageKey as KnownPageKey)?.path;
}

export function getRouteConfigByPageKey(pageKey?: PageKey | null) {
  if (!pageKey) return undefined;
  const routeTemplate = routeTemplateByPageKey.get(pageKey as KnownPageKey);
  if (!routeTemplate) return undefined;

  const component = getPageComponent(routeTemplate.componentPath);
  if (!component) return undefined;

  return {
    ...routeTemplate,
    component,
  } satisfies MerchantRouteConfig;
}

export function getRouteConfigByFeatureUrl(url?: string | null) {
  const routeTemplate = getRouteTemplateByFeatureUrl(url);
  if (!routeTemplate) return undefined;

  const component = getPageComponent(routeTemplate.componentPath);
  if (!component) return undefined;

  return {
    ...routeTemplate,
    component,
  } satisfies MerchantRouteConfig;
}

export function isApiFeatureUrl(url?: string | null) {
  return isApiRequestPath(url);
}

export function isSameApiFeatureUrl(a?: string | null, b?: string | null) {
  return normalizeEndpointPath(a) === normalizeEndpointPath(b);
}
