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

    const statusHeader = page.getByRole("columnheader", { name: "Status" });

    await statusHeader.click();

    let rows = await page.locator("tbody tr").allInnerTexts();
    assertRelativeOrder(rows, [
      "Alumni - ended at 2023-01-01",
      "Active - started at 2023-05-01",
      "Alumni - ended at 2024-01-01",
      "Active - started at 2024-05-01",
      "Invited",
    ]);

    await statusHeader.click();

    rows = await page.locator("tbody tr").allInnerTexts();
    assertRelativeOrder(rows, [
      "Invited",
      "Active - started at 2024-05-01",
      "Alumni - ended at 2024-01-01",
      "Active - started at 2023-05-01",
      "Alumni - ended at 2023-01-01",
    ]);
  });

  const assertRelativeOrder = (rows: string[], expectedOrder: string[]) => {
    let previousIndex = -1;
    expectedOrder.forEach((expected) => {
      const index = rows.findIndex((row) => row.includes(expected));
      expect(index).not.toBe(-1);
      expect(index).toBeGreaterThan(previousIndex);
      previousIndex = index;
    });
  };
});
