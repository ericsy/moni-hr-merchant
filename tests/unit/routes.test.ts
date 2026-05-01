import { describe, expect, it } from "vitest";
import { collectAuthorizedRouteConfigs } from "../../src/components/DynamicRoutes";
import {
  getPagePath,
  normalizeComponentPath,
  resolveRouteConfigFromFeature,
} from "../../src/config/routes";
import type { MerchantFeatureTreeNode } from "../../src/lib/merchantApi";

describe("merchant route resolution", () => {
  it("normalizes known page component paths", () => {
    expect(normalizeComponentPath("Areas")).toBe("../pages/Areas.tsx");
    expect(normalizeComponentPath("@/pages/RosterTemplate")).toBe("../pages/RosterTemplate.tsx");
  });

  it("resolves an API feature URL to the area management route", () => {
    const route = resolveRouteConfigFromFeature({
      id: 12,
      nameZh: "区域管理",
      url: "/api/v1/merchant/schedule-areas",
      status: 1,
    });

    expect(route).toMatchObject({
      pageKey: "areas",
      path: "/areas",
      requestPath: "/api/v1/merchant/schedule-areas",
      endpointKey: "areas",
    });
  });

  it("collects enabled dynamic routes once and in server sort order", () => {
    const permissions: MerchantFeatureTreeNode[] = [
      { id: 1, nameZh: "禁用员工", url: "/employees", status: 0, sortOrder: 90 },
      { id: 2, nameZh: "区域管理", url: "/areas", status: 1, sortOrder: 20 },
      { id: 3, nameZh: "员工管理", url: "/employees", status: 1, sortOrder: 80 },
      { id: 4, nameZh: "重复区域", url: "/areas", status: 1, sortOrder: 10 },
    ];

    expect(collectAuthorizedRouteConfigs(permissions).map((route) => route.pageKey)).toEqual([
      "employees",
      "areas",
    ]);
  });

  it("uses authorized route paths before route template defaults", () => {
    expect(getPagePath("areas", [{ pageKey: "areas", path: "/custom-areas" } as never])).toBe("/custom-areas");
    expect(getPagePath("home")).toBe("/");
    expect(getPagePath("areas")).toBe("/areas");
  });
});
