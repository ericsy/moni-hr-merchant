import { expect, test } from "@playwright/test";
import { seedAuthenticatedSession } from "./helpers/auth";
import { mockMerchantApi } from "./helpers/merchantMock";

test.beforeEach(async ({ page }) => {
  await seedAuthenticatedSession(page);
  await mockMerchantApi(page);
});

test("区域管理页支持搜索和新增通用区域", async ({ page }) => {
  await page.goto("/areas");

  await expect(page.getByRole("heading", { name: "区域管理" })).toBeVisible();
  await expect(page.getByText("前台")).toBeVisible();
  await expect(page.getByText("客服")).toBeVisible();

  await page.getByRole("textbox", { name: "搜索区域" }).fill("客服");
  await expect(page.getByText("客服")).toBeVisible();
  await expect(page.getByText("前台")).toBeHidden();

  await page.getByRole("textbox", { name: "搜索区域" }).clear();
  await page.getByRole("button", { name: "新增区域" }).click();
  await page.getByRole("textbox", { name: "区域名称" }).fill("仓库");
  await page.getByRole("button", { name: "通用" }).click();
  await page.getByTestId("area-modal-submit").click();

  await expect(page.getByText("区域已保存")).toBeVisible();
  await expect(page.getByText("仓库")).toBeVisible();
});

test("区域管理页基础 UI 截图保持稳定", async ({ page }) => {
  await page.goto("/areas");

  await expect(page.getByText("财务")).toBeVisible();
  await expect(page.locator('[data-cmp="Areas"]')).toHaveScreenshot("areas-management.png");
});
