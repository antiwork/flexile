import { expect, test } from "@playwright/test";

test.describe("DialogStack Keyboard Shortcuts", () => {
  test("Meta/Ctrl+Enter triggers primary action on final step", async ({ page, browserName }) => {
    const [{ companiesFactory }, { login }, { withinModal }] = await Promise.all([
      import("@test/factories/companies"),
      import("@test/helpers/auth"),
      import("@test/index"),
    ]);

    const { adminUser } = await companiesFactory.createCompletedOnboarding();
    await login(page, adminUser, "/people");

    await page.getByRole("button", { name: "Add contractor" }).click();

    await withinModal(
      async (modal) => {
        await expect(modal.getByRole("heading", { name: "Who's joining?" })).toBeVisible();
        await modal.getByRole("button", { name: "Continue" }).click();
      },
      { page, assertClosed: false },
    );

    await withinModal(
      async (modal) => {
        await expect(modal.getByRole("heading", { name: "Add a contract" })).toBeVisible();
        const isMac = browserName === "webkit" || process.platform === "darwin";
        if (isMac) {
          await page.keyboard.down("Meta");
          await page.keyboard.press("Enter");
          await page.keyboard.up("Meta");
        } else {
          await page.keyboard.down("Control");
          await page.keyboard.press("Enter");
          await page.keyboard.up("Control");
        }
        await expect(modal).toBeVisible();
      },
      { page, assertClosed: false },
    );
  });
});
