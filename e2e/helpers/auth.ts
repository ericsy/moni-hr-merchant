import type { Page } from "@playwright/test";

export async function seedAuthenticatedSession(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("moni_hr_access_token", "e2e-token");
    window.localStorage.setItem(
      "moni_hr_auth_session",
      JSON.stringify({
        status: "authenticated",
        user: { email: "admin@moni.test", name: "坤" },
        activationToken: "",
      })
    );
  });
}
