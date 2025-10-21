import { companiesFactory } from "@test/factories/companies";
import { companyContractorsFactory } from "@test/factories/companyContractors";
import { login } from "@test/helpers/auth";
import { expect, test } from "@test/index";
import { format } from "date-fns";

test.describe("People table sorting", () => {
  test("sorts by status chronologically", async ({ page }) => {
    const { company, adminUser } = await companiesFactory.createCompletedOnboarding();

    await companyContractorsFactory.create({
      companyId: company.id,
      role: "Developer",
      startedAt: new Date("2022-01-01"),
      endedAt: new Date("2023-01-01"),
    });
    await companyContractorsFactory.create({
      companyId: company.id,
      role: "Designer",
      startedAt: new Date("2022-01-01"),
      endedAt: new Date("2024-01-01"),
    });
    await companyContractorsFactory.create({
      companyId: company.id,
      role: "Developer",
      startedAt: new Date("2023-05-01"),
      endedAt: undefined,
    });
    await companyContractorsFactory.create({
      companyId: company.id,
      role: "Designer",
      startedAt: new Date("2024-05-01"),
      endedAt: undefined,
    });
    await companyContractorsFactory.create({
      companyId: company.id,
      role: "Manager",
    });

    await Promise.all([
      page.waitForResponse((r) => r.url().includes("contractors.list") && r.status() >= 200 && r.status() < 300),
      login(page, adminUser, "/people"),
    ]);

    // Wait for the table to have the expected number of rows
    await expect(page.locator("tbody tr")).toHaveCount(5);

    // Verify initial order (table is already sorted by status chronologically - newest dates first)
    const currentDate = format(new Date(), "MMM d, yyyy");
    await expect(page.locator("tbody tr").nth(0)).toContainText(`Started on ${currentDate}`);
    await expect(page.locator("tbody tr").nth(1)).toContainText("Started on May 1, 2024");
    await expect(page.locator("tbody tr").nth(2)).toContainText("Ended on Jan 1, 2024");
    await expect(page.locator("tbody tr").nth(3)).toContainText("Started on May 1, 2023");
    await expect(page.locator("tbody tr").nth(4)).toContainText("Ended on Jan 1, 2023");

    // Click on Status header to sort (this should reverse the order - oldest dates first)
    const statusHeader = page.getByRole("columnheader", { name: "Status" });
    await statusHeader.click();

    // Verify sorting is reversed (ascending by date - oldest dates first)
    await expect(page.locator("tbody tr").nth(0)).toContainText("Ended on Jan 1, 2023");
    await expect(page.locator("tbody tr").nth(1)).toContainText("Started on May 1, 2023");
    await expect(page.locator("tbody tr").nth(2)).toContainText("Ended on Jan 1, 2024");
    await expect(page.locator("tbody tr").nth(3)).toContainText("Started on May 1, 2024");
    await expect(page.locator("tbody tr").nth(4)).toContainText(`Started on ${currentDate}`);
  });
});
