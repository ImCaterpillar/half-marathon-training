import { expect, test } from "@playwright/test";

const accessCode = process.env.E2E_ACCESS_CODE ?? "test-access-code";

test("access code opens dashboard and protected shell pages", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/dashboard/);
  await page.getByPlaceholder("访问码").fill(accessCode);
  await page.getByRole("button", { name: /进入系统/ }).click();
  await expect(page.getByRole("heading", { name: /Dashboard/ })).toBeVisible();
  await page.goto("/week");
  await expect(page.getByRole("heading", { name: /周训练计划/ })).toBeVisible();
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: /设置/ })).toBeVisible();
});

test("pwa manifest is available", async ({ request }) => {
  const response = await request.get("/manifest.webmanifest");
  expect(response.ok()).toBeTruthy();
  const manifest = await response.json();
  expect(manifest.name).toContain("半程马拉松");
  expect(manifest.start_url).toBe("/dashboard");
});
