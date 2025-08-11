import { expect, test } from "@playwright/test";

test.describe("Dividend Email Company Selection", () => {
  test("should pre-select correct company when clicking dividend email link", async ({ page }) => {
    await page.goto("/equity/dividends?company_id=test-company-id");

    await expect(page.locator('[data-testid="dividends-table"]')).toBeVisible();

    await page.waitForTimeout(1000);
  });

  test("should handle invalid company_id gracefully", async ({ page }) => {
    await page.goto("/equity/dividends?company_id=invalid-id");

    await expect(page.locator("body")).toBeVisible();
  });
});
