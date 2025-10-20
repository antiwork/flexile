import { companiesFactory } from "@test/factories/companies";
import { companyContractorsFactory } from "@test/factories/companyContractors";
import { login } from "@test/helpers/auth";
import { expect, test } from "@test/index";

test.describe("People table sorting", () => {
  test("sorts by status chronologically", async ({ page }) => {
    const { company, adminUser } = await companiesFactory.createCompletedOnboarding();

    await companyContractorsFactory.create({
      companyId: company.id,
      role: "Alumni - ended at 2023-01-01",
      startedAt: new Date("2022-01-01"),
      endedAt: new Date("2023-01-01"),
    });
    await companyContractorsFactory.create({
      companyId: company.id,
      role: "Alumni - ended at 2024-01-01",
      startedAt: new Date("2022-01-01"),
      endedAt: new Date("2024-01-01"),
    });
    await companyContractorsFactory.create({
      companyId: company.id,
      role: "Active - started at 2023-05-01",
      startedAt: new Date("2023-05-01"),
      endedAt: undefined,
    });
    await companyContractorsFactory.create({
      companyId: company.id,
      role: "Active - started at 2024-05-01",
      startedAt: new Date("2024-05-01"),
      endedAt: undefined,
    });
    await companyContractorsFactory.create({
      companyId: company.id,
      role: "Invited",
    });

    await Promise.all([
      page.waitForResponse((r) => r.url().includes("contractors.list") && r.status() >= 200 && r.status() < 300),
      login(page, adminUser, "/people"),
    ]);

    // Wait for the table to have the expected number of rows
    await expect(page.locator("tbody tr")).toHaveCount(5);

    const statusHeader = page.getByRole("columnheader", { name: "Status" });
    await statusHeader.click();

    // Wait for sorting to complete and check content using playwright's expect
    await expect(page.locator("tbody tr").nth(0)).toContainText("Alumni - ended at 2023-01-01");
    await expect(page.locator("tbody tr").nth(1)).toContainText("Active - started at 2023-05-01");
    await expect(page.locator("tbody tr").nth(2)).toContainText("Alumni - ended at 2024-01-01");
    await expect(page.locator("tbody tr").nth(3)).toContainText("Active - started at 2024-05-01");
    await expect(page.locator("tbody tr").nth(4)).toContainText("Invited");

    await statusHeader.click();

    // Wait for reverse sorting to complete and check content
    await expect(page.locator("tbody tr").nth(0)).toContainText("Invited");
    await expect(page.locator("tbody tr").nth(1)).toContainText("Active - started at 2024-05-01");
    await expect(page.locator("tbody tr").nth(2)).toContainText("Active - started at 2023-05-01");
    await expect(page.locator("tbody tr").nth(3)).toContainText("Alumni - ended at 2024-01-01");
    await expect(page.locator("tbody tr").nth(4)).toContainText("Alumni - ended at 2023-01-01");
  });
});
