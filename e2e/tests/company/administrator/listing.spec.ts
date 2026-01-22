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

    await login(page, adminUser, "/people");

    await expect(page.locator("tbody tr")).toHaveCount(5);
    await expect(page.locator("tbody tr").first()).not.toBeEmpty();

    const statusHeader = page.getByRole("columnheader", { name: "Status" });
    await expect(statusHeader).toBeVisible();
    await statusHeader.click();
    await expect(page.locator("tbody tr").first()).toContainText("Alumni - ended at 2023-01-01");

    let rows = await page.locator("tbody tr").allInnerTexts();
    expect(rows[0]).toContain("Alumni - ended at 2023-01-01");
    expect(rows[1]).toContain("Active - started at 2023-05-01");
    expect(rows[2]).toContain("Alumni - ended at 2024-01-01");
    expect(rows[3]).toContain("Active - started at 2024-05-01");
    expect(rows[4]).toContain("Invited");

    await statusHeader.click();
    await expect(page.locator("tbody tr").first()).toContainText("Invited");

    rows = await page.locator("tbody tr").allInnerTexts();
    expect(rows[0]).toContain("Invited");
    expect(rows[1]).toContain("Active - started at 2024-05-01");
    expect(rows[3]).toContain("Alumni - ended at 2024-01-01");
    expect(rows[2]).toContain("Active - started at 2023-05-01");
    expect(rows[4]).toContain("Alumni - ended at 2023-01-01");
  });
});
