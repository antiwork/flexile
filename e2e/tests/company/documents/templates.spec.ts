import { companiesFactory } from "@test/factories/companies";
import { login } from "@test/helpers/auth";
import { expect, test, withinModal } from "@test/index";
import { format } from "date-fns";

test.describe("Document templates", () => {
  test("allows creating a document template", async ({ page }) => {
    const { adminUser } = await companiesFactory.createCompletedOnboarding({ equityEnabled: true });
    await login(page, adminUser, "/settings/administrator/templates");
    await expect(page.getByRole("heading", { name: "Templates" })).toBeVisible();
    await page.getByRole("row", { name: "Consulting agreement" }).click();
    await withinModal(
      async () => {
        await page.locator("[contenteditable=true]").fill("This is a consulting contract");
        await page.getByRole("button", { name: "Save changes" }).click();
      },
      { page, title: "Consulting agreement" },
    );
    await expect(page.getByRole("row", { name: "Consulting agreement" })).toContainText(
      format(new Date(), "MMM d, yyyy"),
    );
    await page.getByRole("link", { name: "Back to app" }).click();
    await page.getByRole("link", { name: "People" }).click();
    await page.getByRole("button", { name: "Add contractor" }).click();
    await expect(page.getByRole("tab", { name: "Write" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByText("This is a consulting contract")).toBeVisible();
  });
});
