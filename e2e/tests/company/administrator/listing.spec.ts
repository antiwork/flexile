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
    await expect(page.getByRole("row")).toHaveCount(6);

    const statusHeader = page.getByRole("columnheader", { name: "Status" });

    await statusHeader.click();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(500);

    const allRows = await page.getByRole("row").allInnerTexts();
    let rows = allRows.slice(1); // Skip header row
    expect(rows[0]).toContain("Alumni - ended at 2023-01-01");
    expect(rows[1]).toContain("Active - started at 2023-05-01");
    expect(rows[2]).toContain("Alumni - ended at 2024-01-01");
    expect(rows[3]).toContain("Active - started at 2024-05-01");
    expect(rows[4]).toContain("Invited");

    await statusHeader.click();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(500);

    rows = (await page.getByRole("row").allInnerTexts()).slice(1); // Skip header row
    expect(rows[0]).toContain("Invited");
    expect(rows[1]).toContain("Active - started at 2024-05-01");
    expect(rows[3]).toContain("Alumni - ended at 2024-01-01");
    expect(rows[2]).toContain("Active - started at 2023-05-01");
    expect(rows[4]).toContain("Alumni - ended at 2023-01-01");
  });
});
