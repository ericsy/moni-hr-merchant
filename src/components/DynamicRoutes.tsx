import { Suspense, useMemo } from "react";
import { Route, useNavigate } from "react-router-dom";
import AppLayout from "./Layout";
import { usePermissions } from "../context/PermissionsContext";
import type { MerchantFeatureTreeNode } from "../lib/merchantApi";
import {
  getPagePath,
  resolveRouteConfigFromFeature,
  type PageKey,
  type MerchantRouteConfig,
} from "../config/routes";

function isEnabledFeature(node: MerchantFeatureTreeNode) {
  return node.status === 1;
}

function sortByOrder(nodes: MerchantFeatureTreeNode[]) {
  return [...nodes].sort((a, b) => (b.sortOrder ?? 0) - (a.sortOrder ?? 0));
}

export function collectAuthorizedRouteConfigs(permissions: MerchantFeatureTreeNode[]) {
  const routeConfigs: MerchantRouteConfig[] = [];
  const seenPageKeys = new Set<string>();

  const visit = (nodes: MerchantFeatureTreeNode[]) => {
    for (const node of sortByOrder(nodes)) {
      if (!isEnabledFeature(node)) continue;

      const routeConfig = resolveRouteConfigFromFeature(node);
      if (routeConfig && routeConfig.pageKey !== "home" && !seenPageKeys.has(routeConfig.pageKey)) {
        seenPageKeys.add(routeConfig.pageKey);
        routeConfigs.push(routeConfig);
      }

      if (node.children?.length) {
        visit(node.children);
      }
    }
  };

  visit(permissions);
  return routeConfigs;
}

export function useAuthorizedRouteConfigs() {
  const { permissions } = usePermissions();

  return useMemo(() => collectAuthorizedRouteConfigs(permissions), [permissions]);
}

export function useDefaultAuthorizedPath() {
  const authorizedRoutes = useAuthorizedRouteConfigs();
  const dashboardRoute = authorizedRoutes.find((route) => route.pageKey === "dashboard");
  return dashboardRoute?.path || authorizedRoutes[0]?.path || "/";
}

export function useDynamicRoutes() {
  const navigate = useNavigate();
  const authorizedRoutes = useAuthorizedRouteConfigs();

  return useMemo(() => {
    const routes = authorizedRoutes.map((route) => {
      const Component = route.component;
      const DashboardComponent = Component as React.ComponentType<{ onNavigate?: (page: string) => void }>;
      const pageElement = route.pageKey === "dashboard"
        ? (
          <DashboardComponent
            onNavigate={(page: string) => {
              navigate(getPagePath(page as PageKey, authorizedRoutes) || "/");
            }}
          />
        )
        : <Component />;

      return (
        <Route
          key={route.pageKey}
          path={route.path}
          element={
            <AppLayout currentPage={route.pageKey}>
              <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">加载中...</div>}>
                {pageElement}
              </Suspense>
            </AppLayout>
          }
        />
      );
    });

    return routes;
  }, [authorizedRoutes, navigate]);
}

export function hasAnyMerchantRoute(permissions: MerchantFeatureTreeNode[]) {
  return collectAuthorizedRouteConfigs(permissions).length > 0;
}
