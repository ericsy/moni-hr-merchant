import React from "react";
import Dashboard from "../pages/Dashboard";
import Employees from "../pages/Employees";
import Stores from "../pages/Stores";
import Areas from "../pages/Areas";
import Schedule from "../pages/Schedule";
import RosterTemplatePage from "../pages/RosterTemplate";
import Rosters from "../pages/Rosters";

export type PageKey =
  | "dashboard"
  | "employees"
  | "stores"
  | "areas"
  | "schedule"
  | "rosters"
  | "rosterTemplate";

export interface MerchantRouteConfig {
  pageKey: PageKey;
  path: string;
  aliases: string[];
  component: React.ComponentType;
}

export const merchantRoutes: MerchantRouteConfig[] = [
  {
    pageKey: "dashboard",
    path: "/",
    aliases: ["/", "/home", "/dashboard"],
    component: Dashboard,
  },
  {
    pageKey: "employees",
    path: "/employees",
    aliases: ["/employees", "/employee", "/api/v1/merchant/employees"],
    component: Employees,
  },
  {
    pageKey: "stores",
    path: "/stores",
    aliases: ["/stores", "/store", "/api/v1/merchant/stores"],
    component: Stores,
  },
  {
    pageKey: "areas",
    path: "/areas",
    aliases: ["/areas", "/schedule-areas", "/api/v1/merchant/schedule-areas"],
    component: Areas,
  },
  {
    pageKey: "schedule",
    path: "/schedule",
    aliases: ["/schedule", "/schedules", "/shifts", "/api/v1/merchant/schedule", "/api/v1/merchant/global-shifts"],
    component: Schedule,
  },
  {
    pageKey: "rosters",
    path: "/rosters",
    aliases: ["/rosters", "/roster"],
    component: Rosters,
  },
  {
    pageKey: "rosterTemplate",
    path: "/roster-template",
    aliases: [
      "/roster-template",
      "/rosterTemplate",
      "/schedule-templates",
      "/templates",
      "/api/v1/merchant/schedule-templates",
    ],
    component: RosterTemplatePage,
  },
];

const routeByPageKey = new Map(merchantRoutes.map((route) => [route.pageKey, route]));

function normalizeFeatureUrl(url?: string | null) {
  const raw = String(url || "").trim();
  if (!raw) return "";

  const withoutHash = raw.split("#")[0];
  const withoutQuery = withoutHash.split("?")[0];
  const withLeadingSlash = withoutQuery.startsWith("/") ? withoutQuery : `/${withoutQuery}`;
  return withLeadingSlash.length > 1 ? withLeadingSlash.replace(/\/+$/, "") : withLeadingSlash;
}

export function getPagePath(pageKey?: PageKey | null) {
  return pageKey ? routeByPageKey.get(pageKey)?.path : undefined;
}

export function getRouteConfigByPageKey(pageKey?: PageKey | null) {
  return pageKey ? routeByPageKey.get(pageKey) : undefined;
}

export function getRouteConfigByFeatureUrl(url?: string | null) {
  const normalizedUrl = normalizeFeatureUrl(url);
  if (!normalizedUrl) return undefined;

  return merchantRoutes.find((route) =>
    route.aliases.some((alias) => {
      const normalizedAlias = normalizeFeatureUrl(alias);
      if (normalizedUrl === normalizedAlias) return true;
      return normalizedAlias.startsWith("/api/") && normalizedUrl.startsWith(`${normalizedAlias}/`);
    })
  );
}

export function isApiFeatureUrl(url?: string | null) {
  return normalizeFeatureUrl(url).startsWith("/api/");
}
