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
    expectRowOrder(rows, {
      alumni: ["Alumni - ended at 2023-01-01", "Alumni - ended at 2024-01-01"],
      active: ["Active - started at 2023-05-01", "Active - started at 2024-05-01"],
      invited: "Invited",
    });

    await statusHeader.click();

    rows = await page.locator("tbody tr").allInnerTexts();
    expectRowOrder(rows, {
      alumni: ["Alumni - ended at 2024-01-01", "Alumni - ended at 2023-01-01"],
      active: ["Active - started at 2024-05-01", "Active - started at 2023-05-01"],
      invited: "Invited",
      descending: true,
    });
  });

  const expectRowOrder = (
    rows: string[],
    options: {
      alumni: [string, string];
      active: [string, string];
      invited: string;
      descending?: boolean;
    },
  ) => {
    const [alumniFirst, alumniSecond] = options.alumni;
    const [activeFirst, activeSecond] = options.active;
    const invited = options.invited;
    const direction = options.descending ? "desc" : "asc";

    const indexOf = (label: string) => {
      const index = rows.findIndex((row) => row.includes(label));
      expect(index).not.toBe(-1);
      return index;
    };

    const compare = (a: number, b: number) =>
      direction === "asc" ? expect(a).toBeLessThan(b) : expect(a).toBeGreaterThan(b);

    const alumniFirstIndex = indexOf(alumniFirst);
    const alumniSecondIndex = indexOf(alumniSecond);
    const activeFirstIndex = indexOf(activeFirst);
    const activeSecondIndex = indexOf(activeSecond);
    const invitedIndex = indexOf(invited);

    compare(alumniFirstIndex, alumniSecondIndex);
    compare(activeFirstIndex, activeSecondIndex);
    if (direction === "asc") {
      expect(alumniSecondIndex).toBeLessThan(invitedIndex);
      expect(activeSecondIndex).toBeLessThan(invitedIndex);
    } else {
      expect(invitedIndex).toBeLessThan(activeFirstIndex);
      expect(invitedIndex).toBeLessThan(alumniFirstIndex);
    }
  };
});
