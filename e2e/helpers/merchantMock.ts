import type { Page, Route } from "@playwright/test";

type JsonBody = Record<string, unknown>;

interface MockStore {
  id: string;
  name: string;
  code: string;
  address: string;
  city: string;
  country: string;
  phone: string;
  email: string;
  manager: string;
  openTime: string;
  closeTime: string;
  timezone: string;
  status: string;
}

interface MockArea {
  id: string;
  name: string;
  color: string;
  order: number;
  storeId: string;
}

const json = (data: unknown) => ({
  contentType: "application/json",
  body: JSON.stringify({ code: 0, data }),
});

const notFound = {
  status: 404,
  contentType: "application/json",
  body: JSON.stringify({ code: 404, message: "No E2E mock registered for this endpoint" }),
};

function routePath(route: Route) {
  return new URL(route.request().url()).pathname;
}

function routeQuery(route: Route) {
  return new URL(route.request().url()).searchParams;
}

function readPostData(route: Route): JsonBody {
  const raw = route.request().postData();
  if (!raw) return {};

  try {
    return JSON.parse(raw) as JsonBody;
  } catch {
    return {};
  }
}

export async function mockMerchantApi(page: Page) {
  const stores: MockStore[] = [
    {
      id: "1",
      name: "Queen Street",
      code: "QS",
      address: "1 Queen Street",
      city: "Auckland",
      country: "NZ",
      phone: "+64 9 000 0000",
      email: "queen@moni.test",
      manager: "Mia",
      openTime: "09:00",
      closeTime: "22:00",
      timezone: "Pacific/Auckland",
      status: "enabled",
    },
  ];

  const areas: MockArea[] = [
    { id: "101", name: "前台", color: "purple", order: 0, storeId: "all" },
    { id: "102", name: "收银", color: "orange", order: 0, storeId: "1" },
    { id: "103", name: "客服", color: "purple", order: 1, storeId: "all" },
    { id: "104", name: "技工", color: "purple", order: 1, storeId: "1" },
    { id: "105", name: "财务", color: "orange", order: 2, storeId: "1" },
  ];

  await page.route("**/api/v1/merchant/**", async (route) => {
    const method = route.request().method();
    const path = routePath(route);
    const query = routeQuery(route);

    if (path === "/api/v1/merchant/auth/me") {
      await route.fulfill(json({ merchantAdminId: 1, merchantId: 1, adminName: "坤" }));
      return;
    }

    if (path === "/api/v1/merchant/auth/logout") {
      await route.fulfill(json(null));
      return;
    }

    if (path === "/api/v1/merchant/auth/permissions-tree") {
      await route.fulfill(json([
        { id: 1, nameZh: "员工管理", nameEn: "Employees", url: "/employees", status: 1, sortOrder: 80 },
        { id: 2, nameZh: "店面管理", nameEn: "Stores", url: "/stores", status: 1, sortOrder: 70 },
        { id: 3, nameZh: "区域管理", nameEn: "Areas", url: "/areas", status: 1, sortOrder: 60 },
        { id: 4, nameZh: "班次管理", nameEn: "Schedule", url: "/schedule", status: 1, sortOrder: 50 },
        { id: 5, nameZh: "排班管理", nameEn: "Rosters", url: "/rosters", status: 1, sortOrder: 40 },
        { id: 6, nameZh: "排班模板", nameEn: "Roster Template", url: "/roster-template", status: 1, sortOrder: 30 },
      ]));
      return;
    }

    if (path === "/api/v1/merchant/countries") {
      await route.fulfill(json([
        { code: "nz", nameZh: "新西兰", nameEn: "New Zealand", dialCode: "64" },
        { code: "au", nameZh: "澳大利亚", nameEn: "Australia", dialCode: "61" },
      ]));
      return;
    }

    if (path === "/api/v1/merchant/positions" || path === "/api/v1/merchant/work-areas") {
      await route.fulfill(json({ items: [] }));
      return;
    }

    if (path === "/api/v1/merchant/stores") {
      await route.fulfill(json({ items: stores }));
      return;
    }

    if (path === "/api/v1/merchant/employees") {
      await route.fulfill(json({ items: [] }));
      return;
    }

    if (path === "/api/v1/merchant/global-shifts") {
      await route.fulfill(json({ items: [] }));
      return;
    }

    if (path === "/api/v1/merchant/schedule") {
      await route.fulfill(json({ cells: [] }));
      return;
    }

    if (path === "/api/v1/merchant/schedule-templates") {
      await route.fulfill(json({ items: [] }));
      return;
    }

    if (path === "/api/v1/merchant/schedule-areas" && method === "GET") {
      const storeId = query.get("storeId") || "all";
      const items = areas.filter((area) => storeId === "all" || area.storeId === "all" || area.storeId === storeId);
      await route.fulfill(json({ items }));
      return;
    }

    if (path === "/api/v1/merchant/schedule-areas" && method === "POST") {
      const body = readPostData(route);
      const storeId = String(body.storeId || "all");
      const nextArea: MockArea = {
        id: String(200 + areas.length),
        name: String(body.name || ""),
        color: String(body.color || "blue"),
        order: Number(body.order || areas.length),
        storeId,
      };
      areas.push(nextArea);
      await route.fulfill(json(nextArea));
      return;
    }

    const areaMatch = path.match(/^\/api\/v1\/merchant\/schedule-areas\/([^/]+)$/);
    if (areaMatch && method === "PATCH") {
      const areaId = areaMatch[1];
      const body = readPostData(route);
      const index = areas.findIndex((area) => area.id === areaId);
      if (index >= 0) {
        areas[index] = {
          ...areas[index],
          name: String(body.name || areas[index].name),
          color: String(body.color || areas[index].color),
          order: Number(body.order ?? areas[index].order),
          storeId: String(body.storeId || areas[index].storeId),
        };
        await route.fulfill(json(areas[index]));
        return;
      }
    }

    if (areaMatch && method === "DELETE") {
      const areaId = areaMatch[1];
      const index = areas.findIndex((area) => area.id === areaId);
      if (index >= 0) areas.splice(index, 1);
      await route.fulfill(json(null));
      return;
    }

    await route.fulfill(notFound);
  });
}
