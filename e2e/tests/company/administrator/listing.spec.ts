import { companiesFactory } from "@test/factories/companies";
import { companyContractorsFactory } from "@test/factories/companyContractors";
import { login } from "@test/helpers/auth";
import { expect, test } from "@test/index";

test.describe("People table sorting", () => {
  test("sorts by status chronologically", async ({ page }) => {
    const { company, adminUser } = await companiesFactory.createCompletedOnboarding();

    await companyContractorsFactory.create({
      companyId: company.id,
      role: "Alumni Old",
      startedAt: new Date("2022-01-01"),
      endedAt: new Date("2023-01-01"),
    });
    await companyContractorsFactory.create({
      companyId: company.id,
      role: "Alumni New",
      startedAt: new Date("2022-01-01"),
      endedAt: new Date("2024-01-01"),
    });
    await companyContractorsFactory.create({
      companyId: company.id,
      role: "Active Old",
      startedAt: new Date("2023-05-01"),
      endedAt: undefined,
    });
    await companyContractorsFactory.create({
      companyId: company.id,
      role: "Active New",
      startedAt: new Date("2024-05-01"),
      endedAt: undefined,
    });
    await companyContractorsFactory.create({
      companyId: company.id,
      role: "Invited",
    });

    await login(page, adminUser);
    await page.getByRole("link", { name: "People" }).click();

    const statusHeader = page.getByRole("columnheader", { name: "Status" });

    await expect(page.getByText("Alumni Old")).toBeVisible();

    await statusHeader.click();

    let rows = await page.locator("tbody tr").allInnerTexts();
    expect(rows[0]).toContain("Alumni Old"); // ended on Jan 1, 2023
    expect(rows[1]).toContain("Active Old"); // started on May 1, 2023
    expect(rows[2]).toContain("Alumni New"); // ended on Jan 1, 2024
    expect(rows[3]).toContain("Active New"); // started on May 1, 2024
    expect(rows[4]).toContain("Invited"); // started most recently

    await statusHeader.click();

    rows = await page.locator("tbody tr").allInnerTexts();
    expect(rows[0]).toContain("Invited"); // started most recently
    expect(rows[1]).toContain("Active New"); // started on May 1, 2024
    expect(rows[3]).toContain("Alumni New"); // ended on Jan 1, 2024
    expect(rows[2]).toContain("Active Old"); // started on May 1, 2023
    expect(rows[4]).toContain("Alumni Old"); // ended on Jan 1, 2023
  });
});
